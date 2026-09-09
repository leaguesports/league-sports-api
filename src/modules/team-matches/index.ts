import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { DartsMatchRepository } from "../darts/repositories/darts-match.repository";
import { CreateDartsMatch } from "../darts/services/create-darts-match.service";
import { GetDartsMatchById } from "../darts/services/get-darts-match-by-id.service";
import { FriendProfileLookup } from "../friends/repositories/friendship.repository";
import { GolfRoundRepository } from "../golf-round/repositories/golf-round.repository";
import { PrismaGolfHandicapIndexLookup } from "../golf-round/repositories/prisma-golf-handicap-index.lookup";
import { CreateGolfRound } from "../golf-round/services/create-golf-round.service";
import { GetGolfRoundById } from "../golf-round/services/get-golf-round-by-id.service";
import { MatchRepository } from "../match/repositories/match.repository";
import { CreateMatch } from "../match/services/create-match.service";
import { GetMatchById } from "../match/services/get-match-by-id.service";
import { OnScorecardLocked } from "../scorecards/on-scorecard-locked";
import { TeamRepository } from "../teams/repositories/team.repository";
import { VenueRepository } from "../venue/repositories/venue.repository";
import { createTeamMatchesController } from "./controllers/team-matches.controller";
import { PrismaTeamMatchRepository } from "./repositories/prisma-team-match.repository";
import { TeamMatchRepository } from "./repositories/team-match.repository";
import { createTeamMatchesRoutes } from "./routes/team-matches.routes";
import { CompleteTeamMatchOnScorecardLock } from "./services/complete-on-scorecard-lock";
import {
  AcceptTeamMatch,
  CancelTeamMatch,
  CompleteTeamMatch,
  CreateTeamMatch,
  DeclineTeamMatch,
  GetTeamMatch,
  JoinTeamMatch,
  ListMyTeamMatches,
  ListTeamMatches,
  ScheduleTeamMatch,
  SetTeamMatchLineup,
  StartTeamMatch,
} from "./services/team-matches.service";

export type CreateTeamMatchesModuleParams = {
  prisma: PrismaClient;
  teamRepository: TeamRepository;
  venueRepository: VenueRepository;
  matchRepository: MatchRepository;
  golfRoundRepository: GolfRoundRepository;
  dartsMatchRepository: DartsMatchRepository;
  friendProfileLookup: FriendProfileLookup;
  teamMatchRepository?: TeamMatchRepository;
  onTeamMatchCompleted?: (match: import("./entities/team-match").TeamMatch) => Promise<void>;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type TeamMatchesModule = {
  router: Router;
  teamMatchRepository: TeamMatchRepository;
  onScorecardLocked: OnScorecardLocked;
};

export function createTeamMatchesModule({
  prisma,
  teamRepository,
  venueRepository,
  matchRepository,
  golfRoundRepository,
  dartsMatchRepository,
  friendProfileLookup,
  teamMatchRepository: teamMatchRepositoryOverride,
  onTeamMatchCompleted,
  tryGetSessionUserId,
  requireAuth,
}: CreateTeamMatchesModuleParams): TeamMatchesModule {
  const teamMatchRepository =
    teamMatchRepositoryOverride ?? new PrismaTeamMatchRepository(prisma);

  const getMatchById = new GetMatchById(matchRepository);
  const getGolfRoundById = new GetGolfRoundById(golfRoundRepository);
  const getDartsMatchById = new GetDartsMatchById(dartsMatchRepository);
  const completeOnLock = new CompleteTeamMatchOnScorecardLock(
    teamMatchRepository,
    onTeamMatchCompleted,
  );

  const controller = createTeamMatchesController({
    createTeamMatch: new CreateTeamMatch(
      teamRepository,
      teamMatchRepository,
      friendProfileLookup,
    ),
    joinTeamMatch: new JoinTeamMatch(
      teamRepository,
      teamMatchRepository,
      friendProfileLookup,
    ),
    acceptTeamMatch: new AcceptTeamMatch(
      teamRepository,
      teamMatchRepository,
      friendProfileLookup,
    ),
    declineTeamMatch: new DeclineTeamMatch(
      teamRepository,
      teamMatchRepository,
      friendProfileLookup,
    ),
    scheduleTeamMatch: new ScheduleTeamMatch(
      teamRepository,
      teamMatchRepository,
      friendProfileLookup,
    ),
    setTeamMatchLineup: new SetTeamMatchLineup(
      teamRepository,
      teamMatchRepository,
      friendProfileLookup,
    ),
    startTeamMatch: new StartTeamMatch(
      teamRepository,
      teamMatchRepository,
      friendProfileLookup,
      venueRepository,
      new CreateMatch(matchRepository, venueRepository),
      new CreateGolfRound(
        golfRoundRepository,
        venueRepository,
        new PrismaGolfHandicapIndexLookup(prisma),
      ),
      new CreateDartsMatch(dartsMatchRepository, venueRepository),
    ),
    cancelTeamMatch: new CancelTeamMatch(
      teamRepository,
      teamMatchRepository,
      friendProfileLookup,
    ),
    completeTeamMatch: new CompleteTeamMatch(
      teamRepository,
      teamMatchRepository,
      friendProfileLookup,
      getMatchById,
      getGolfRoundById,
      getDartsMatchById,
      onTeamMatchCompleted,
    ),
    getTeamMatch: new GetTeamMatch(
      teamRepository,
      teamMatchRepository,
      friendProfileLookup,
    ),
    listTeamMatches: new ListTeamMatches(
      teamRepository,
      teamMatchRepository,
      friendProfileLookup,
    ),
    listMyTeamMatches: new ListMyTeamMatches(
      teamRepository,
      teamMatchRepository,
      friendProfileLookup,
    ),
    tryGetSessionUserId,
  });

  return {
    router: createTeamMatchesRoutes(controller, { requireAuth }),
    teamMatchRepository,
    onScorecardLocked: (event) => completeOnLock.execute(event),
  };
}

export { createTeamMatchesController } from "./controllers/team-matches.controller";
export { InMemoryTeamMatchRepository } from "./repositories/in-memory-team-match.repository";
export { PrismaTeamMatchRepository } from "./repositories/prisma-team-match.repository";
export type { TeamMatchRepository } from "./repositories/team-match.repository";
export { TeamMatch } from "./entities/team-match";
export { CompleteTeamMatchOnScorecardLock } from "./services/complete-on-scorecard-lock";
export {
  AcceptTeamMatch,
  CancelTeamMatch,
  CompleteTeamMatch,
  CreateTeamMatch,
  DeclineTeamMatch,
  GetTeamMatch,
  JoinTeamMatch,
  ListMyTeamMatches,
  ListTeamMatches,
  ScheduleTeamMatch,
  SetTeamMatchLineup,
  StartTeamMatch,
} from "./services/team-matches.service";
export type {
  PublicScorecard,
  PublicTeamMatch,
  PublicTeamRef,
  PublicUser,
} from "./services/team-matches.service";
