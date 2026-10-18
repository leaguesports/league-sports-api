import { DomainError } from "../../../lib/domain-error";
import { InMemoryGolfRoundRepository } from "../../golf-round/repositories/in-memory-golf-round.repository";
import { GolfRound } from "../../golf-round/entities/golf-round";
import { StartsAt as GolfStartsAt } from "../../golf-round/entities/starts-at";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { Match } from "../../match/entities/match";
import { PairingsInput } from "../../match/entities/pairings";
import { Ruleset } from "../../match/entities/ruleset";
import { StartsAt } from "../../match/entities/starts-at";
import { InMemoryMatchRepository } from "../../match/repositories/in-memory-match.repository";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { InMemoryCommunityRepository } from "../repositories/in-memory-community.repository";
import {
  CommunityNotFoundError,
  CreateCommunity,
  JoinCommunity,
} from "./communities.service";
import { COMMUNITY_ACTIVITY_LIMIT } from "./community-activity-item";
import { ListCommunityActivity } from "./list-community-activity.service";

const padelScore: {
  sets: Array<{
    gamesA: number;
    gamesB: number;
    tieBreak: { pointsA: number; pointsB: number } | null;
    winner: "A" | "B";
  }>;
} = {
  sets: [{ gamesA: 6, gamesB: 4, tieBreak: null, winner: "A" }],
};

const courseHoles9 = Array.from({ length: 9 }, (_, index) => ({
  number: index + 1,
  par: ((index % 3) + 3) as 3 | 4 | 5,
  strokeIndex: index + 1,
}));

function memberPairings(
  userId: string,
  displayName: string,
): PairingsInput {
  return {
    teamA: [
      { displayName, isGuest: false, userId },
      { displayName: "Sam Guest", isGuest: true, userId: null },
    ],
    teamB: [
      { displayName: "Jordan Guest", isGuest: true, userId: null },
      { displayName: "Riley Guest", isGuest: true, userId: null },
    ],
  };
}

function lockedPadel(props: {
  venueCmsId: string;
  startsAt: string;
  lockedAt: string;
  lockedByUserId: string;
  pairings: PairingsInput;
  score?: typeof padelScore;
}): Match {
  return Match.captureFinished({
    venueCmsId: CmsId.from(props.venueCmsId),
    startsAt: StartsAt.from(props.startsAt),
    ruleset: Ruleset.from("golden_point"),
    pairings: props.pairings,
    score: props.score ?? padelScore,
    winner: "A",
    lockedByUserId: props.lockedByUserId,
    lockedAt: new Date(props.lockedAt),
  });
}

function lockedGolf(props: {
  venueCmsId: string;
  startsAt: string;
  lockedAt: string;
  lockedByUserId: string;
  players: Array<{
    slot: 1 | 2 | 3 | 4;
    displayName: string;
    isGuest: boolean;
    userId: string | null;
  }>;
}): GolfRound {
  const slots = props.players.map((player) => player.slot);
  return GolfRound.captureFinished({
    venueCmsId: CmsId.from(props.venueCmsId),
    startsAt: GolfStartsAt.from(props.startsAt),
    holesPlayed: 9,
    startingHole: 1,
    teeName: "White",
    course: { name: "Links Nine", holes: courseHoles9 },
    players: props.players,
    score: {
      holes: courseHoles9.map((hole) => ({
        number: hole.number,
        strokes: Object.fromEntries(slots.map((slot) => [String(slot), 4])),
      })),
    },
    lockedByUserId: props.lockedByUserId,
    lockedAt: new Date(props.lockedAt),
  });
}

