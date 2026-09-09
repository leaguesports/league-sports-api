import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { CreateDartsMatch } from "../../darts/services/create-darts-match.service";
import { GetDartsMatchById } from "../../darts/services/get-darts-match-by-id.service";
import {
  FriendProfile,
  FriendProfileLookup,
} from "../../friends/repositories/friendship.repository";
import { CreateGolfRound } from "../../golf-round/services/create-golf-round.service";
import { GetGolfRoundById } from "../../golf-round/services/get-golf-round-by-id.service";
import { CreateMatch } from "../../match/services/create-match.service";
import { GetMatchById } from "../../match/services/get-match-by-id.service";
import { Team } from "../../teams/entities/team";
import { TeamForbiddenError } from "../../teams/entities/team-forbidden-error";
import { TeamNotFoundError } from "../../teams/entities/team-not-found-error";
import { TeamSport } from "../../teams/entities/team-sport";
import { TeamRepository } from "../../teams/repositories/team.repository";
import { CmsId } from "../../venue/entities/cms-id";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { defaultNineHoleCourse } from "../../organised-games/services/default-golf-course";
import { OptionalStartsAt } from "../entities/optional-starts-at";
import { OptionalVenueCmsId } from "../entities/optional-venue-cms-id";
import { TeamMatch } from "../entities/team-match";
import { TeamMatchAlreadyAcceptedError } from "../entities/team-match-already-accepted-error";
import { TeamMatchChallengeToken } from "../entities/team-match-challenge-token";
import { TeamMatchForbiddenError } from "../entities/team-match-forbidden-error";
import { TeamMatchNotFoundError } from "../entities/team-match-not-found-error";
import { TeamMatchNotReadyError } from "../entities/team-match-not-ready-error";
import { TeamMatchScorecard } from "../entities/team-match-scorecard";
import { TeamMatchSportMismatchError } from "../entities/team-match-sport-mismatch-error";
import { TeamMatchRepository } from "../repositories/team-match.repository";
import {
  dartsPlayersFromLineups,
  golfPlayersFromLineups,
  pairingsFromLineups,
  SeatedProfile,
} from "./seat-lineups";

export type PublicUser = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
};

export type PublicTeamRef = {
  id: string;
  name: string;
  sport: "padel" | "golf" | "darts";
};

export type PublicScorecard = {
  sport: "padel" | "golf" | "darts";
  id: string;
  path: string;
};

export type PublicTeamMatch = {
  id: string;
  sport: "padel" | "golf" | "darts";
  status:
    | "pending"
    | "scheduled"
    | "live"
    | "completed"
    | "declined"
    | "cancelled";
  homeTeam: PublicTeamRef;
  awayTeam: PublicTeamRef | null;
  venueCmsId: string | null;
  startsAt: string | null;
  challengeToken: string | null;
  lineups: {
    home: PublicUser[];
    away: PublicUser[];
  };
  scorecard: PublicScorecard | null;
  winnerTeamId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  viewer: {
    role: "home_staff" | "away_staff" | "member";
    teamId: string | null;
  };
};

async function resolveProfile(
  lookup: FriendProfileLookup,
  userId: string,
): Promise<FriendProfile> {
  const profile = await lookup.findByUserId(userId);
  if (profile) return profile;
  return {
    userId,
    displayName: "Player",
    handle: userId.slice(0, 8),
    avatarUrl: null,
  };
}

function toPublicUser(profile: FriendProfile): PublicUser {
  return {
    id: profile.userId,
    displayName: profile.displayName,
    handle: profile.handle,
    avatarUrl: profile.avatarUrl,
  };
}

function toTeamRef(team: Team): PublicTeamRef {
  return {
    id: team.id,
    name: team.name.value,
    sport: team.sport.value,
  };
}

function isStaff(team: Team, userId: string): boolean {
  const membership = team.membershipOf(userId);
  return membership?.status.isActive === true && membership.role.canInvite;
}

function requireStaff(team: Team, userId: string, message: string): void {
  if (!isStaff(team, userId)) {
    throw new TeamMatchForbiddenError(message);
  }
}

