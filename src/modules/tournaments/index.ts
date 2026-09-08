import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { TeamMatchRepository } from "../team-matches/repositories/team-match.repository";
import { TeamRepository } from "../teams/repositories/team.repository";
import { createTournamentsController } from "./controllers/tournaments.controller";
import { PrismaTournamentRepository } from "./repositories/prisma-tournament.repository";
import { TournamentRepository } from "./repositories/tournament.repository";
import { createTournamentsRoutes } from "./routes/tournaments.routes";
import { AdvanceTournamentOnTeamMatchComplete } from "./services/advance-on-team-match-complete";
import {
  AcceptRegistration,
  CreateTournament,
  DeleteTournament,
  GenerateDraw,
  GetTournament,
  InviteTeam,
  JoinTournament,
  ListMyTournaments,
  ListTeamTournaments,
  OpenRegistration,
  RegisterTeam,
  StartFixture,
  StartTournament,
  UpdateTournament,
  WithdrawRegistration,
} from "./services/tournaments.service";

export type CreateTournamentsModuleParams = {
  prisma: PrismaClient;
  teamRepository: TeamRepository;
  teamMatchRepository: TeamMatchRepository;
  tournamentRepository?: TournamentRepository;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type TournamentsModule = {
  router: Router;
  tournamentRepository: TournamentRepository;
  advanceOnTeamMatchComplete: AdvanceTournamentOnTeamMatchComplete;
};

export function createTournamentsModule({
  prisma,
  teamRepository,
  teamMatchRepository,
  tournamentRepository: tournamentRepositoryOverride,
  tryGetSessionUserId,
  requireAuth,
}: CreateTournamentsModuleParams): TournamentsModule {
  const tournamentRepository =
    tournamentRepositoryOverride ?? new PrismaTournamentRepository(prisma);

  const controller = createTournamentsController({
    createTournament: new CreateTournament(teamRepository, tournamentRepository),
    getTournament: new GetTournament(teamRepository, tournamentRepository),
    updateTournament: new UpdateTournament(teamRepository, tournamentRepository),
    deleteTournament: new DeleteTournament(tournamentRepository),
    openRegistration: new OpenRegistration(teamRepository, tournamentRepository),
    registerTeam: new RegisterTeam(teamRepository, tournamentRepository),
    joinTournament: new JoinTournament(teamRepository, tournamentRepository),
    inviteTeam: new InviteTeam(teamRepository, tournamentRepository),
    acceptRegistration: new AcceptRegistration(
      teamRepository,
      tournamentRepository,
    ),
    withdrawRegistration: new WithdrawRegistration(
      teamRepository,
      tournamentRepository,
    ),
    generateDraw: new GenerateDraw(teamRepository, tournamentRepository),
    startTournament: new StartTournament(teamRepository, tournamentRepository),
    startFixture: new StartFixture(
      teamRepository,
      tournamentRepository,
      teamMatchRepository,
    ),
    listMyTournaments: new ListMyTournaments(
      teamRepository,
      tournamentRepository,
    ),
    listTeamTournaments: new ListTeamTournaments(
      teamRepository,
      tournamentRepository,
    ),
    tryGetSessionUserId,
  });

  return {
    router: createTournamentsRoutes(controller, { requireAuth }),
    tournamentRepository,
    advanceOnTeamMatchComplete: new AdvanceTournamentOnTeamMatchComplete(
      tournamentRepository,
    ),
  };
}

export { createTournamentsController } from "./controllers/tournaments.controller";
export { InMemoryTournamentRepository } from "./repositories/in-memory-tournament.repository";
export { PrismaTournamentRepository } from "./repositories/prisma-tournament.repository";
export type { TournamentRepository } from "./repositories/tournament.repository";
export { Tournament } from "./entities/tournament";
export { AdvanceTournamentOnTeamMatchComplete } from "./services/advance-on-team-match-complete";
export {
  AcceptRegistration,
  CreateTournament,
  DeleteTournament,
  GenerateDraw,
  GetTournament,
  InviteTeam,
  JoinTournament,
  ListMyTournaments,
  ListTeamTournaments,
  OpenRegistration,
  RegisterTeam,
  StartFixture,
  StartTournament,
  UpdateTournament,
  WithdrawRegistration,
} from "./services/tournaments.service";
export type {
  PublicRegistration,
  PublicSlot,
  PublicTournament,
  PublicTournamentSummary,
} from "./services/tournaments.service";
