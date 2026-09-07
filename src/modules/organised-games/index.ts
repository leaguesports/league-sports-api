import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import {
  FriendProfileLookup,
  FriendshipRepository,
} from "../friends/repositories/friendship.repository";
import { GolfRoundRepository } from "../golf-round/repositories/golf-round.repository";
import { CreateGolfRound } from "../golf-round/services/create-golf-round.service";
import { MatchRepository } from "../match/repositories/match.repository";
import { CreateMatch } from "../match/services/create-match.service";
import { VenueRepository } from "../venue/repositories/venue.repository";
import { createOrganisedGamesController } from "./controllers/organised-games.controller";
import { OrganisedGameRepository } from "./repositories/organised-game.repository";
import { PrismaOrganisedGameRepository } from "./repositories/prisma-organised-game.repository";
import { createOrganisedGamesRoutes } from "./routes/organised-games.routes";
import {
  CancelOrganisedGame,
  CreateOrganisedGame,
  GetOrganisedGame,
  GetOrganisedGameByToken,
  InviteFriends,
  JoinByInviteToken,
  ListInvites,
  ListMyOrganisedGames,
  RsvpOrganisedGame,
  StartOrganisedGame,
} from "./services/organised-games.service";

export type CreateOrganisedGamesModuleParams = {
  prisma: PrismaClient;
  venueRepository: VenueRepository;
  friendshipRepository: FriendshipRepository;
  friendProfileLookup: FriendProfileLookup;
  matchRepository: MatchRepository;
  golfRoundRepository: GolfRoundRepository;
  organisedGameRepository?: OrganisedGameRepository;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type OrganisedGamesModule = {
  router: Router;
  organisedGameRepository: OrganisedGameRepository;
};

export function createOrganisedGamesModule({
  prisma,
  venueRepository,
  friendshipRepository,
  friendProfileLookup,
  matchRepository,
  golfRoundRepository,
  organisedGameRepository: organisedGameRepositoryOverride,
  tryGetSessionUserId,
  requireAuth,
}: CreateOrganisedGamesModuleParams): OrganisedGamesModule {
  const organisedGameRepository =
    organisedGameRepositoryOverride ??
    new PrismaOrganisedGameRepository(prisma);

  const controller = createOrganisedGamesController({
    createOrganisedGame: new CreateOrganisedGame(
      organisedGameRepository,
      venueRepository,
      friendshipRepository,
      friendProfileLookup,
    ),
    getOrganisedGame: new GetOrganisedGame(
      organisedGameRepository,
      friendProfileLookup,
    ),
    getOrganisedGameByToken: new GetOrganisedGameByToken(
      organisedGameRepository,
      friendProfileLookup,
    ),
    listMyOrganisedGames: new ListMyOrganisedGames(
      organisedGameRepository,
      friendProfileLookup,
    ),
    inviteFriends: new InviteFriends(
      organisedGameRepository,
      friendshipRepository,
      friendProfileLookup,
    ),
    listInvites: new ListInvites(organisedGameRepository, friendProfileLookup),
    joinByInviteToken: new JoinByInviteToken(
      organisedGameRepository,
      friendProfileLookup,
    ),
    rsvpOrganisedGame: new RsvpOrganisedGame(
      organisedGameRepository,
      friendProfileLookup,
    ),
    cancelOrganisedGame: new CancelOrganisedGame(
      organisedGameRepository,
      friendProfileLookup,
    ),
    startOrganisedGame: new StartOrganisedGame(
      organisedGameRepository,
      friendProfileLookup,
      new CreateMatch(matchRepository, venueRepository),
      new CreateGolfRound(golfRoundRepository, venueRepository),
    ),
    tryGetSessionUserId,
  });

  return {
    router: createOrganisedGamesRoutes(controller, { requireAuth }),
    organisedGameRepository,
  };
}

export { createOrganisedGamesController } from "./controllers/organised-games.controller";
export { InMemoryOrganisedGameRepository } from "./repositories/in-memory-organised-game.repository";
export { PrismaOrganisedGameRepository } from "./repositories/prisma-organised-game.repository";
export type { OrganisedGameRepository } from "./repositories/organised-game.repository";
export { OrganisedGame } from "./entities/organised-game";
export {
  START_WINDOW_AFTER_MS,
  START_WINDOW_BEFORE_MS,
} from "./entities/organised-game";
export { OrganisedGameSport } from "./entities/organised-game-sport";
export { OrganisedGameStatus } from "./entities/organised-game-status";
export { OrganisedGameRsvp } from "./entities/organised-game-rsvp";
export { InviteToken } from "./entities/invite-token";
export {
  CancelOrganisedGame,
  CreateOrganisedGame,
  GetOrganisedGame,
  GetOrganisedGameByToken,
  InviteFriends,
  JoinByInviteToken,
  ListInvites,
  ListMyOrganisedGames,
  RsvpOrganisedGame,
  StartOrganisedGame,
} from "./services/organised-games.service";
export type {
  PublicInvitee,
  PublicLiveScorecard,
  PublicOrganisedGame,
  PublicUser,
} from "./services/organised-games.service";