function viewerRole(
  userId: string,
  home: Team,
  away: Team | null,
): PublicTeamMatch["viewer"] {
  if (isStaff(home, userId)) {
    return { role: "home_staff", teamId: home.id };
  }
  if (away && isStaff(away, userId)) {
    return { role: "away_staff", teamId: away.id };
  }
  if (home.isActiveMember(userId)) {
    return { role: "member", teamId: home.id };
  }
  if (away?.isActiveMember(userId)) {
    return { role: "member", teamId: away.id };
  }
  return { role: "member", teamId: null };
}

function assertCanView(userId: string, home: Team, away: Team | null): void {
  if (home.isMember(userId) || away?.isMember(userId)) return;
  throw new TeamMatchForbiddenError("Only a participating team member can view");
}

async function loadTeam(teams: TeamRepository, teamId: string): Promise<Team> {
  const id = requiredTrimmed(teamId, "team id");
  const team = await teams.findById(id);
  if (!team) throw new TeamNotFoundError();
  return team;
}

async function loadMatch(
  matches: TeamMatchRepository,
  matchId: string,
): Promise<TeamMatch> {
  const id = requiredTrimmed(matchId, "team match id");
  const match = await matches.findById(id);
  if (!match) throw new TeamMatchNotFoundError();
  return match;
}

async function toPublicMatch(
  match: TeamMatch,
  home: Team,
  away: Team | null,
  lookup: FriendProfileLookup,
  viewerUserId: string,
): Promise<PublicTeamMatch> {
  const snapshot = match.toSnapshot();
  const homeUsers: PublicUser[] = [];
  for (const userId of match.homeLineup().userIds) {
    homeUsers.push(toPublicUser(await resolveProfile(lookup, userId)));
  }
  const awayUsers: PublicUser[] = [];
  for (const userId of match.awayLineup()?.userIds ?? []) {
    awayUsers.push(toPublicUser(await resolveProfile(lookup, userId)));
  }
  const viewer = viewerRole(viewerUserId, home, away);
  return {
    id: snapshot.id,
    sport: snapshot.sport,
    status: snapshot.status,
    homeTeam: toTeamRef(home),
    awayTeam: away ? toTeamRef(away) : null,
    venueCmsId: snapshot.venueCmsId,
    startsAt: snapshot.startsAt,
    challengeToken:
      viewer.role === "home_staff" ? snapshot.challengeToken : null,
    lineups: { home: homeUsers, away: awayUsers },
    scorecard: snapshot.scorecard,
    winnerTeamId: snapshot.winnerTeamId,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    viewer,
  };
}

export class TeamMatchContext {
  constructor(
    private readonly teams: TeamRepository,
    private readonly matches: TeamMatchRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async loadSides(match: TeamMatch): Promise<{ home: Team; away: Team | null }> {
    const home = await loadTeam(this.teams, match.homeTeamId);
    const away = match.awayTeamId
      ? await loadTeam(this.teams, match.awayTeamId)
      : null;
    return { home, away };
  }

  async toPublic(match: TeamMatch, userId: string): Promise<PublicTeamMatch> {
    const { home, away } = await this.loadSides(match);
    return toPublicMatch(match, home, away, this.profiles, userId);
  }
}

export class CreateTeamMatch {
  constructor(
    private readonly teams: TeamRepository,
    private readonly matches: TeamMatchRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    homeTeamId: unknown;
    awayTeamId?: unknown;
    generateChallengeLink?: unknown;
    venueCmsId?: unknown;
    startsAt?: unknown;
  }): Promise<{ match: PublicTeamMatch }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const home = await loadTeam(this.teams, String(input.homeTeamId ?? ""));
    requireStaff(home, userId, "Only an owner or captain can create a challenge");

    const generateLink = input.generateChallengeLink === true;
    const awayId =
      input.awayTeamId == null || input.awayTeamId === ""
        ? null
        : requiredTrimmed(input.awayTeamId, "awayTeamId");

    if (!awayId && !generateLink) {
      throw new DomainError("awayTeamId or generateChallengeLink is required");
    }

    let away: Team | null = null;
    if (awayId) {
      away = await loadTeam(this.teams, awayId);
      if (!away.sport.equals(home.sport)) {
        throw new TeamMatchSportMismatchError();
      }
    }

    const match = TeamMatch.create({
      homeTeamId: home.id,
      awayTeamId: away?.id ?? null,
      sport: home.sport,
      createdBy: userId,
      venueCmsId: OptionalVenueCmsId.from(input.venueCmsId),
      startsAt: OptionalStartsAt.from(input.startsAt ?? null),
      generateChallengeLink: generateLink && !away,
    });
    const saved = await this.matches.create(match);
    return {
      match: await toPublicMatch(saved, home, away, this.profiles, userId),
    };
  }
}

