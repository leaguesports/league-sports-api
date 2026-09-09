import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { OptionalStartsAt } from "../../team-matches/entities/optional-starts-at";
import { OptionalVenueCmsId } from "../../team-matches/entities/optional-venue-cms-id";
import { TeamMatch } from "../../team-matches/entities/team-match";
import { TeamMatchRepository } from "../../team-matches/repositories/team-match.repository";
import { Team } from "../../teams/entities/team";
import { TeamForbiddenError } from "../../teams/entities/team-forbidden-error";
import { TeamNotFoundError } from "../../teams/entities/team-not-found-error";
import { TeamSport } from "../../teams/entities/team-sport";
import { TeamRepository } from "../../teams/repositories/team.repository";
import { Tournament } from "../entities/tournament";
import { TournamentForbiddenError } from "../entities/tournament-forbidden-error";
import { TournamentInviteToken } from "../entities/tournament-invite-token";
import { TournamentName } from "../entities/tournament-name";
import { TournamentNotFoundError } from "../entities/tournament-not-found-error";
import { TournamentSize } from "../entities/tournament-size";
import { TournamentSlotNotFoundError } from "../entities/tournament-slot-not-found-error";
import { TournamentSportMismatchError } from "../entities/tournament-sport-mismatch-error";
import { TournamentRepository } from "../repositories/tournament.repository";

export type PublicTeamRef = {
  id: string;
  name: string;
  sport: "padel" | "golf" | "darts";
};

