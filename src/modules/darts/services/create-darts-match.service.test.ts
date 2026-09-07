import { DomainError } from "../../../lib/domain-error";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { DartsMatchVenueNotFoundError } from "../entities/darts-match-venue-not-found-error";
import { InMemoryDartsMatchRepository } from "../repositories/in-memory-darts-match.repository";
import { CaptureFinishedDartsMatch } from "./capture-finished-darts-match.service";
import { CreateDartsMatch } from "./create-darts-match.service";
import {
  ListLockedDartsMatchesByPlayer,
  ListLockedDartsMatchesByVenue,
} from "./list-locked-darts-matches.service";
import { SubmitDartsTurn } from "./submit-darts-turn.service";

const players = [
  { slot: 1, displayName: "Alex", isGuest: false, userId: "user-alex" },
  { slot: 2, displayName: "Sam", isGuest: true, userId: null },
];

async function seedVenue(venues: InMemoryVenueRepository) {
  await venues.ensureFromCms(
    Venue.registerFromCms(
      CmsId.from("sanity-pub-1"),
      VenueName.from("The Dartboard"),
      Slug.from("the-dartboard"),
    ),
    { refreshDetails: false },
  );
}

describe("darts application", () => {
  test("create persists a live match with or without a venue", async () => {
    const venues = new InMemoryVenueRepository();
    const matches = new InMemoryDartsMatchRepository();
    await seedVenue(venues);
    const create = new CreateDartsMatch(matches, venues);

    const atPub = await create.execute({
      venueCmsId: "sanity-pub-1",
      startsAt: "2026-09-07T18:00:00.000Z",
      players,
    });
    const atHome = await create.execute({
      venueCmsId: null,
      startsAt: "2026-09-07T19:00:00.000Z",
      players,
    });

    expect(atPub.toSnapshot().venueCmsId).toBe("sanity-pub-1");
    expect(atHome.toSnapshot().venueCmsId).toBeNull();
    expect((await matches.findById(atHome.id))?.status).toBe("live");
  });

  test("create fails when a provided venue cmsId is unknown", async () => {
    const create = new CreateDartsMatch(
      new InMemoryDartsMatchRepository(),
      new InMemoryVenueRepository(),
    );

    await expect(
      create.execute({
        venueCmsId: "missing-pub",
        startsAt: "2026-09-07T18:00:00.000Z",
        players,
      }),
    ).rejects.toBeInstanceOf(DartsMatchVenueNotFoundError);
  });

  test("submitTurn persists busts and locks on checkout", async () => {
    const venues = new InMemoryVenueRepository();
    const matches = new InMemoryDartsMatchRepository();
    const created = await new CreateDartsMatch(matches, venues).execute({
      startsAt: "2026-09-07T18:00:00.000Z",
      players,
    });
    const submit = new SubmitDartsTurn(matches);

    await submit.execute({ matchId: created.id, playerSlot: 1, score: 180 });
    await submit.execute({ matchId: created.id, playerSlot: 1, score: 180 });
    const busted = await submit.execute({
      matchId: created.id,
      playerSlot: 1,
      score: 140,
    });
    expect(busted?.remainingFor(1)).toBe(141);

    await expect(
      submit.execute({
        matchId: created.id,
        playerSlot: 1,
        score: 40,
        checkout: true,
      }),
    ).rejects.toBeInstanceOf(DomainError);

    const finished = await submit.execute({
      matchId: created.id,
      playerSlot: 2,
      score: 180,
    });
    expect(finished?.status).toBe("live");

    await submit.execute({ matchId: created.id, playerSlot: 2, score: 180 });
    await submit.execute({ matchId: created.id, playerSlot: 2, score: 101 });
    const locked = await submit.execute({
      matchId: created.id,
      playerSlot: 2,
      score: 40,
      checkout: true,
      lockedByUserId: "user-alex",
    });

    expect(locked?.status).toBe("locked");
    expect(locked?.winnerSlot).toBe(2);
    expect(locked?.lockedByUserId).toBe("user-alex");
  });

  test("captureFinished with turns lists immediately for the seated player", async () => {
    const venues = new InMemoryVenueRepository();
    const matches = new InMemoryDartsMatchRepository();
    await seedVenue(venues);
    const capture = new CaptureFinishedDartsMatch(matches, venues);

    const match = await capture.execute({
      venueCmsId: "sanity-pub-1",
      startsAt: "2026-09-07T18:00:00.000Z",
      players,
      turns: [
        { playerSlot: 1, score: 180 },
        { playerSlot: 1, score: 180 },
        { playerSlot: 1, score: 141, checkout: true },
      ],
      lockedByUserId: "user-alex",
    });

    expect(match.status).toBe("locked");
    const history = await new ListLockedDartsMatchesByPlayer(
      matches,
      venues,
    ).execute("user-alex");
    expect(history).toEqual([
      expect.objectContaining({
        id: match.id,
        venueCmsId: "sanity-pub-1",
        venueName: "The Dartboard",
        venueSlug: "the-dartboard",
        winnerSlot: 1,
      }),
    ]);

    const venueHistory = await new ListLockedDartsMatchesByVenue(
      matches,
      venues,
    ).execute("sanity-pub-1");
    expect(venueHistory.map((item) => item.id)).toEqual([match.id]);
  });

  test("player history includes home games with a null venue", async () => {
    const venues = new InMemoryVenueRepository();
    const matches = new InMemoryDartsMatchRepository();
    const match = await new CaptureFinishedDartsMatch(matches, venues).execute({
      venueCmsId: null,
      startsAt: "2026-09-07T18:00:00.000Z",
      players,
      remaining: { "1": 0, "2": 220 },
      winnerSlot: 1,
      lockedByUserId: "user-alex",
    });

    const history = await new ListLockedDartsMatchesByPlayer(
      matches,
      venues,
    ).execute("user-alex");
    expect(history).toEqual([
      expect.objectContaining({
        id: match.id,
        venueCmsId: null,
        venueName: null,
        venueSlug: null,
        winnerSlot: 1,
      }),
    ]);
  });
});
