import { VenueLeaderboardComputer, computeGrinder, computeHotStreak, computePotm } from "./board-computer";
import { LeaderboardBoard } from "./leaderboard-board";
import { LeaderboardWindow } from "./leaderboard-window";
import { publicBoardDisplayName } from "./public-display-name";
import { VenueEventFact } from "./venue-event-fact";

const profiles = new Map([
  ["alex", { userId: "alex", firstName: "Alex", lastName: "Player", avatarUrl: "a.png" }],
  ["blake", { userId: "blake", firstName: "Blake", lastName: "Golfer", avatarUrl: null }],
  ["casey", { userId: "casey", firstName: "Casey", lastName: "Padel", avatarUrl: null }],
  ["drew", { userId: "drew", firstName: "Drew", lastName: "Darts", avatarUrl: null }],
]);

function fact(props: {
  userId: string;
  sport?: "padel" | "golf" | "darts";
  eventId: string;
  lockedAt: string;
  won?: boolean | null;
  golfGross?: number | null;
  golfNet?: number | null;
  golfTeeId?: string | null;
  golfTeeName?: string | null;
  golfHolesPlayed?: number | null;
}): VenueEventFact {
  return VenueEventFact.create({
    venueCmsId: "sanity-venue-1",
    sport: props.sport ?? "padel",
    eventId: props.eventId,
    userId: props.userId,
    lockedAt: new Date(props.lockedAt),
    won: props.won ?? null,
    golfGross: props.golfGross ?? null,
    golfNet: props.golfNet ?? null,
    golfTeeId: props.golfTeeId ?? null,
    golfTeeName: props.golfTeeName ?? null,
    golfHolesPlayed: props.golfHolesPlayed ?? null,
  });
}

describe("publicBoardDisplayName", () => {
  test("uses first name and last initial", () => {
    expect(publicBoardDisplayName("Alex", "Player")).toBe("Alex P.");
  });
});

describe("POTM", () => {
  test("padel/darts ranks by wins, then more events, then earlier first win", () => {
    const facts = [
      fact({ userId: "alex", eventId: "m1", lockedAt: "2026-09-02T08:00:00.000Z", won: true }),
      fact({ userId: "blake", eventId: "m2", lockedAt: "2026-09-01T08:00:00.000Z", won: true }),
      fact({ userId: "blake", eventId: "m3", lockedAt: "2026-09-03T08:00:00.000Z", won: false }),
      fact({ userId: "casey", eventId: "m4", lockedAt: "2026-09-04T08:00:00.000Z", won: true }),
    ];

    const entries = computePotm(facts, profiles);
    expect(entries.map((row) => row.userId)).toEqual(["blake", "alex", "casey"]);
    expect(entries[0]).toMatchObject({
      rank: 1,
      displayName: "Blake G.",
      stats: { wins: 1, events: 2 },
    });
    expect(entries[1]?.stats).toEqual({ wins: 1, events: 1 });
    expect(entries[1]?.userId).toBe("alex");
  });

  test("golf uses net average when a player has ≥3 locked 18-hole nets", () => {
    const facts = [
      fact({
        userId: "alex",
        sport: "golf",
        eventId: "g1",
        lockedAt: "2026-09-01T08:00:00.000Z",
        golfNet: 72,
        golfGross: 80,
        golfHolesPlayed: 18,
        golfTeeName: "White",
      }),
      fact({
        userId: "alex",
        sport: "golf",
        eventId: "g2",
        lockedAt: "2026-09-02T08:00:00.000Z",
        golfNet: 70,
        golfGross: 78,
        golfHolesPlayed: 18,
        golfTeeName: "White",
      }),
      fact({
        userId: "alex",
        sport: "golf",
        eventId: "g3",
        lockedAt: "2026-09-03T08:00:00.000Z",
        golfNet: 68,
        golfGross: 76,
        golfHolesPlayed: 18,
        golfTeeName: "White",
      }),
      fact({
        userId: "blake",
        sport: "golf",
        eventId: "g4",
        lockedAt: "2026-09-01T09:00:00.000Z",
        golfNet: 71,
        golfGross: 79,
        golfHolesPlayed: 18,
        golfTeeName: "White",
      }),
      fact({
        userId: "blake",
        sport: "golf",
        eventId: "g5",
        lockedAt: "2026-09-02T09:00:00.000Z",
        golfNet: 71,
        golfGross: 79,
        golfHolesPlayed: 18,
        golfTeeName: "White",
      }),
    ];

    const entries = computePotm(facts, profiles);
    expect(entries.map((row) => row.userId)).toEqual(["alex"]);
    expect(entries[0]?.stats).toEqual({
      netAverage: 70,
      events: 3,
      netRounds: 3,
    });
  });

  test("golf falls back to most rounds when nobody has ≥3 net 18-hole rounds", () => {
    const facts = [
      fact({
        userId: "alex",
        sport: "golf",
        eventId: "g1",
        lockedAt: "2026-09-02T08:00:00.000Z",
        golfNet: 70,
        golfHolesPlayed: 18,
      }),
      fact({
        userId: "alex",
        sport: "golf",
        eventId: "g2",
        lockedAt: "2026-09-03T08:00:00.000Z",
        golfNet: 71,
        golfHolesPlayed: 18,
      }),
      fact({
        userId: "blake",
        sport: "golf",
        eventId: "g3",
        lockedAt: "2026-09-01T08:00:00.000Z",
        golfGross: 88,
        golfHolesPlayed: 9,
      }),
    ];

    const entries = computePotm(facts, profiles);
    expect(entries.map((row) => row.userId)).toEqual(["alex", "blake"]);
    expect(entries[0]?.stats).toEqual({ events: 2 });
    expect(entries[1]?.stats).toEqual({ events: 1 });
  });

  test("golf net-average ties break on more events, then earlier first event", () => {
    const facts = [
      ...[1, 2, 3].map((n) =>
        fact({
          userId: "alex",
          sport: "golf",
          eventId: `a${n}`,
          lockedAt: `2026-09-0${n + 1}T08:00:00.000Z`,
          golfNet: 72,
          golfHolesPlayed: 18,
        }),
      ),
      ...[1, 2, 3, 4].map((n) =>
        fact({
          userId: "blake",
          sport: "golf",
          eventId: `b${n}`,
          lockedAt: `2026-09-0${n}T10:00:00.000Z`,
          golfNet: 72,
          golfHolesPlayed: 18,
        }),
      ),
    ];

    const entries = computePotm(facts, profiles);
    expect(entries[0]?.userId).toBe("blake");
    expect(entries[0]?.stats.events).toBe(4);
  });
});