export type PublicRegistration = {
  team: PublicTeamRef;
  status: "pending" | "accepted" | "withdrawn";
  seed: number | null;
  registeredBy: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicSlot = {
  id: string;
  round: number;
  position: number;
  homeTeam: PublicTeamRef | null;
  awayTeam: PublicTeamRef | null;
  homeSeed: number | null;
  awaySeed: number | null;
  teamMatchId: string | null;
  teamMatchPath: string | null;
  winnerTeamId: string | null;
  nextSlotId: string | null;
  nextSide: "home" | "away" | null;
};

export type PublicTournamentViewer = {
  role: "organizer" | "captain" | "member";
  teamId: string | null;
};

export type PublicTournamentSummary = {
  id: string;
  name: string;
  sport: "padel" | "golf" | "darts";
  size: 4 | 8 | 16;
  status: "draft" | "registration" | "active" | "completed";
  venueCmsId: string | null;
  startsAt: string | null;
  organizerUserId: string;
  winnerTeamId: string | null;
  acceptedCount: number;
  createdAt: string;
  updatedAt: string;
  viewer: PublicTournamentViewer;
};

export type PublicTournament = PublicTournamentSummary & {
  inviteToken: string | null;
  registrations: PublicRegistration[];
  bracket: {
    rounds: number;
    slots: PublicSlot[];
  };
};

function isStaff(team: Team, userId: string): boolean {
  const membership = team.membershipOf(userId);
  return membership?.status.isActive === true && membership.role.canInvite;
}

function requireStaff(team: Team, userId: string, message: string): void {
  if (!isStaff(team, userId)) {
    throw new TournamentForbiddenError(message);
  }
}

function toTeamRef(team: Team): PublicTeamRef {
  return {
    id: team.id,
    name: team.name.value,
    sport: team.sport.value,
  };
}

async function loadTeam(teams: TeamRepository, teamId: string): Promise<Team> {
  const id = requiredTrimmed(teamId, "team id");
  const team = await teams.findById(id);
  if (!team) throw new TeamNotFoundError();
  return team;
}

async function loadTournament(
  tournaments: TournamentRepository,
  tournamentId: string,
): Promise<Tournament> {
  const id = requiredTrimmed(tournamentId, "tournament id");
  const tournament = await tournaments.findById(id);
  if (!tournament) throw new TournamentNotFoundError();
  return tournament;
}

async function teamMap(
  teams: TeamRepository,
  teamIds: string[],
): Promise<Map<string, Team>> {
  const unique = [...new Set(teamIds.filter(Boolean))];
  const map = new Map<string, Team>();
  for (const id of unique) {
    const team = await teams.findById(id);
    if (team) map.set(id, team);
  }
  return map;
}

function viewerFor(
  tournament: Tournament,
  userId: string,
  teamsById: Map<string, Team>,
): PublicTournamentViewer {
  if (tournament.isOrganizer(userId)) {
    return { role: "organizer", teamId: null };
  }
  for (const entry of tournament.registrations) {
    if (entry.status.isWithdrawn) continue;
    const team = teamsById.get(entry.teamId);
    if (!team) continue;
    if (isStaff(team, userId)) {
      return { role: "captain", teamId: team.id };
    }
    if (team.isActiveMember(userId)) {
      return { role: "member", teamId: team.id };
    }
  }
  return { role: "member", teamId: null };
}

function canView(
  tournament: Tournament,
  userId: string,
  teamsById: Map<string, Team>,
): boolean {
  if (tournament.isOrganizer(userId)) return true;
  for (const entry of tournament.registrations) {
    const team = teamsById.get(entry.teamId);
    if (team?.isMember(userId)) return true;
  }
  return false;
}

function toSummary(
  tournament: Tournament,
  userId: string,
  teamsById: Map<string, Team>,
): PublicTournamentSummary {
  const snapshot = tournament.toSnapshot();
  return {
    id: snapshot.id,
    name: snapshot.name,
    sport: snapshot.sport,
    size: snapshot.size,
    status: snapshot.status,
    venueCmsId: snapshot.venueCmsId,
    startsAt: snapshot.startsAt,
    organizerUserId: snapshot.organizerUserId,
    winnerTeamId: snapshot.winnerTeamId,
    acceptedCount: tournament.acceptedCount,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    viewer: viewerFor(tournament, userId, teamsById),
  };
}

function toPublic(
  tournament: Tournament,
  userId: string,
  teamsById: Map<string, Team>,
): PublicTournament {
  const snapshot = tournament.toSnapshot();
  const viewer = viewerFor(tournament, userId, teamsById);
  return {
    ...toSummary(tournament, userId, teamsById),
    inviteToken: viewer.role === "organizer" ? snapshot.inviteToken : null,
    registrations: snapshot.registrations.map((entry) => {
      const team = teamsById.get(entry.teamId);
      return {
        team: team
          ? toTeamRef(team)
          : { id: entry.teamId, name: "Team", sport: snapshot.sport },
        status: entry.status,
        seed: entry.seed,
        registeredBy: entry.registeredBy,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      };
    }),
    bracket: {
      rounds: tournament.size.rounds,
      slots: snapshot.slots.map((slot) => ({
        id: slot.id,
        round: slot.round,
        position: slot.position,
        homeTeam: slot.homeTeamId
          ? teamsById.has(slot.homeTeamId)
            ? toTeamRef(teamsById.get(slot.homeTeamId)!)
            : { id: slot.homeTeamId, name: "Team", sport: snapshot.sport }
          : null,
        awayTeam: slot.awayTeamId
          ? teamsById.has(slot.awayTeamId)
            ? toTeamRef(teamsById.get(slot.awayTeamId)!)
            : { id: slot.awayTeamId, name: "Team", sport: snapshot.sport }
          : null,
        homeSeed: slot.homeSeed,
        awaySeed: slot.awaySeed,
        teamMatchId: slot.teamMatchId,
        teamMatchPath: slot.teamMatchId
          ? `/api/team-matches/${slot.teamMatchId}`
          : null,
        winnerTeamId: slot.winnerTeamId,
        nextSlotId: slot.nextSlotId,
        nextSide: slot.nextSide,
      })),
    },
  };
}

async function relatedTeamIds(tournament: Tournament): Promise<string[]> {
  const ids = new Set<string>();
  for (const entry of tournament.registrations) ids.add(entry.teamId);
  for (const slot of tournament.slots) {
    if (slot.homeTeamId) ids.add(slot.homeTeamId);
    if (slot.awayTeamId) ids.add(slot.awayTeamId);
  }
  return [...ids];
}

export class TournamentContext {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
  ) {}

  async toPublic(tournament: Tournament, userId: string): Promise<PublicTournament> {
    const teamsById = await teamMap(this.teams, await relatedTeamIds(tournament));
    return toPublic(tournament, userId, teamsById);
  }

  async toSummary(
    tournament: Tournament,
    userId: string,
  ): Promise<PublicTournamentSummary> {
    const teamsById = await teamMap(this.teams, await relatedTeamIds(tournament));
    return toSummary(tournament, userId, teamsById);
  }
}

