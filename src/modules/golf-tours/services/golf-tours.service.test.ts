import { DomainError } from "../../../lib/domain-error";
import { InMemoryGolfRoundRepository } from "../../golf-round/repositories/in-memory-golf-round.repository";
import { CreateGolfRound } from "../../golf-round/services/create-golf-round.service";
import { GetGolfRoundById } from "../../golf-round/services/get-golf-round-by-id.service";
import { LockGolfRound } from "../../golf-round/services/lock-golf-round.service";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { GolfTourForbiddenError } from "../entities/golf-tour-forbidden-error";
import { GolfTourNotFoundError } from "../entities/golf-tour-not-found-error";
import { InMemoryGolfTourRepository } from "../repositories/in-memory-golf-tour.repository";
import { LockGolfTourFourballOnScorecardLock } from "./lock-fourball-on-scorecard-lock";
import {
  AddGolfTourFourball,
  AddGolfTourRound,
  CompleteGolfTour,
  CreateGolfTour,
  GetGolfTour,
  GetGolfTourLeaderboard,
  StartGolfTourFourball,
  UpdateGolfTour,
} from "./golf-tours.service";

const COURSE = "sanity-course-1";

async function seedVenue(venues: InMemoryVenueRepository) {
  await venues.ensureFromCms(
    Venue.registerFromCms(
      CmsId.from(COURSE),
      VenueName.from("Golf Club"),
      Slug.from("golf-club"),
    ),
    { refreshDetails: false },
  );
}

function scoreForSlots(slots: number[], stroke: number) {
  return {
    holes: Array.from({ length: 9 }, (_, index) => ({
      number: index + 1,
      strokes: Object.fromEntries(slots.map((slot) => [String(slot), stroke])),
    })),
  };
}

