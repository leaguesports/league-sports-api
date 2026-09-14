import {
  acceptedFriendIds,
  computeFriendsPlayed,
  FRIENDS_PLAYED_LIMIT,
} from "./friends-played";
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
    golfHolesPlayed: props.golfHolesPlayed ?? null,
  });
}

describe("acceptedFriendIds", () => {
  test("keeps accepted friends and drops pending requests", () => {
    expect(
      acceptedFriendIds("viewer", [
        { requesterId: "viewer", addresseeId: "alex", status: "accepted" },
        { requesterId: "blake", addresseeId: "viewer", status: "pending" },
        { requesterId: "viewer", addresseeId: "casey", status: "accepted" },
      ]),
    ).toEqual(new Set(["alex", "casey"]));
  });
});

describe("computeFriendsPlayed", () => {
  test("intersects friends with locked facts and excludes strangers", () => {
    const result = computeFriendsPlayed({
      friendUserIds: new Set(["alex", "blake"]),
      optedOutUserIds: new Set(),
      profiles,
      facts: [
        fact({ userId: "alex", eventId: "m1", lockedAt: "2026-09-10T10:00:00.000Z" }),
        fact({ userId: "casey", eventId: "m2", lockedAt: "2026-09-11T10:00:00.000Z" }),
      ],
    });

    expect(result.total).toBe(1);
    expect(result.friends).toEqual([
      {
        userId: "alex",
        displayName: "Alex P.",
        avatarUrl: "a.png",
        lastPlayedAt: "2026-09-10T10:00:00.000Z",
        summary: null,
      },
    ]);
  });

  test("excludes opted-out friends (appearOnVenueLeaderboards)", () => {
    const result = computeFriendsPlayed({
      friendUserIds: new Set(["alex", "blake"]),
      optedOutUserIds: new Set(["alex"]),
      profiles,
      facts: [
        fact({ userId: "alex", eventId: "m1", lockedAt: "2026-09-10T10:00:00.000Z" }),
        fact({ userId: "blake", eventId: "m2", lockedAt: "2026-09-09T10:00:00.000Z" }),
      ],
    });

    expect(result.total).toBe(1);
    expect(result.friends.map((row) => row.userId)).toEqual(["blake"]);
  });

  test("sorts by most recent lock and caps at 6 while keeping total", () => {
    const facts = Array.from({ length: 8 }, (_, index) =>
      fact({
        userId: `friend-${index}`,
        eventId: `m${index}`,
        lockedAt: new Date(Date.UTC(2026, 8, 1 + index)).toISOString(),
      }),
    );
    const friendProfiles = new Map(
      facts.map((row, index) => [
        row.userId,
        {
          userId: row.userId,
          firstName: `Friend${index}`,
          lastName: "User",
          avatarUrl: null,
        },
      ]),
    );

    const result = computeFriendsPlayed({
      friendUserIds: new Set(facts.map((row) => row.userId)),
      optedOutUserIds: new Set(),
      profiles: friendProfiles,
      facts,
    });

    expect(result.total).toBe(8);
    expect(result.friends).toHaveLength(FRIENDS_PLAYED_LIMIT);
    expect(result.friends.map((row) => row.userId)).toEqual([
      "friend-7",
      "friend-6",
      "friend-5",
      "friend-4",
      "friend-3",
      "friend-2",
    ]);
    expect(result.friends[0]?.lastPlayedAt).toBe("2026-09-08T00:00:00.000Z");
  });

  test("uses lastPlayedAt from the latest lock when a friend has several events", () => {
    const result = computeFriendsPlayed({
      friendUserIds: new Set(["alex"]),
      optedOutUserIds: new Set(),
      profiles,
      facts: [
        fact({ userId: "alex", eventId: "m1", lockedAt: "2026-09-01T10:00:00.000Z" }),
        fact({ userId: "alex", eventId: "m2", lockedAt: "2026-09-12T14:00:00.000Z" }),
      ],
    });

    expect(result.friends[0]?.lastPlayedAt).toBe("2026-09-12T14:00:00.000Z");
  });

  test("adds golf bestGross/bestNet from 18-hole rounds and omits padel/darts summaries", () => {
    const result = computeFriendsPlayed({
      friendUserIds: new Set(["blake", "drew"]),
      optedOutUserIds: new Set(),
      profiles,
      facts: [
        fact({
          userId: "blake",
          sport: "golf",
          eventId: "g1",
          lockedAt: "2026-09-01T08:00:00.000Z",
          golfGross: 82,
          golfNet: 74,
          golfHolesPlayed: 18,
        }),
        fact({
          userId: "blake",
          sport: "golf",
          eventId: "g2",
          lockedAt: "2026-09-10T08:00:00.000Z",
          golfGross: 78,
          golfNet: 72,
          golfHolesPlayed: 18,
        }),
        fact({
          userId: "blake",
          sport: "golf",
          eventId: "g9",
          lockedAt: "2026-09-11T08:00:00.000Z",
          golfGross: 36,
          golfNet: 34,
          golfHolesPlayed: 9,
        }),
        fact({
          userId: "drew",
          sport: "darts",
          eventId: "d1",
          lockedAt: "2026-09-12T08:00:00.000Z",
          won: true,
        }),
      ],
    });

    expect(result.friends).toEqual([
      expect.objectContaining({
        userId: "drew",
        displayName: "Drew D.",
        summary: null,
      }),
      expect.objectContaining({
        userId: "blake",
        displayName: "Blake G.",
        summary: { sport: "golf", bestGross: 78, bestNet: 72 },
      }),
    ]);
  });
});