export class CreateTournament {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
  ) {}

  async execute(input: {
    userId: string;
    name: unknown;
    sport: unknown;
    size: unknown;
    venueCmsId?: unknown;
    startsAt?: unknown;
  }): Promise<{ tournament: PublicTournament }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const tournament = Tournament.create({
      name: TournamentName.from(input.name),
      sport: TeamSport.from(input.sport),
      size: TournamentSize.from(input.size),
      organizerUserId: userId,
      venueCmsId: OptionalVenueCmsId.from(input.venueCmsId),
      startsAt: OptionalStartsAt.from(input.startsAt ?? null),
    });
    const saved = await this.tournaments.create(tournament);
    return {
      tournament: await new TournamentContext(this.teams, this.tournaments).toPublic(
        saved,
        userId,
      ),
    };
  }
}

export class GetTournament {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
  ) {}

  async execute(input: {
    userId: string;
    tournamentId: string;
  }): Promise<{ tournament: PublicTournament }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const tournament = await loadTournament(this.tournaments, input.tournamentId);
    const teamsById = await teamMap(this.teams, await relatedTeamIds(tournament));
    if (!canView(tournament, userId, teamsById) && !tournament.status.isRegistration) {
      throw new TournamentForbiddenError(
        "Only the organizer or an entered team can view this tournament",
      );
    }
    return { tournament: toPublic(tournament, userId, teamsById) };
  }
}

export class UpdateTournament {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
  ) {}

  async execute(input: {
    userId: string;
    tournamentId: string;
    name?: unknown;
    sport?: unknown;
    size?: unknown;
    venueCmsId?: unknown;
    startsAt?: unknown;
    hasVenueCmsId: boolean;
    hasStartsAt: boolean;
  }): Promise<{ tournament: PublicTournament }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const tournament = await loadTournament(this.tournaments, input.tournamentId);
    tournament.updateDetails(userId, {
      ...(input.name !== undefined ? { name: TournamentName.from(input.name) } : {}),
      ...(input.sport !== undefined ? { sport: TeamSport.from(input.sport) } : {}),
      ...(input.size !== undefined ? { size: TournamentSize.from(input.size) } : {}),
      ...(input.hasVenueCmsId
        ? { venueCmsId: OptionalVenueCmsId.from(input.venueCmsId) }
        : {}),
      ...(input.hasStartsAt
        ? { startsAt: OptionalStartsAt.from(input.startsAt ?? null) }
        : {}),
    });
    const saved = await this.tournaments.persist(tournament);
    return {
      tournament: await new TournamentContext(this.teams, this.tournaments).toPublic(
        saved,
        userId,
      ),
    };
  }
}

export class DeleteTournament {
  constructor(private readonly tournaments: TournamentRepository) {}

  async execute(input: { userId: string; tournamentId: string }): Promise<void> {
    const userId = requiredTrimmed(input.userId, "userId");
    const tournament = await loadTournament(this.tournaments, input.tournamentId);
    tournament.assertCanDelete(userId);
    await this.tournaments.delete(tournament.id);
  }
}

export class OpenRegistration {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
  ) {}

  async execute(input: {
    userId: string;
    tournamentId: string;
  }): Promise<{ tournament: PublicTournament }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const tournament = await loadTournament(this.tournaments, input.tournamentId);
    tournament.openRegistration(userId);
    const saved = await this.tournaments.persist(tournament);
    return {
      tournament: await new TournamentContext(this.teams, this.tournaments).toPublic(
        saved,
        userId,
      ),
    };
  }
}

async function registerTeam(params: {
  teams: TeamRepository;
  tournaments: TournamentRepository;
  userId: string;
  tournament: Tournament;
  teamId: unknown;
}): Promise<Tournament> {
  const team = await loadTeam(params.teams, String(params.teamId ?? ""));
  requireStaff(
    team,
    params.userId,
    "Only an owner or captain can register a team",
  );
  if (!team.sport.equals(params.tournament.sport)) {
    throw new TournamentSportMismatchError();
  }
  params.tournament.registerAccepted(team.id, params.userId);
  return params.tournaments.persist(params.tournament);
}

