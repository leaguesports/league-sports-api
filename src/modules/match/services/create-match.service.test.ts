import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { DomainError } from "../../../lib/domain-error";
import { MatchVenueNotFoundError } from "../entities/match-venue-not-found-error";
import { InMemoryMatchRepository } from "../repositories/in-memory-match.repository";
import { CreateMatch } from "./create-match.service";
import {
  ListLockedMatchesByPlayer,
  ListLockedMatchesByVenue,
} from "./list-locked-matches.service";
import { LockMatch } from "./lock-match.service";
import { toHistoryItem } from "./match-history-item";

const guests = {
  teamA: [
    { displayName: "Alex", isGuest: true, userId: null },
    { displayName: "Sam", isGuest: true, userId: null },
  ] as [
    { displayName: string; isGuest: boolean; userId: null },
    { displayName: string; isGuest: boolean; userId: null },
  ],
  teamB: [
    { displayName: "Jordan", isGuest: true, userId: null },
    { displayName: "Riley", isGuest: false, userId: "user-riley" },
  ] as [
    { displayName: string; isGuest: boolean; userId: null },
    { displayName: string; isGuest: boolean; userId: string },
  ],
};

const scoreA = {
  sets: [{ gamesA: 6, gamesB: 4, tieBreak: null, winner: "A" as const }],
};

async function seedVenue(venues: InMemoryVenueRepository) {
  await venues.ensureFromCms(
    Venue.registerFromCms(
      CmsId.from("sanity-court-1"),
      VenueName.from("Padel Club"),
      Slug.from("padel-club"),
    ),
    { refreshDetails: false },
  );
}