export class JoinTeamMatch {
  constructor(
    private readonly teams: TeamRepository,
    private readonly matches: TeamMatchRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    token: unknown;
    teamId: unknown;
  }): Promise<{ match: PublicTeamMatch }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const token = TeamMatchChallengeToken.from(input.token);
    const joining = await loadTeam(this.teams, String(input.teamId ?? ""));
    requireStaff(joining, userId, "Only an owner or captain can join a challenge");

    const match = await this.matches.findByChallengeToken(token.value);
    if (!match) throw new TeamMatchNotFoundError();
    if (!joining.sport.equals(match.sport)) {
      throw new TeamMatchSportMismatchError();
    }

    match.joinWithToken(token, joining.id);
    const saved = await this.matches.persist(match);
    const home = await loadTeam(this.teams, saved.homeTeamId);
    return {
      match: await toPublicMatch(saved, home, joining, this.profiles, userId),
    };
  }
}

export class AcceptTeamMatch {
  constructor(
    private readonly teams: TeamRepository,
    private readonly matches: TeamMatchRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    matchId: string;
  }): Promise<{ match: PublicTeamMatch }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const match = await loadMatch(this.matches, input.matchId);
    if (!match.awayTeamId) {
      throw new DomainError("Open challenges are joined via token");
    }
    const away = await loadTeam(this.teams, match.awayTeamId);
    requireStaff(away, userId, "Only the challenged team's owner or captain can accept");
    if (!away.sport.equals(match.sport)) {
      throw new TeamMatchSportMismatchError();
    }
    match.accept(away.id);
    const saved = await this.matches.persist(match);
    const home = await loadTeam(this.teams, saved.homeTeamId);
    return {
      match: await toPublicMatch(saved, home, away, this.profiles, userId),
    };
  }
}

export class DeclineTeamMatch {
  constructor(
    private readonly teams: TeamRepository,
    private readonly matches: TeamMatchRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    matchId: string;
  }): Promise<{ match: PublicTeamMatch }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const match = await loadMatch(this.matches, input.matchId);
    if (!match.awayTeamId) {
      throw new DomainError("Open challenges are joined via token");
    }
    const away = await loadTeam(this.teams, match.awayTeamId);
    requireStaff(away, userId, "Only the challenged team's owner or captain can decline");
    match.decline();
    const saved = await this.matches.persist(match);
    const home = await loadTeam(this.teams, saved.homeTeamId);
    return {
      match: await toPublicMatch(saved, home, away, this.profiles, userId),
    };
  }
}

export class ScheduleTeamMatch {
  constructor(
    private readonly teams: TeamRepository,
    private readonly matches: TeamMatchRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    matchId: string;
    startsAt?: unknown;
    venueCmsId?: unknown;
    hasStartsAt: boolean;
    hasVenueCmsId: boolean;
  }): Promise<{ match: PublicTeamMatch }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const match = await loadMatch(this.matches, input.matchId);
    const home = await loadTeam(this.teams, match.homeTeamId);
    requireStaff(home, userId, "Only the challenging team's owner or captain can schedule");
    match.schedule({
      ...(input.hasStartsAt
        ? { startsAt: OptionalStartsAt.from(input.startsAt ?? null) }
        : {}),
      ...(input.hasVenueCmsId
        ? { venueCmsId: OptionalVenueCmsId.from(input.venueCmsId) }
        : {}),
    });
    const saved = await this.matches.persist(match);
    const away = saved.awayTeamId
      ? await loadTeam(this.teams, saved.awayTeamId)
      : null;
    return {
      match: await toPublicMatch(saved, home, away, this.profiles, userId),
    };
  }
}

