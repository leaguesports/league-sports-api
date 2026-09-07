import { InMemoryDartsMatchRepository } from "../../darts/repositories/in-memory-darts-match.repository";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { InMemoryGolfRoundRepository } from "../../golf-round/repositories/in-memory-golf-round.repository";
import { InMemoryMatchRepository } from "../../match/repositories/in-memory-match.repository";
import { Team } from "../../teams/entities/team";
import { TeamName } from "../../teams/entities/team-name";
import { TeamSport } from "../../teams/entities/team-sport";
import { InMemoryTeamRepository } from "../../teams/repositories/in-memory-team.repository";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { TeamMatchForbiddenError } from "../entities/team-match-forbidden-error";
import { TeamMatchNotReadyError } from "../entities/team-match-not-ready-error";
import { TeamMatchSportMismatchError } from "../entities/team-match-sport-mismatch-error";
import { InMemoryTeamMatchRepository } from "../repositories/in-memory-team-match.repository";
import {
  AcceptTeamMatch,
  CancelTeamMatch,
  CompleteTeamMatch,
  CreateTeamMatch,
  DeclineTeamMatch,
  JoinTeamMatch,
  ListMyTeamMatches,
  ScheduleTeamMatch,
  SetTeamMatchLineup,
  StartTeamMatch,
} from "./team-matches.service";
import { CreateDartsMatch } from "../../darts/services/create-darts-match.service";
import { CreateGolfRound } from "../../golf-round/services/create-golf-round.service";
import { CreateMatch } from "../../match/services/create-match.service";

async function becomeFriends(
  friendships: InMemoryFriendshipRepository,
  a: string,
  b: string,
) {
  const pending = await friendships.createPending(a, b);
  await friendships.accept(pending.id);
}

async function seedTeam(
  teams: InMemoryTeamRepository,
  friendships: InMemoryFriendshipRepository,
  ownerId: string,
  name: string,
  sport: string,
  extraMemberIds: string[] = [],
) {
  const team = Team.create({
    name: TeamName.from(name),
    sport: TeamSport.from(sport),
    createdBy: ownerId,
  });
  for (const memberId of extraMemberIds) {
    await becomeFriends(friendships, ownerId, memberId);
    team.inviteFriend(ownerId, memberId);
  }
  return teams.create(team);
}

function setup() {
  const teams = new InMemoryTeamRepository();
  const matches = new InMemoryTeamMatchRepository();
  const friendships = new InMemoryFriendshipRepository();
  const profiles = new InMemoryFriendProfileLookup();
  const venues = new InMemoryVenueRepository();
  const padel = new InMemoryMatchRepository();
  const golf = new InMemoryGolfRoundRepository();
  const darts = new InMemoryDartsMatchRepository();

  for (const [userId, displayName, handle] of [
    ["user-a", "Alex", "alex"],
    ["user-a2", "Avery", "avery"],
    ["user-b", "Blake", "blake"],
    ["user-b2", "Blair", "blair"],
    ["user-c", "Casey", "casey"],
  ] as const) {
    profiles.seed({ userId, displayName, handle, avatarUrl: null });
  }

  return {
    teams,
    matches,
    friendships,
    profiles,
    venues,
    padel,
    golf,
    darts,
    create: new CreateTeamMatch(teams, matches, profiles),
    join: new JoinTeamMatch(teams, matches, profiles),
    accept: new AcceptTeamMatch(teams, matches, profiles),
    decline: new DeclineTeamMatch(teams, matches, profiles),
    schedule: new ScheduleTeamMatch(teams, matches, profiles),
    lineup: new SetTeamMatchLineup(teams, matches, profiles),
    cancel: new CancelTeamMatch(teams, matches, profiles),
    complete: new CompleteTeamMatch(teams, matches, profiles),
    listMine: new ListMyTeamMatches(teams, matches, profiles),
    start: new StartTeamMatch(
      teams,
      matches,
      profiles,
      venues,
      new CreateMatch(padel, venues),
      new CreateGolfRound(golf, venues),
      new CreateDartsMatch(darts, venues),
    ),
  };
}