describe("The Grinder", () => {
  test("requires ≥3 locked events to appear", () => {
    const facts = [
      fact({ userId: "alex", eventId: "m1", lockedAt: "2026-09-01T08:00:00.000Z", won: true }),
      fact({ userId: "alex", eventId: "m2", lockedAt: "2026-09-02T08:00:00.000Z", won: false }),
      fact({ userId: "blake", eventId: "m3", lockedAt: "2026-09-01T08:00:00.000Z", won: true }),
      fact({ userId: "blake", eventId: "m4", lockedAt: "2026-09-02T08:00:00.000Z", won: true }),
      fact({ userId: "blake", eventId: "m5", lockedAt: "2026-09-03T08:00:00.000Z", won: false }),
    ];

    const entries = computeGrinder(facts, profiles);
    expect(entries.map((row) => row.userId)).toEqual(["blake"]);
    expect(entries[0]?.stats).toEqual({ events: 3 });
  });
});

describe("Hot streak", () => {
  test("includes only padel/darts current streaks of ≥2", () => {
    const facts = [
      fact({
        userId: "alex",
        sport: "padel",
        eventId: "p1",
        lockedAt: "2026-09-01T08:00:00.000Z",
        won: true,
      }),
      fact({
        userId: "alex",
        sport: "padel",
        eventId: "p2",
        lockedAt: "2026-09-02T08:00:00.000Z",
        won: true,
      }),
      fact({
        userId: "blake",
        sport: "darts",
        eventId: "d1",
        lockedAt: "2026-09-01T08:00:00.000Z",
        won: true,
      }),
      fact({
        userId: "casey",
        sport: "golf",
        eventId: "g1",
        lockedAt: "2026-09-01T08:00:00.000Z",
        golfGross: 72,
        golfHolesPlayed: 18,
      }),
      fact({
        userId: "drew",
        sport: "padel",
        eventId: "p3",
        lockedAt: "2026-09-01T08:00:00.000Z",
        won: true,
      }),
      fact({
        userId: "drew",
        sport: "padel",
        eventId: "p4",
        lockedAt: "2026-09-02T08:00:00.000Z",
        won: false,
      }),
    ];

    const entries = computeHotStreak(facts, profiles);
    expect(entries.map((row) => row.userId)).toEqual(["alex"]);
    expect(entries[0]?.stats).toEqual({ streak: 2 });
  });

  test("a loss resets the current streak even if older wins exist", () => {
    const facts = [
      fact({ userId: "alex", eventId: "m1", lockedAt: "2026-09-01T08:00:00.000Z", won: true }),
      fact({ userId: "alex", eventId: "m2", lockedAt: "2026-09-02T08:00:00.000Z", won: true }),
      fact({ userId: "alex", eventId: "m3", lockedAt: "2026-09-03T08:00:00.000Z", won: false }),
    ];
    expect(computeHotStreak(facts, profiles)).toEqual([]);
  });
});