export class SetTeamMatchLineup {
  constructor(
    private readonly teams: TeamRepository,
    private readonly matches: TeamMatchRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    matchId: string;
    userIds: unknown;
    teamId?: unknown;
  }): Promise<{ match: PublicTeamMatch }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const match = await loadMatch(this.matches, input.matchId);
    const home = await loadTeam(this.teams, match.homeTeamId);
    const away = match.awayTeamId
      ? await loadTeam(this.teams, match.awayTeamId)
      : null;

    let team: Team;
    if (input.teamId != null && input.teamId !== "") {
      const requested = requiredTrimmed(input.teamId, "teamId");
      if (requested === home.id) team = home;
      else if (away && requested === away.id) team = away;
      else throw new DomainError("Team is not part of this match");
    } else if (isStaff(home, userId) && !(away && isStaff(away, userId))) {
      team = home;
    } else if (away && isStaff(away, userId) && !isStaff(home, userId)) {
      team = away;
    } else if (isStaff(home, userId) && away && isStaff(away, userId)) {
      throw new DomainError("teamId is required when you staff both teams");
    } else {
      throw new TeamMatchForbiddenError(
        "Only an owner or captain can set this team's lineup",
      );
    }

    requireStaff(team, userId, "Only an owner or captain can set this team's lineup");

    const userIds = Array.isArray(input.userIds) ? input.userIds : [];
    for (const raw of userIds) {
      const memberId = requiredTrimmed(raw, "userId");
      if (!team.isActiveMember(memberId)) {
        throw new DomainError("Lineup players must be active members of the team");
      }
    }

    match.setLineup(team.id, input.userIds);
    const saved = await this.matches.persist(match);
    return {
      match: await toPublicMatch(saved, home, away, this.profiles, userId),
    };
  }
}

export class CancelTeamMatch {
  constructor(
    private readonly teams: TeamRepository,
    private readonly matches: TeamMatchRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    matchId: string;
  }): Promise<{ match: PublicTeamMatch }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const match = await loadMatch(this.matches, input.matchId);
    const home = await loadTeam(this.teams, match.homeTeamId);
    requireStaff(home, userId, "Only the challenging team's owner or captain can cancel");
    match.cancel();
    const saved = await this.matches.persist(match);
    const away = saved.awayTeamId
      ? await loadTeam(this.teams, saved.awayTeamId)
      : null;
    return {
      match: await toPublicMatch(saved, home, away, this.profiles, userId),
    };
  }
}

export type StartTeamMatchInput = {
  userId: string;
  matchId: string;
  ruleset?: unknown;
  servingTeam?: unknown;
  holesPlayed?: unknown;
  startingHole?: unknown;
  teeName?: unknown;
  course?: unknown;
};

export class StartTeamMatch {
  constructor(
    private readonly teams: TeamRepository,
    private readonly matches: TeamMatchRepository,
    private readonly profiles: FriendProfileLookup,
    private readonly venues: VenueRepository,
    private readonly createMatch: CreateMatch,
    private readonly createGolfRound: CreateGolfRound,
    private readonly createDartsMatch: CreateDartsMatch,
  ) {}

  async execute(input: StartTeamMatchInput): Promise<{
    match: PublicTeamMatch;
    scorecard: PublicScorecard;
  }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const match = await loadMatch(this.matches, input.matchId);
    const home = await loadTeam(this.teams, match.homeTeamId);
    const away = match.awayTeamId
      ? await loadTeam(this.teams, match.awayTeamId)
      : null;

    if (!isStaff(home, userId) && !(away && isStaff(away, userId))) {
      throw new TeamMatchForbiddenError(
        "Only an owner or captain of either team can start",
      );
    }

    if (match.status.isLive && match.scorecard) {
      const publicMatch = await toPublicMatch(
        match,
        home,
        away,
        this.profiles,
        userId,
      );
      return { match: publicMatch, scorecard: publicMatch.scorecard! };
    }

    if (!match.venueCmsId && home.homeVenueCmsId) {
      match.schedule({
        venueCmsId: OptionalVenueCmsId.from(home.homeVenueCmsId.value),
      });
    }

    match.assertCanStart();
    const venueCmsId = match.venueCmsId ?? home.homeVenueCmsId?.value ?? null;
    if (match.sport.value !== "darts") {
      if (!venueCmsId) {
        throw new TeamMatchNotReadyError("venueCmsId is required to start");
      }
      const venue = await this.venues.findByCmsId(CmsId.from(venueCmsId));
      if (!venue) {
        throw new DomainError("venueCmsId is not a registered venue");
      }
    } else if (venueCmsId) {
      const venue = await this.venues.findByCmsId(CmsId.from(venueCmsId));
      if (!venue) {
        throw new DomainError("venueCmsId is not a registered venue");
      }
    }