export class RegisterTeam {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
  ) {}

  async execute(input: {
    userId: string;
    tournamentId: string;
    teamId: unknown;
  }): Promise<{ tournament: PublicTournament }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const tournament = await loadTournament(this.tournaments, input.tournamentId);
    const saved = await registerTeam({
      teams: this.teams,
      tournaments: this.tournaments,
      userId,
      tournament,
      teamId: input.teamId,
    });
    return {
      tournament: await new TournamentContext(this.teams, this.tournaments).toPublic(
        saved,
        userId,
      ),
    };
  }
}

export class JoinTournament {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
  ) {}

  async execute(input: {
    userId: string;
    token: unknown;
    teamId: unknown;
  }): Promise<{ tournament: PublicTournament }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const token = TournamentInviteToken.from(input.token);
    const tournament = await this.tournaments.findByInviteToken(token.value);
    if (!tournament) throw new TournamentNotFoundError();
    if (!tournament.inviteToken.equals(token)) {
      throw new DomainError("token is invalid");
    }
    const saved = await registerTeam({
      teams: this.teams,
      tournaments: this.tournaments,
      userId,
      tournament,
      teamId: input.teamId,
    });
    return {
      tournament: await new TournamentContext(this.teams, this.tournaments).toPublic(
        saved,
        userId,
      ),
    };
  }
}

export class InviteTeam {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
  ) {}

  async execute(input: {
    userId: string;
    tournamentId: string;
    teamId: unknown;
  }): Promise<{ tournament: PublicTournament }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const tournament = await loadTournament(this.tournaments, input.tournamentId);
    const team = await loadTeam(this.teams, String(input.teamId ?? ""));
    if (!team.sport.equals(tournament.sport)) {
      throw new TournamentSportMismatchError();
    }
    tournament.inviteTeam(userId, team.id);
    const saved = await this.tournaments.persist(tournament);
    return {
      tournament: await new TournamentContext(this.teams, this.tournaments).toPublic(
        saved,
        userId,
      ),
    };
  }
}

export class AcceptRegistration {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
  ) {}

  async execute(input: {
    userId: string;
    tournamentId: string;
    teamId: string;
  }): Promise<{ tournament: PublicTournament }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const tournament = await loadTournament(this.tournaments, input.tournamentId);
    const team = await loadTeam(this.teams, input.teamId);
    requireStaff(
      team,
      userId,
      "Only an owner or captain can accept this entry",
    );
    if (!team.sport.equals(tournament.sport)) {
      throw new TournamentSportMismatchError();
    }
    tournament.acceptRegistration(team.id);
    const saved = await this.tournaments.persist(tournament);
    return {
      tournament: await new TournamentContext(this.teams, this.tournaments).toPublic(
        saved,
        userId,
      ),
    };
  }
}

export class WithdrawRegistration {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
  ) {}

  async execute(input: {
    userId: string;
    tournamentId: string;
    teamId: string;
  }): Promise<{ tournament: PublicTournament }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const tournament = await loadTournament(this.tournaments, input.tournamentId);
    const team = await loadTeam(this.teams, input.teamId);
    if (!tournament.isOrganizer(userId)) {
      requireStaff(
        team,
        userId,
        "Only an owner or captain can withdraw this entry",
      );
    }
    tournament.withdrawRegistration(team.id);
    const saved = await this.tournaments.persist(tournament);
    return {
      tournament: await new TournamentContext(this.teams, this.tournaments).toPublic(
        saved,
        userId,
      ),
    };
  }
}

export class GenerateDraw {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
  ) {}

  async execute(input: {
    userId: string;
    tournamentId: string;
  }): Promise<{ tournament: PublicTournament }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const tournament = await loadTournament(this.tournaments, input.tournamentId);
    tournament.generateDraw(userId);
    const saved = await this.tournaments.persist(tournament);
    return {
      tournament: await new TournamentContext(this.teams, this.tournaments).toPublic(
        saved,
        userId,
      ),
    };
  }
}

export class StartTournament {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
  ) {}

  async execute(input: {
    userId: string;
    tournamentId: string;
  }): Promise<{ tournament: PublicTournament }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const tournament = await loadTournament(this.tournaments, input.tournamentId);
    if (!tournament.hasDraw && tournament.acceptedCount === tournament.size.value) {
      tournament.generateDraw(userId);
    } else {
      tournament.start(userId);
    }
    const saved = await this.tournaments.persist(tournament);
    return {
      tournament: await new TournamentContext(this.teams, this.tournaments).toPublic(
        saved,
        userId,
      ),
    };
  }
}