describe("Records golf per tee", () => {
  test("tracks best locked 18-hole gross and net per tee; net only when computed", () => {
    const facts = [
      fact({
        userId: "alex",
        sport: "golf",
        eventId: "g1",
        lockedAt: "2026-09-01T08:00:00.000Z",
        golfGross: 74,
        golfNet: 70,
        golfTeeId: "tee-white",
        golfTeeName: "White",
        golfHolesPlayed: 18,
      }),
      fact({
        userId: "blake",
        sport: "golf",
        eventId: "g2",
        lockedAt: "2026-09-02T08:00:00.000Z",
        golfGross: 71,
        golfNet: null,
        golfTeeId: "tee-white",
        golfTeeName: "White",
        golfHolesPlayed: 18,
      }),
      fact({
        userId: "casey",
        sport: "golf",
        eventId: "g3",
        lockedAt: "2026-09-03T08:00:00.000Z",
        golfGross: 68,
        golfNet: 66,
        golfTeeId: "tee-blue",
        golfTeeName: "Blue",
        golfHolesPlayed: 18,
      }),
      fact({
        userId: "drew",
        sport: "golf",
        eventId: "g4",
        lockedAt: "2026-09-04T08:00:00.000Z",
        golfGross: 33,
        golfNet: 31,
        golfTeeName: "White",
        golfHolesPlayed: 9,
      }),
    ];

    const payload = VenueLeaderboardComputer.compute({
      board: LeaderboardBoard.records,
      window: LeaderboardWindow.all(),
      facts,
      profiles,
      optedOutUserIds: new Set(),
    });

    expect(payload.records?.golf.bestGrossByTee).toEqual([
      expect.objectContaining({
        teeId: "tee-blue",
        teeName: "Blue",
        userId: "casey",
        displayName: "Casey P.",
        stats: expect.objectContaining({ score: 68, eventId: "g3" }),
      }),
      expect.objectContaining({
        teeId: "tee-white",
        teeName: "White",
        userId: "blake",
        displayName: "Blake G.",
        stats: expect.objectContaining({ score: 71, eventId: "g2" }),
      }),
    ]);
    expect(payload.records?.golf.bestNetByTee).toEqual([
      expect.objectContaining({
        teeId: "tee-blue",
        userId: "casey",
        stats: expect.objectContaining({ score: 66 }),
      }),
      expect.objectContaining({
        teeId: "tee-white",
        userId: "alex",
        stats: expect.objectContaining({ score: 70 }),
      }),
    ]);
  });
});

describe("Johannesburg month window", () => {
  test("potm ignores wins outside the calendar month", () => {
    const facts = [
      fact({ userId: "alex", eventId: "old", lockedAt: "2026-08-31T21:00:00.000Z", won: true }),
      fact({ userId: "blake", eventId: "in", lockedAt: "2026-08-31T22:30:00.000Z", won: true }),
    ];
    const payload = VenueLeaderboardComputer.compute({
      board: LeaderboardBoard.potm,
      window: LeaderboardWindow.month("2026-09"),
      facts,
      profiles,
      optedOutUserIds: new Set(),
    });
    expect(payload.entries.map((row) => row.userId)).toEqual(["blake"]);
  });
});

describe("opt-out", () => {
  test("excludes the user from every board", () => {
    const facts = [
      fact({ userId: "alex", eventId: "m1", lockedAt: "2026-09-01T08:00:00.000Z", won: true }),
      fact({ userId: "alex", eventId: "m2", lockedAt: "2026-09-02T08:00:00.000Z", won: true }),
      fact({ userId: "alex", eventId: "m3", lockedAt: "2026-09-03T08:00:00.000Z", won: true }),
      fact({ userId: "blake", eventId: "m4", lockedAt: "2026-09-01T08:00:00.000Z", won: true }),
      fact({ userId: "blake", eventId: "m5", lockedAt: "2026-09-02T08:00:00.000Z", won: true }),
      fact({ userId: "blake", eventId: "m6", lockedAt: "2026-09-03T08:00:00.000Z", won: true }),
    ];
    const optedOut = new Set(["alex"]);

    const potm = VenueLeaderboardComputer.compute({
      board: LeaderboardBoard.potm,
      window: LeaderboardWindow.all(),
      facts,
      profiles,
      optedOutUserIds: optedOut,
    });
    expect(potm.entries.map((row) => row.userId)).toEqual(["blake"]);
    expect(potm.first?.userId).toBe("blake");

    const grinder = VenueLeaderboardComputer.compute({
      board: LeaderboardBoard.grinder,
      window: LeaderboardWindow.all(),
      facts,
      profiles,
      optedOutUserIds: optedOut,
    });
    expect(grinder.entries.map((row) => row.userId)).toEqual(["blake"]);

    const streak = VenueLeaderboardComputer.compute({
      board: LeaderboardBoard.streak,
      window: LeaderboardWindow.all(),
      facts,
      profiles,
      optedOutUserIds: optedOut,
    });
    expect(streak.entries.map((row) => row.userId)).toEqual(["blake"]);
  });
});
