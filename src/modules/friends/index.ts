import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { createFriendsController } from "./controllers/friends.controller";
import { InMemoryFriendProfileLookup } from "./repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "./repositories/in-memory-friendship.repository";
import { PrismaFriendProfileLookup } from "./repositories/prisma-friend-profile.lookup";
import { PrismaFriendshipRepository } from "./repositories/prisma-friendship.repository";
import {
  FriendProfileLookup,
  FriendshipRepository,
} from "./repositories/friendship.repository";
import { createFriendsRoutes } from "./routes/friends.routes";
import {
  AcceptFriend,
  ListFriends,
  RemoveFriend,
  RequestFriend,
} from "./services/friends.service";

export type CreateFriendsModuleParams = {
  prisma: PrismaClient;
  friendshipRepository?: FriendshipRepository;
  friendProfileLookup?: FriendProfileLookup;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type FriendsModule = {
  router: Router;
  friendshipRepository: FriendshipRepository;
  friendProfileLookup: FriendProfileLookup;
};

export function createFriendsModule({
  prisma,
  friendshipRepository: friendshipRepositoryOverride,
  friendProfileLookup: friendProfileLookupOverride,
  tryGetSessionUserId,
  requireAuth,
}: CreateFriendsModuleParams): FriendsModule {
  const friendshipRepository =
    friendshipRepositoryOverride ?? new PrismaFriendshipRepository(prisma);

  const friendProfileLookup =
    friendProfileLookupOverride ??
    (friendshipRepositoryOverride
      ? new InMemoryFriendProfileLookup()
      : new PrismaFriendProfileLookup(prisma));

  const controller = createFriendsController({
    requestFriend: new RequestFriend(friendshipRepository, friendProfileLookup),
    acceptFriend: new AcceptFriend(friendshipRepository, friendProfileLookup),
    removeFriend: new RemoveFriend(friendshipRepository),
    listFriends: new ListFriends(friendshipRepository, friendProfileLookup),
    tryGetSessionUserId,
  });

  return {
    router: createFriendsRoutes(controller, { requireAuth }),
    friendshipRepository,
    friendProfileLookup,
  };
}

export { createFriendsController } from "./controllers/friends.controller";
export { InMemoryFriendProfileLookup } from "./repositories/in-memory-friend-profile.lookup";
export { InMemoryFriendshipRepository } from "./repositories/in-memory-friendship.repository";
export { PrismaFriendProfileLookup } from "./repositories/prisma-friend-profile.lookup";
export { PrismaFriendshipRepository } from "./repositories/prisma-friendship.repository";
export { FriendshipPersistenceError } from "./repositories/friendship-persistence-error";
export type {
  FriendProfile,
  FriendProfileLookup,
  FriendshipRecord,
  FriendshipRepository,
} from "./repositories/friendship.repository";
export {
  AcceptFriend,
  AlreadyFriendsError,
  FriendNotFoundError,
  FriendRequestAlreadySentError,
  FriendRequestNotFoundError,
  ListFriends,
  RemoveFriend,
  RequestFriend,
} from "./services/friends.service";