export class StartFixture {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
    private readonly matches: TeamMatchRepository,
  ) {}

  async execute(input: {
    userId: string;
    tournamentId: string;
    slotId: string;
  }): Promise<{
    tournament: PublicTournament;
    fixture: {
      slotId: string;
      teamMatchId: string;
      path: string;
    };
  }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const tournament = await loadTournament(this.tournaments, input.tournamentId);
    const slot = tournament.slotById(input.slotId);
    if (!slot) {
      throw new TournamentSlotNotFoundError();
    }
    if (!slot.homeTeamId || !slot.awayTeamId) {
      throw new DomainError("Both teams must be set before starting this fixture");
    }

    const home = await loadTeam(this.teams, slot.homeTeamId);
    const away = await loadTeam(this.teams, slot.awayTeamId);
    const allowed =
      tournament.isOrganizer(userId) ||
      isStaff(home, userId) ||
      isStaff(away, userId);
    if (!allowed) {
      throw new TournamentForbiddenError(
        "Only the organizer or a captain of this tie can start the fixture",
      );
    }

    if (slot.teamMatchId) {
      const existing = await this.matches.findById(slot.teamMatchId);
      if (existing) {
        const publicTournament = await new TournamentContext(
          this.teams,
          this.tournaments,
        ).toPublic(tournament, userId);
        return {
          tournament: publicTournament,
          fixture: {
            slotId: slot.id,
            teamMatchId: existing.id,
            path: `/api/team-matches/${existing.id}`,
          },
        };
      }
    }

    const match = TeamMatch.create({
      homeTeamId: home.id,
      awayTeamId: away.id,
      sport: tournament.sport,
      createdBy: userId,
      venueCmsId: OptionalVenueCmsId.from(tournament.venueCmsId),
      startsAt: OptionalStartsAt.from(tournament.startsAt),
      generateChallengeLink: false,
    });
    match.accept(away.id);
    const savedMatch = await this.matches.create(match);
    tournament.attachFixture(slot.id, savedMatch.id);
    const saved = await this.tournaments.persist(tournament);
    return {
      tournament: await new TournamentContext(this.teams, this.tournaments).toPublic(
        saved,
        userId,
      ),
      fixture: {
        slotId: slot.id,
        teamMatchId: savedMatch.id,
        path: `/api/team-matches/${savedMatch.id}`,
      },
    };
  }
}

export class ListMyTournaments {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
  ) {}

  async execute(input: { userId: string }): Promise<{
    organizing: PublicTournamentSummary[];
    entered: PublicTournamentSummary[];
  }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const myTeams = (await this.teams.listForUser(userId)).filter((team) =>
      team.isActiveMember(userId),
    );
    const organizing = await this.tournaments.listForOrganizer(userId);
    const entered = await this.tournaments.listForTeamIds(
      myTeams.map((team) => team.id),
    );
    const context = new TournamentContext(this.teams, this.tournaments);
    return {
      organizing: await Promise.all(
        organizing.map((row) => context.toSummary(row, userId)),
      ),
      entered: await Promise.all(
        entered.map((row) => context.toSummary(row, userId)),
      ),
    };
  }
}

export class ListTeamTournaments {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tournaments: TournamentRepository,
  ) {}

  async execute(input: {
    userId: string;
    teamId: string;
  }): Promise<{ tournaments: PublicTournamentSummary[] }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const team = await loadTeam(this.teams, input.teamId);
    if (!team.isMember(userId)) {
      throw new TeamForbiddenError("Only a team member can view this team");
    }
    const rows = await this.tournaments.listForTeamIds([team.id]);
    const context = new TournamentContext(this.teams, this.tournaments);
    return {
      tournaments: await Promise.all(
        rows.map((row) => context.toSummary(row, userId)),
      ),
    };
  }
}

export { TournamentAlreadyActiveError } from "../entities/tournament-already-active-error";
export { TournamentForbiddenError } from "../entities/tournament-forbidden-error";
export { TournamentFullError } from "../entities/tournament-full-error";
export { TournamentNotFoundError } from "../entities/tournament-not-found-error";
export { TournamentNotReadyError } from "../entities/tournament-not-ready-error";
export { TournamentSportMismatchError } from "../entities/tournament-sport-mismatch-error";