    const profiles = new Map<string, SeatedProfile>();
    for (const id of [
      ...match.homeLineup().userIds,
      ...(match.awayLineup()?.userIds ?? []),
    ]) {
      profiles.set(id, await resolveProfile(this.profiles, id));
    }

    const startsAt =
      match.startsAt?.toISOString() ?? new Date().toISOString();

    let liveId: string;
    if (match.sport.value === "padel") {
      const created = await this.createMatch.execute({
        venueCmsId: venueCmsId!,
        startsAt,
        ruleset: input.ruleset ?? "golden_point",
        pairings: pairingsFromLineups(match, profiles),
        servingTeam: input.servingTeam,
      });
      liveId = created.id;
    } else if (match.sport.value === "golf") {
      const holesPlayed = input.holesPlayed ?? 9;
      const created = await this.createGolfRound.execute({
        venueCmsId: venueCmsId!,
        startsAt,
        holesPlayed,
        startingHole: input.startingHole,
        teeName: input.teeName ?? "White",
        course:
          input.course ??
          (holesPlayed === 9 ? defaultNineHoleCourse() : undefined),
        players: golfPlayersFromLineups(match, profiles),
      });
      liveId = created.id;
    } else {
      const created = await this.createDartsMatch.execute({
        venueCmsId,
        startsAt,
        players: dartsPlayersFromLineups(match, profiles),
      });
      liveId = created.id;
    }

    match.start(TeamMatchScorecard.from({ sport: match.sport, id: liveId }));
    const saved = await this.matches.persist(match);
    const publicMatch = await toPublicMatch(
      saved,
      home,
      away,
      this.profiles,
      userId,
    );
    return { match: publicMatch, scorecard: publicMatch.scorecard! };
  }
}

export type TeamMatchCompletedHandler = (
  match: TeamMatch,
) => Promise<void>;

export class CompleteTeamMatch {
  constructor(
    private readonly teams: TeamRepository,
    private readonly matches: TeamMatchRepository,
    private readonly profiles: FriendProfileLookup,
    private readonly getPadel?: GetMatchById,
    private readonly getGolf?: GetGolfRoundById,
    private readonly getDarts?: GetDartsMatchById,
    private readonly onCompleted?: TeamMatchCompletedHandler,
  ) {}

  async execute(input: {
    userId: string;
    matchId: string;
    winnerTeamId?: unknown;
  }): Promise<{ match: PublicTeamMatch }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const match = await loadMatch(this.matches, input.matchId);
    const home = await loadTeam(this.teams, match.homeTeamId);
    const away = match.awayTeamId
      ? await loadTeam(this.teams, match.awayTeamId)
      : null;

    const allowed =
      isStaff(home, userId) ||
      (away && isStaff(away, userId)) ||
      match.isLineupMember(userId);
    if (!allowed) {
      throw new TeamMatchForbiddenError(
        "Only a lineup player or team staff can complete",
      );
    }

    let winnerTeamId =
      input.winnerTeamId == null || input.winnerTeamId === ""
        ? null
        : requiredTrimmed(input.winnerTeamId, "winnerTeamId");

    if (winnerTeamId === null && match.scorecard) {
      winnerTeamId = await this.inferWinner(match);
    }

    match.complete(winnerTeamId);
    const saved = await this.matches.persist(match);
    if (this.onCompleted) {
      await this.onCompleted(saved);
    }
    return {
      match: await toPublicMatch(saved, home, away, this.profiles, userId),
    };
  }

  private async inferWinner(match: TeamMatch): Promise<string | null> {
    const card = match.scorecard;
    if (!card) return null;
    if (card.sport.value === "padel" && this.getPadel) {
      const padel = await this.getPadel.execute(card.id);
      if (!padel?.isLocked || !padel.winner) return null;
      return padel.winner.value === "A" ? match.homeTeamId : match.awayTeamId;
    }
    if (card.sport.value === "darts" && this.getDarts) {
      const darts = await this.getDarts.execute(card.id);
      if (!darts?.isLocked) return null;
      const winnerUserId = darts.toSnapshot().winnerUserId;
      if (!winnerUserId) return null;
      if (match.homeLineup().includes(winnerUserId)) return match.homeTeamId;
      if (match.awayLineup()?.includes(winnerUserId)) return match.awayTeamId;
      return null;
    }
    if (card.sport.value === "golf" && this.getGolf) {
      const golf = await this.getGolf.execute(card.id);
      if (!golf?.isLocked || !golf.score) return null;
      return inferGolfWinner(match, {
        players: golf.players.map((player) => ({
          slot: player.slot,
          userId: player.userId,
        })),
        holes: golf.score.toSnapshot().holes,
      });
    }
    return null;
  }
}

