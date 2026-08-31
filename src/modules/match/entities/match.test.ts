import { CmsId } from "../../venue/entities/cms-id";
import { DomainError } from "../../../lib/domain-error";
import { Match } from "./match";
import { MatchLockConflictError } from "./match-lock-conflict-error";
import { MatchPlayer } from "./match-player";
import { MatchScore } from "./match-score";
import { Pairings } from "./pairings";
import { PlayerSlot } from "./player-slot";
import { Ruleset } from "./ruleset";
import { StartsAt } from "./starts-at";
import { Team } from "./team";

const guest = (displayName: string) => ({
  displayName,
  isGuest: true as const,
  userId: null,
});

const user = (userId: string, displayName: string) => ({
  displayName,
  isGuest: false as const,
  userId,
});

const fourGuests = {
  teamA: [guest("Alex"), guest("Sam")] as [ReturnType<typeof guest>, ReturnType<typeof guest>],
  teamB: [guest("Jordan"), guest("Riley")] as [ReturnType<typeof guest>, ReturnType<typeof guest>],
};

function createLiveMatch() {
  return Match.create({
    venueCmsId: CmsId.from("sanity-court-1"),
    startsAt: StartsAt.from("2026-08-29T10:00:00.000Z"),
    ruleset: Ruleset.from("golden_point"),
    pairings: fourGuests,
    servingTeam: Team.A,
  });
}

const lockScore = {
  sets: [{ gamesA: 6, gamesB: 4, tieBreak: null, winner: "A" as const }],
};

describe("match value objects", () => {
  test("ruleset rejects unknown values", () => {
    expect(() => Ruleset.from("deuce")).toThrow(DomainError);
  });

  test("guest players cannot carry a userId", () => {
    expect(() =>
      MatchPlayer.from(PlayerSlot.A1, {
        displayName: "Alex",
        isGuest: true,
        userId: "user-1",
      }),
    ).toThrow(DomainError);
  });

  test("named players require a userId", () => {
    expect(() =>
      MatchPlayer.from(PlayerSlot.A1, {
        displayName: "Alex",
        isGuest: false,
        userId: null,
      }),
    ).toThrow(DomainError);
  });

  test("startsAt rejects blank and invalid dates", () => {
    expect(() => StartsAt.from("")).toThrow(DomainError);
    expect(() => StartsAt.from("not-a-date")).toThrow(DomainError);
  });
});

describe(Match, () => {
  test("create assigns an id, keys venue by cmsId, and starts live", () => {
    const match = createLiveMatch();

    expect(match.id).toBeTruthy();
    expect(match.toSnapshot()).toEqual({
      id: match.id,
      venueCmsId: "sanity-court-1",
      startsAt: "2026-08-29T10:00:00.000Z",
      ruleset: "golden_point",
      status: "live",
      servingTeam: "A",
      pairings: {
        teamA: [
          { slot: "A1", userId: null, displayName: "Alex", isGuest: true },
          { slot: "A2", userId: null, displayName: "Sam", isGuest: true },
        ],
        teamB: [
          { slot: "B1", userId: null, displayName: "Jordan", isGuest: true },
          { slot: "B2", userId: null, displayName: "Riley", isGuest: true },
        ],
      },
      score: null,
      winner: null,
      lockedAt: null,
    });
  });

  test("create requires four players across explicit slots", () => {
    expect(() =>
      Pairings.from({
        teamA: [guest("Alex")] as unknown as [ReturnType<typeof guest>, ReturnType<typeof guest>],
        teamB: [guest("Jordan"), guest("Riley")],
      }),
    ).toThrow(DomainError);
  });

  test("lock writes the result once and is idempotent for the same score", () => {
    const match = createLiveMatch();
    const lockedAt = new Date("2026-08-29T11:00:00.000Z");

    match.lock(MatchScore.from(lockScore), Team.A, lockedAt);
    match.lock(MatchScore.from(lockScore), Team.A, new Date("2026-08-29T12:00:00.000Z"));

    expect(match.toSnapshot()).toMatchObject({
      status: "locked",
      winner: "A",
      lockedAt: "2026-08-29T11:00:00.000Z",
      score: lockScore,
    });
  });

  test("lock conflicts when the match is already locked with a different result", () => {
    const match = createLiveMatch();
    match.lock(MatchScore.from(lockScore), Team.A);

    expect(() =>
      match.lock(
        MatchScore.from({
          sets: [{ gamesA: 4, gamesB: 6, winner: "B" }],
        }),
        Team.B,
      ),
    ).toThrow(MatchLockConflictError);
  });

  test("mixed guest and user pairings map to A1 A2 B1 B2", () => {
    const match = Match.create({
      venueCmsId: CmsId.from("sanity-court-1"),
      startsAt: StartsAt.from("2026-08-29T10:00:00.000Z"),
      ruleset: Ruleset.from("advantage"),
      pairings: {
        teamA: [user("user-1", "Alex"), guest("Sam")],
        teamB: [guest("Jordan"), user("user-2", "Riley")],
      },
    });

    expect(match.toSnapshot().pairings).toEqual({
      teamA: [
        { slot: "A1", userId: "user-1", displayName: "Alex", isGuest: false },
        { slot: "A2", userId: null, displayName: "Sam", isGuest: true },
      ],
      teamB: [
        { slot: "B1", userId: null, displayName: "Jordan", isGuest: true },
        { slot: "B2", userId: "user-2", displayName: "Riley", isGuest: false },
      ],
    });
  });
});