describe("team match services", () => {
  test("creates a targeted challenge and rejects sport mismatch", async () => {
    const ctx = setup();
    const home = await seedTeam(ctx.teams, ctx.friendships, "user-a", "Smash", "padel");
    const away = await seedTeam(ctx.teams, ctx.friendships, "user-b", "Drive", "golf");

    await expect(
      ctx.create.execute({
        userId: "user-a",
        homeTeamId: home.id,
        awayTeamId: away.id,
      }),
    ).rejects.toBeInstanceOf(TeamMatchSportMismatchError);

    const golfAway = await seedTeam(
      ctx.teams,
      ctx.friendships,
      "user-c",
      "Walls",
      "padel",
    );
    const created = await ctx.create.execute({
      userId: "user-a",
      homeTeamId: home.id,
      awayTeamId: golfAway.id,
      venueCmsId: "sanity-court-1",
    });
    expect(created.match).toMatchObject({
      sport: "padel",
      status: "pending",
      homeTeam: { id: home.id, name: "Smash" },
      awayTeam: { id: golfAway.id, name: "Walls" },
      challengeToken: null,
      viewer: { role: "home_staff" },
    });
  });

  test("open challenge join, accept/decline, lineup, schedule, start, complete", async () => {
    const ctx = setup();
    await ctx.venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-court-1"),
        VenueName.from("Padel Club"),
        Slug.from("padel-club"),
      ),
      { refreshDetails: false },
    );

    const home = await seedTeam(
      ctx.teams,
      ctx.friendships,
      "user-a",
      "Smash",
      "padel",
      ["user-a2"],
    );
    const away = await seedTeam(
      ctx.teams,
      ctx.friendships,
      "user-b",
      "Walls",
      "padel",
      ["user-b2"],
    );

    const open = await ctx.create.execute({
      userId: "user-a",
      homeTeamId: home.id,
      generateChallengeLink: true,
      venueCmsId: "sanity-court-1",
    });
    expect(open.match.challengeToken).toHaveLength(32);
    expect(open.match.awayTeam).toBeNull();

    const joined = await ctx.join.execute({
      userId: "user-b",
      token: open.match.challengeToken,
      teamId: away.id,
    });
    expect(joined.match.status).toBe("scheduled");
    expect(joined.match.awayTeam?.id).toBe(away.id);

    const targeted = await ctx.create.execute({
      userId: "user-a",
      homeTeamId: home.id,
      awayTeamId: away.id,
      venueCmsId: "sanity-court-1",
    });
    await expect(
      ctx.accept.execute({ userId: "user-a", matchId: targeted.match.id }),
    ).rejects.toBeInstanceOf(TeamMatchForbiddenError);
    const declined = await ctx.decline.execute({
      userId: "user-b",
      matchId: targeted.match.id,
    });
    expect(declined.match.status).toBe("declined");

    const accepted = await ctx.create.execute({
      userId: "user-a",
      homeTeamId: home.id,
      awayTeamId: away.id,
      venueCmsId: "sanity-court-1",
    });
    await ctx.accept.execute({ userId: "user-b", matchId: accepted.match.id });
    await ctx.schedule.execute({
      userId: "user-a",
      matchId: accepted.match.id,
      startsAt: "2026-09-08T18:00:00.000Z",
      hasStartsAt: true,
      hasVenueCmsId: false,
    });
    await ctx.lineup.execute({
      userId: "user-a",
      matchId: accepted.match.id,
      userIds: ["user-a", "user-a2"],
    });
    await ctx.lineup.execute({
      userId: "user-b",
      matchId: accepted.match.id,
      userIds: ["user-b", "user-b2"],
    });

    const started = await ctx.start.execute({
      userId: "user-a",
      matchId: accepted.match.id,
    });
    expect(started.match.status).toBe("live");
    expect(started.scorecard).toMatchObject({
      sport: "padel",
      path: `/padel/${started.scorecard.id}`,
    });
    expect(await ctx.padel.findById(started.scorecard.id)).not.toBeNull();

    const completed = await ctx.complete.execute({
      userId: "user-a",
      matchId: accepted.match.id,
      winnerTeamId: home.id,
    });
    expect(completed.match).toMatchObject({
      status: "completed",
      winnerTeamId: home.id,
    });

    const mine = await ctx.listMine.execute({ userId: "user-a" });
    expect(mine.upcoming.some((row) => row.id === joined.match.id)).toBe(true);
    expect(mine.recent.some((row) => row.id === completed.match.id)).toBe(true);
  });

  test("member cannot create, cancel, or set the other team's lineup", async () => {
    const ctx = setup();
    const home = await seedTeam(
      ctx.teams,
      ctx.friendships,
      "user-a",
      "Smash",
      "darts",
      ["user-a2"],
    );
    const away = await seedTeam(
      ctx.teams,
      ctx.friendships,
      "user-b",
      "Arrows",
      "darts",
    );

    await expect(
      ctx.create.execute({
        userId: "user-a2",
        homeTeamId: home.id,
        awayTeamId: away.id,
      }),
    ).rejects.toBeInstanceOf(TeamMatchForbiddenError);

    const created = await ctx.create.execute({
      userId: "user-a",
      homeTeamId: home.id,
      awayTeamId: away.id,
    });
    await expect(
      ctx.cancel.execute({ userId: "user-b", matchId: created.match.id }),
    ).rejects.toBeInstanceOf(TeamMatchForbiddenError);
    await expect(
      ctx.lineup.execute({
        userId: "user-a",
        matchId: created.match.id,
        teamId: away.id,
        userIds: ["user-b"],
      }),
    ).rejects.toBeInstanceOf(TeamMatchForbiddenError);
  });

  test("cannot start without accepted opponent or valid lineups", async () => {
    const ctx = setup();
    const home = await seedTeam(ctx.teams, ctx.friendships, "user-a", "Smash", "darts");
    const away = await seedTeam(ctx.teams, ctx.friendships, "user-b", "Arrows", "darts");
    const created = await ctx.create.execute({
      userId: "user-a",
      homeTeamId: home.id,
      awayTeamId: away.id,
    });
    await expect(
      ctx.start.execute({ userId: "user-a", matchId: created.match.id }),
    ).rejects.toBeInstanceOf(TeamMatchNotReadyError);
  });
});
