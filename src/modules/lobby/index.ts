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
import { LobbyNotifier } from "../notifications/services/notifications.service";
import { OrganisedGameRepository } from "../organised-games/repositories/organised-game.repository";
import { TeamRepository } from "../teams/repositories/team.repository";
import { VenueRepository } from "../venue/repositories/venue.repository";
import { createLobbyController } from "./controllers/lobby.controller";
import { LobbyRepository } from "./repositories/lobby.repository";
import { PrismaLobbyRepository } from "./repositories/prisma-lobby.repository";
import { createLobbyRoutes } from "./routes/lobby.routes";
import { ConvertLobbyToOrganisedGame } from "./services/convert-to-organise";
import {
  ClearLooking,
  CreateOpenGame,
  JoinOpenGame,
  KickOpenGame,
  ListLobby,
  ListMyProposals,
  RespondToProposal,
  SetLooking,
} from "./services/lobby.service";

export type CreateLobbyModuleParams = {
  prisma: PrismaClient;
  lobbyRepository?: LobbyRepository;
  organisedGameRepository: OrganisedGameRepository;
  venueRepository: VenueRepository;
  friendshipRepository: FriendshipRepository;
  teamRepository: TeamRepository;
  friendProfileLookup: FriendProfileLookup;
  lobbyNotifier?: LobbyNotifier;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type LobbyModule = {
  router: Router;
  lobbyRepository: LobbyRepository;
};

export function createLobbyModule({
  prisma,
  lobbyRepository: lobbyRepositoryOverride,
  organisedGameRepository,
  venueRepository,
  friendshipRepository,
  teamRepository,
  friendProfileLookup,
  lobbyNotifier,
  tryGetSessionUserId,
  requireAuth,
}: CreateLobbyModuleParams): LobbyModule {
  const lobbyRepository =
    lobbyRepositoryOverride ?? new PrismaLobbyRepository(prisma);
  const converter = new ConvertLobbyToOrganisedGame(
    organisedGameRepository,
    venueRepository,
  );

  const controller = createLobbyController({
    listLobby: new ListLobby(
      lobbyRepository,
      friendProfileLookup,
      friendshipRepository,
      teamRepository,
    ),
    setLooking: new SetLooking(
      lobbyRepository,
      friendProfileLookup,
      lobbyNotifier,
      converter,
    ),
    clearLooking: new ClearLooking(lobbyRepository),
    createOpenGame: new CreateOpenGame(
      lobbyRepository,
      friendProfileLookup,
      lobbyNotifier,
    ),
    joinOpenGame: new JoinOpenGame(
      lobbyRepository,
      friendProfileLookup,
      lobbyNotifier,
      converter,
    ),
    kickOpenGame: new KickOpenGame(lobbyRepository, friendProfileLookup),
    listMyProposals: new ListMyProposals(lobbyRepository, friendProfileLookup),
    respondToProposal: new RespondToProposal(
      lobbyRepository,
      friendProfileLookup,
      lobbyNotifier,
      converter,
    ),
    tryGetSessionUserId,
  });

  return {
    router: createLobbyRoutes(controller, { requireAuth }),
    lobbyRepository,
  };
}

export { createLobbyController } from "./controllers/lobby.controller";
export { InMemoryLobbyRepository } from "./repositories/in-memory-lobby.repository";
export { PrismaLobbyRepository } from "./repositories/prisma-lobby.repository";
export type { LobbyRepository } from "./repositories/lobby.repository";
export { LobbyLooking } from "./entities/lobby-looking";
export { LobbyOpenGame } from "./entities/lobby-open-game";
export { LobbyProposal } from "./entities/lobby-proposal";
export { LobbySport, LOBBY_SPORTS } from "./entities/lobby-sport";
export { ConvertLobbyToOrganisedGame } from "./services/convert-to-organise";
export {
  ClearLooking,
  CreateOpenGame,
  JoinOpenGame,
  KickOpenGame,
  ListLobby,
  ListMyProposals,
  RespondToProposal,
  SetLooking,
} from "./services/lobby.service";