describe("golf tours application", () => {
  async function setup() {
    const tours = new InMemoryGolfTourRepository();
    const venues = new InMemoryVenueRepository();
    const golf = new InMemoryGolfRoundRepository();
    await seedVenue(venues);
    const createGolfRound = new CreateGolfRound(golf, venues);
    const lockFourball = new LockGolfTourFourballOnScorecardLock(tours);
    const lockGolf = new LockGolfRound(golf, (event) => lockFourball.execute(event));
    return {
      tours,
      venues,
      golf,
      create: new CreateGolfTour(tours),
      get: new GetGolfTour(tours),
      update: new UpdateGolfTour(tours),
      complete: new CompleteGolfTour(tours),
      addRound: new AddGolfTourRound(tours, venues),
      addFourball: new AddGolfTourFourball(tours),
      start: new StartGolfTourFourball(tours, createGolfRound),
      leaderboard: new GetGolfTourLeaderboard(tours, new GetGolfRoundById(golf)),
      lockGolf,
    };
  }

  test("create defaults to two camps", async () => {
    const ctx = await setup();
    const { tour } = await ctx.create.execute({
      userId: "user-host",
      name: "Friends Cup",
      startDate: "2026-09-12",
      endDate: "2026-09-14",
    });
    expect(tour.status).toBe("draft");
    expect(tour.camps.map((camp) => camp.name)).toEqual(["Camp A", "Camp B"]);
    expect(tour.viewer.role).toBe("host");
  });

  test("start creates a golf round and returns golfRoundId + path", async () => {
    const ctx = await setup();
    const created = await ctx.create.execute({
      userId: "user-host",
      name: "Friends Cup",
      startDate: "2026-09-12",
      endDate: "2026-09-14",
    });
    const withRound = await ctx.addRound.execute({
      userId: "user-host",
      tourId: created.tour.id,
      date: "2026-09-12",
      venueCmsId: COURSE,
      label: "Saturday AM",
    });
    const roundId = withRound.tour.rounds[0]!.id;
    const withFourball = await ctx.addFourball.execute({
      userId: "user-host",
      tourId: created.tour.id,
      roundId,
      campId: created.tour.camps[0]!.id,
      players: [
        { slot: 1, displayName: "Alex", isGuest: false, userId: "user-host" },
        { slot: 2, displayName: "Pat", isGuest: true, userId: null },
      ],
    });

    const started = await ctx.start.execute({
      userId: "user-host",
      tourId: created.tour.id,
      fourballId: withFourball.fourball.id,
      teeName: "White",
    });

    expect(started.golfRoundId).toBeTruthy();
    expect(started.path).toBe(`/golf/${started.golfRoundId}`);
    expect(started.fourball.status).toBe("live");
    expect(started.tour.status).toBe("active");
    const card = await ctx.golf.findById(started.golfRoundId);
    expect(card?.venueCmsId.value).toBe(COURSE);
    expect(card?.teeName).toBe("White");
    expect(card?.holesPlayed).toBe(9);
  });

  test("leaderboard uses only locked cards and includes guests", async () => {
    const ctx = await setup();
    const created = await ctx.create.execute({
      userId: "user-host",
      name: "Friends Cup",
      startDate: "2026-09-12",
      endDate: "2026-09-14",
    });
    const tourId = created.tour.id;
    const campA = created.tour.camps[0]!.id;
    const withRound = await ctx.addRound.execute({
      userId: "user-host",
      tourId,
      date: "2026-09-12",
      venueCmsId: COURSE,
    });
    const roundId = withRound.tour.rounds[0]!.id;

    const lockedFb = await ctx.addFourball.execute({
      userId: "user-host",
      tourId,
      roundId,
      campId: campA,
      players: [
        { slot: 1, displayName: "Alex", isGuest: false, userId: "user-host" },
        { slot: 2, displayName: "Pat", isGuest: true, userId: null },
      ],
    });
    const liveFb = await ctx.addFourball.execute({
      userId: "user-host",
      tourId,
      roundId,
      campId: campA,
      players: [
        { slot: 1, displayName: "Alex", isGuest: false, userId: "user-host" },
        { slot: 2, displayName: "Sam", isGuest: false, userId: "user-sam" },
      ],
    });

    const startedLocked = await ctx.start.execute({
      userId: "user-host",
      tourId,
      fourballId: lockedFb.fourball.id,
      teeName: "White",
    });
    await ctx.lockGolf.execute({
      roundId: startedLocked.golfRoundId,
      lockedByUserId: "user-host",
      score: scoreForSlots([1, 2], 4),
    });

    await ctx.start.execute({
      userId: "user-host",
      tourId,
      fourballId: liveFb.fourball.id,
      teeName: "White",
    });

    const { leaderboard } = await ctx.leaderboard.execute({
      userId: "user-host",
      tourId,
    });
    const camp = leaderboard.camps.find((row) => row.campId === campA)!;
    expect(camp.players).toHaveLength(2);
    expect(camp.players.map((player) => player.playerKey).sort()).toEqual([
      "guest:pat",
      "user:user-host",
    ]);
    expect(camp.players.every((player) => player.playerRoundsCounted === 1)).toBe(
      true,
    );
    expect(camp.players.every((player) => player.totalStrokes === 36)).toBe(true);
    expect(camp.players.find((player) => player.isGuest)?.displayName).toBe("Pat");
  });

  test("non-host cannot mutate; seated player can read", async () => {
    const ctx = await setup();
    const { tour } = await ctx.create.execute({
      userId: "user-host",
      name: "Friends Cup",
      startDate: "2026-09-12",
      endDate: "2026-09-14",
    });
    await expect(
      ctx.update.execute({
        userId: "user-other",
        tourId: tour.id,
        name: "Hijack",
      }),
    ).rejects.toBeInstanceOf(GolfTourForbiddenError);

    const withRound = await ctx.addRound.execute({
      userId: "user-host",
      tourId: tour.id,
      date: "2026-09-12",
      venueCmsId: COURSE,
    });
    await ctx.addFourball.execute({
      userId: "user-host",
      tourId: tour.id,
      roundId: withRound.tour.rounds[0]!.id,
      campId: tour.camps[0]!.id,
      players: [
        { slot: 1, displayName: "Sam", isGuest: false, userId: "user-sam" },
      ],
    });

    const asPlayer = await ctx.get.execute({
      userId: "user-sam",
      tourId: tour.id,
    });
    expect(asPlayer.tour.viewer.role).toBe("player");

    await expect(
      ctx.get.execute({ userId: "user-stranger", tourId: tour.id }),
    ).rejects.toBeInstanceOf(GolfTourNotFoundError);
  });

  test("host complete freezes the tour", async () => {
    const ctx = await setup();
    const { tour } = await ctx.create.execute({
      userId: "user-host",
      name: "Friends Cup",
      startDate: "2026-09-12",
      endDate: "2026-09-14",
    });
    const completed = await ctx.complete.execute({
      userId: "user-host",
      tourId: tour.id,
    });
    expect(completed.tour.status).toBe("completed");
    await expect(
      ctx.addRound.execute({
        userId: "user-host",
        tourId: tour.id,
        date: "2026-09-12",
        venueCmsId: COURSE,
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