export class GetTeamMatch {
  constructor(
    private readonly teams: TeamRepository,
    private readonly matches: TeamMatchRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    matchId: string;
  }): Promise<{ match: PublicTeamMatch }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const match = await loadMatch(this.matches, input.matchId);
    const home = await loadTeam(this.teams, match.homeTeamId);
    const away = match.awayTeamId
      ? await loadTeam(this.teams, match.awayTeamId)
      : null;
    assertCanView(userId, home, away);
    return {
      match: await toPublicMatch(match, home, away, this.profiles, userId),
    };
  }
}

export class ListTeamMatches {
  constructor(
    private readonly teams: TeamRepository,
    private readonly matches: TeamMatchRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    teamId: string;
  }): Promise<{ matches: PublicTeamMatch[] }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const team = await loadTeam(this.teams, input.teamId);
    if (!team.isMember(userId)) {
      throw new TeamForbiddenError("Only a team member can view this team");
    }
    const rows = await this.matches.listForTeams([team.id]);
    const matches: PublicTeamMatch[] = [];
    for (const row of rows) {
      const home = await loadTeam(this.teams, row.homeTeamId);
      const away = row.awayTeamId
        ? await loadTeam(this.teams, row.awayTeamId)
        : null;
      matches.push(await toPublicMatch(row, home, away, this.profiles, userId));
    }
    return { matches };
  }
}

export class ListMyTeamMatches {
  constructor(
    private readonly teams: TeamRepository,
    private readonly matches: TeamMatchRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: { userId: string }): Promise<{
    upcoming: PublicTeamMatch[];
    recent: PublicTeamMatch[];
  }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const myTeams = (await this.teams.listForUser(userId)).filter((team) =>
      team.isActiveMember(userId),
    );
    const rows = await this.matches.listForTeams(myTeams.map((team) => team.id));
    const upcoming: PublicTeamMatch[] = [];
    const recent: PublicTeamMatch[] = [];
    for (const row of rows) {
      const home = await loadTeam(this.teams, row.homeTeamId);
      const away = row.awayTeamId
        ? await loadTeam(this.teams, row.awayTeamId)
        : null;
      const publicMatch = await toPublicMatch(
        row,
        home,
        away,
        this.profiles,
        userId,
      );
      if (
        row.status.isPending ||
        row.status.isScheduled ||
        row.status.isLive
      ) {
        upcoming.push(publicMatch);
      } else {
        recent.push(publicMatch);
      }
    }
    upcoming.sort(compareUpcoming);
    recent.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { upcoming, recent: recent.slice(0, 20) };
  }
}

function compareUpcoming(a: PublicTeamMatch, b: PublicTeamMatch): number {
  if (a.startsAt && b.startsAt) return a.startsAt.localeCompare(b.startsAt);
  if (a.startsAt) return -1;
  if (b.startsAt) return 1;
  return b.createdAt.localeCompare(a.createdAt);
}

export function inferGolfWinner(
  match: TeamMatch,
  golf: {
    players: Array<{ slot: number; userId: string | null }>;
    holes: Array<{ strokes: Record<string, number> }>;
  },
): string | null {
  const totals = new Map<string, number>();
  for (const player of golf.players) {
    if (!player.userId) continue;
    let total = 0;
    for (const hole of golf.holes) {
      const strokes = hole.strokes[String(player.slot)];
      if (typeof strokes !== "number") return null;
      total += strokes;
    }
    totals.set(player.userId, total);
  }
  let home = 0;
  let away = 0;
  for (const userId of match.homeLineup().userIds) {
    const total = totals.get(userId);
    if (total == null) return null;
    home += total;
  }
  for (const userId of match.awayLineup()?.userIds ?? []) {
    const total = totals.get(userId);
    if (total == null) return null;
    away += total;
  }
  if (home === away) return null;
  return home < away ? match.homeTeamId : match.awayTeamId;
}

export {
  TeamMatchAlreadyAcceptedError,
  TeamMatchForbiddenError,
  TeamMatchNotFoundError,
  TeamMatchNotReadyError,
  TeamMatchSportMismatchError,
};