describe("ListCommunityActivity", () => {
  async function setup() {
    const communities = new InMemoryCommunityRepository();
    const matches = new InMemoryMatchRepository();
    const golfRounds = new InMemoryGolfRoundRepository();
    const venues = new InMemoryVenueRepository();
    const profiles = new InMemoryFriendProfileLookup();
    profiles.seed({
      userId: "user-a",
      displayName: "Alex",
      handle: "alex",
      avatarUrl: null,
    });
    profiles.seed({
      userId: "user-b",
      displayName: "Blake",
      handle: "blake",
      avatarUrl: null,
    });
    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-court-1"),
        VenueName.from("Padel Club"),
        Slug.from("padel-club"),
      ),
      { refreshDetails: false },
    );
    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-course-1"),
        VenueName.from("Golf Club"),
        Slug.from("golf-club"),
      ),
      { refreshDetails: false },
    );

    return {
      communities,
      matches,
      golfRounds,
      venues,
      create: new CreateCommunity(communities, profiles),
      join: new JoinCommunity(communities, profiles),
      activity: new ListCommunityActivity(
        communities,
        matches,
        golfRounds,
        venues,
      ),
    };
  }

  test("unknown community is not found", async () => {
    const { activity } = await setup();
    await expect(
      activity.execute({ communityId: "missing" }),
    ).rejects.toBeInstanceOf(CommunityNotFoundError);
    await expect(activity.execute({ communityId: "  " })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  test("returns empty items when members have no locked results", async () => {
    const { create, matches, activity } = await setup();
    const created = await create.execute({
      userId: "user-a",
      name: "Sunday Beers",
      city: "Cape Town",
      sport: "padel",
    });

    const live = Match.create({
      venueCmsId: CmsId.from("sanity-court-1"),
      startsAt: StartsAt.from("2026-08-29T10:00:00.000Z"),
      ruleset: Ruleset.from("golden_point"),
      pairings: memberPairings("user-a", "Alex"),
    });
    await matches.create(live);

    const outsider = lockedPadel({
      venueCmsId: "sanity-court-1",
      startsAt: "2026-08-29T09:00:00.000Z",
      lockedAt: "2026-08-29T11:00:00.000Z",
      lockedByUserId: "user-outsider",
      pairings: memberPairings("user-outsider", "Outsider"),
    });
    await matches.create(outsider);

    const result = await activity.execute({
      communityId: created.community.id,
    });
    expect(result).toEqual({ items: [] });
  });

  test("lists locked padel and golf results involving members, newest lockedAt first", async () => {
    const { create, join, matches, golfRounds, activity } = await setup();
    const created = await create.execute({
      userId: "user-a",
      name: "Multi Sport Sundays",
      city: "Joburg",
      sport: "multi",
    });
    await join.execute({
      userId: "user-b",
      communityId: created.community.id,
    });

    const olderPadel = lockedPadel({
      venueCmsId: "sanity-court-1",
      startsAt: "2026-08-29T10:00:00.000Z",
      lockedAt: "2026-08-29T11:00:00.000Z",
      lockedByUserId: "user-a",
      pairings: memberPairings("user-a", "Alex"),
    });
    const bothMembers = lockedPadel({
      venueCmsId: "sanity-court-1",
      startsAt: "2026-08-30T10:00:00.000Z",
      lockedAt: "2026-08-30T12:00:00.000Z",
      lockedByUserId: "user-a",
      pairings: {
        teamA: [
          { displayName: "Alex Lange", isGuest: false, userId: "user-a" },
          { displayName: "Sam Guest", isGuest: true, userId: null },
        ],
        teamB: [
          { displayName: "Blake Rivers", isGuest: false, userId: "user-b" },
          { displayName: "Riley Guest", isGuest: true, userId: null },
        ],
      },
      score: {
        sets: [
          { gamesA: 6, gamesB: 4, tieBreak: null, winner: "A" },
          {
            gamesA: 7,
            gamesB: 6,
            tieBreak: { pointsA: 7, pointsB: 5 },
            winner: "A",
          },
        ],
      },
    });
    const golf = lockedGolf({
      venueCmsId: "sanity-course-1",
      startsAt: "2026-09-04T10:00:00.000Z",
      lockedAt: "2026-09-04T12:00:00.000Z",
      lockedByUserId: "user-b",
      players: [
        {
          slot: 1,
          displayName: "Blake",
          isGuest: false,
          userId: "user-b",
        },
        { slot: 2, displayName: "Casey Guest", isGuest: true, userId: null },
      ],
    });

    await matches.create(olderPadel);
    await matches.create(bothMembers);
    await golfRounds.create(golf);

    const live = Match.create({
      venueCmsId: CmsId.from("sanity-court-1"),
      startsAt: StartsAt.from("2026-09-05T10:00:00.000Z"),
      ruleset: Ruleset.from("golden_point"),
      pairings: memberPairings("user-a", "Alex"),
    });
    await matches.create(live);

    const result = await activity.execute({
      communityId: created.community.id,
    });

    expect(result.items.map((item) => item.id)).toEqual([
      golf.id,
      bothMembers.id,
      olderPadel.id,
    ]);
    expect(result.items[0]).toMatchObject({
      id: golf.id,
      sport: "golf",
      kind: "round",
      lockedAt: "2026-09-04T12:00:00.000Z",
      venueCmsId: "sanity-course-1",
      venueName: "Golf Club",
      path: `/golf/${golf.id}`,
      summary: "Blake 36 · Casey 36",
      players: [
        { userId: "user-b", displayName: "Blake", isGuest: false },
        { userId: null, displayName: "Casey Guest", isGuest: true },
      ],
    });
    expect(result.items[1]).toMatchObject({
      id: bothMembers.id,
      sport: "padel",
      kind: "match",
      lockedAt: "2026-08-30T12:00:00.000Z",
      venueCmsId: "sanity-court-1",
      venueName: "Padel Club",
      path: `/padel/${bothMembers.id}`,
      summary: "Alex / Sam vs Blake / Riley · 6–4, 7–6 (7–5)",
    });
    expect(result.items[1]?.players).toEqual([
      { userId: "user-a", displayName: "Alex Lange", isGuest: false },
      { userId: null, displayName: "Sam Guest", isGuest: true },
      { userId: "user-b", displayName: "Blake Rivers", isGuest: false },
      { userId: null, displayName: "Riley Guest", isGuest: true },
    ]);
  });

  test("caps the feed at the 30 most recent locked items", async () => {
    const { create, matches, activity } = await setup();
    const created = await create.execute({
      userId: "user-a",
      name: "Busy League",
      city: "Cape Town",
    });

    const createdMatches: Match[] = [];
    for (let index = 0; index < COMMUNITY_ACTIVITY_LIMIT + 5; index += 1) {
      const lockedAt = new Date(Date.UTC(2026, 7, 1, 10, index)).toISOString();
      const match = lockedPadel({
        venueCmsId: "sanity-court-1",
        startsAt: lockedAt,
        lockedAt,
        lockedByUserId: "user-a",
        pairings: memberPairings("user-a", "Alex"),
      });
      createdMatches.push(match);
      await matches.create(match);
    }

    const result = await activity.execute({
      communityId: created.community.id,
    });
    expect(result.items).toHaveLength(COMMUNITY_ACTIVITY_LIMIT);
    expect(result.items[0]?.id).toBe(createdMatches.at(-1)?.id);
    expect(result.items.at(-1)?.id).toBe(
      createdMatches[createdMatches.length - COMMUNITY_ACTIVITY_LIMIT]?.id,
    );
  });
});