describe("match application", () => {
  test("create persists a distinct match that get-by-id returns", async () => {
    const venues = new InMemoryVenueRepository();
    const matches = new InMemoryMatchRepository();
    await seedVenue(venues);
    const create = new CreateMatch(matches, venues);

    const first = await create.execute({
      venueCmsId: "sanity-court-1",
      startsAt: "2026-08-29T10:00:00.000Z",
      ruleset: "golden_point",
      pairings: guests,
    });
    const second = await create.execute({
      venueCmsId: "sanity-court-1",
      startsAt: "2026-08-29T12:00:00.000Z",
      ruleset: "advantage",
      pairings: guests,
      servingTeam: "B",
    });

    expect(first.id).not.toBe(second.id);
    expect((await matches.findById(first.id))?.toSnapshot()).toEqual(
      first.toSnapshot(),
    );
    expect((await matches.findById(second.id))?.id).toBe(second.id);
    expect(second.toSnapshot().servingTeam).toBe("B");
  });

  test("create fails when the venue cmsId is unknown", async () => {
    const create = new CreateMatch(
      new InMemoryMatchRepository(),
      new InMemoryVenueRepository(),
    );

    await expect(
      create.execute({
        venueCmsId: "missing-court",
        startsAt: "2026-08-29T10:00:00.000Z",
        ruleset: "golden_point",
        pairings: guests,
      }),
    ).rejects.toBeInstanceOf(MatchVenueNotFoundError);
  });

  test("create rejects blank venue and incomplete pairings before save", async () => {
    const venues = new InMemoryVenueRepository();
    const matches = new InMemoryMatchRepository();
    await seedVenue(venues);
    const create = new CreateMatch(matches, venues);

    await expect(
      create.execute({
        venueCmsId: "   ",
        startsAt: "2026-08-29T10:00:00.000Z",
        ruleset: "golden_point",
        pairings: guests,
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  test("lock is idempotent for the same score and history omits live matches", async () => {
    const venues = new InMemoryVenueRepository();
    const matches = new InMemoryMatchRepository();
    await seedVenue(venues);
    const created = await new CreateMatch(matches, venues).execute({
      venueCmsId: "sanity-court-1",
      startsAt: "2026-08-29T10:00:00.000Z",
      ruleset: "golden_point",
      pairings: guests,
    });
    const lock = new LockMatch(matches);
    const byPlayer = new ListLockedMatchesByPlayer(matches, venues);
    const byVenue = new ListLockedMatchesByVenue(matches, venues);

    expect(await byPlayer.execute("user-riley")).toEqual([]);
    expect(await byVenue.execute("sanity-court-1")).toEqual([]);

    const locked = await lock.execute({
      matchId: created.id,
      score: scoreA,
      winner: "A",
    });
    const again = await lock.execute({
      matchId: created.id,
      score: scoreA,
      winner: "A",
    });

    expect(locked?.status).toBe("locked");
    expect(again?.id).toBe(created.id);
    expect(again?.toSnapshot().score).toEqual(scoreA);

    const playerHistory = await byPlayer.execute("user-riley");
    const venueHistory = await byVenue.execute("sanity-court-1");

    expect(playerHistory).toHaveLength(1);
    expect(playerHistory[0]).toMatchObject({
      id: created.id,
      venueCmsId: "sanity-court-1",
      venueName: "Padel Club",
      venueSlug: "padel-club",
      winner: "A",
      opponents: [
        { slot: "A1", displayName: "Alex", isGuest: true },
        { slot: "A2", displayName: "Sam", isGuest: true },
      ],
    });
    expect(venueHistory).toHaveLength(1);
    expect(venueHistory[0].opponents).toEqual(locked?.toSnapshot().pairings);
  });

  test("history is newest-first and scoped to the player or venue", async () => {
    const venues = new InMemoryVenueRepository();
    const matches = new InMemoryMatchRepository();
    await seedVenue(venues);
    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-court-2"),
        VenueName.from("Other Club"),
        Slug.from("other-club"),
      ),
      { refreshDetails: false },
    );

    const create = new CreateMatch(matches, venues);
    const lock = new LockMatch(matches);

    const older = await create.execute({
      venueCmsId: "sanity-court-1",
      startsAt: "2026-08-01T10:00:00.000Z",
      ruleset: "golden_point",
      pairings: guests,
    });
    const newer = await create.execute({
      venueCmsId: "sanity-court-1",
      startsAt: "2026-08-20T10:00:00.000Z",
      ruleset: "golden_point",
      pairings: guests,
    });
    const otherCourt = await create.execute({
      venueCmsId: "sanity-court-2",
      startsAt: "2026-08-25T10:00:00.000Z",
      ruleset: "golden_point",
      pairings: {
        teamA: guests.teamA,
        teamB: [
          { displayName: "Pat", isGuest: false, userId: "user-pat" },
          { displayName: "Kim", isGuest: true, userId: null },
        ],
      },
    });

    await lock.execute({ matchId: older.id, score: scoreA, winner: "A" });
    await lock.execute({ matchId: newer.id, score: scoreA, winner: "A" });
    await lock.execute({ matchId: otherCourt.id, score: scoreA, winner: "A" });

    const playerHistory = await new ListLockedMatchesByPlayer(
      matches,
      venues,
    ).execute("user-riley");
    const venueHistory = await new ListLockedMatchesByVenue(
      matches,
      venues,
    ).execute("sanity-court-1");

    expect(playerHistory.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(venueHistory.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(playerHistory.some((item) => item.id === otherCourt.id)).toBe(false);
  });

  test("player history batches unique venue cmsIds", async () => {
    const venues = new InMemoryVenueRepository();
    const matches = new InMemoryMatchRepository();
    await seedVenue(venues);
    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-court-2"),
        VenueName.from("Other Club"),
        Slug.from("other-club"),
      ),
      { refreshDetails: false },
    );

    const create = new CreateMatch(matches, venues);
    const lock = new LockMatch(matches);
    const atCourt1 = await create.execute({
      venueCmsId: "sanity-court-1",
      startsAt: "2026-08-01T10:00:00.000Z",
      ruleset: "golden_point",
      pairings: guests,
    });
    const atCourt2 = await create.execute({
      venueCmsId: "sanity-court-2",
      startsAt: "2026-08-20T10:00:00.000Z",
      ruleset: "golden_point",
      pairings: guests,
    });
    await lock.execute({ matchId: atCourt1.id, score: scoreA, winner: "A" });
    await lock.execute({ matchId: atCourt2.id, score: scoreA, winner: "A" });

    const findByCmsId = jest.spyOn(venues, "findByCmsId");
    const findByCmsIds = jest.spyOn(venues, "findByCmsIds");

    const history = await new ListLockedMatchesByPlayer(matches, venues).execute(
      "user-riley",
    );

    expect(history.map((item) => item.venueCmsId).sort()).toEqual([
      "sanity-court-1",
      "sanity-court-2",
    ]);
    expect(findByCmsIds).toHaveBeenCalledTimes(1);
    expect(findByCmsIds.mock.calls[0][0].map((cmsId) => cmsId.value).sort()).toEqual(
      ["sanity-court-1", "sanity-court-2"],
    );
    expect(findByCmsId).not.toHaveBeenCalled();
  });

  test("history items do not invent a winner", () => {
    const item = toHistoryItem(
      {
        id: "match-1",
        venueCmsId: "sanity-court-1",
        startsAt: "2026-08-29T10:00:00.000Z",
        ruleset: "golden_point",
        status: "locked",
        servingTeam: "A",
        pairings: {
          teamA: [
            { slot: "A1", userId: null, displayName: "Alex", isGuest: true },
            { slot: "A2", userId: null, displayName: "Sam", isGuest: true },
          ],
          teamB: [
            { slot: "B1", userId: null, displayName: "Jordan", isGuest: true },
            { slot: "B2", userId: "user-riley", displayName: "Riley", isGuest: false },
          ],
        },
        score: scoreA,
        winner: null,
        lockedAt: "2026-08-29T11:00:00.000Z",
      },
      { name: "Padel Club", slug: "padel-club" },
      [],
    );

    expect(item.winner).toBeNull();
    expect(item.score).toEqual(scoreA);
  });
});
