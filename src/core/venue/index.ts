import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { createVenueController } from "./controllers/venue.controller";
import { InMemoryVenueFollowRepository } from "./repositories/in-memory-venue-follow.repository";
import { PrismaVenueFollowRepository } from "./repositories/prisma-venue-follow.repository";
import { PrismaVenueRepository } from "./repositories/prisma-venue.repository";
import { VenueFollowRepository } from "./repositories/venue-follow.repository";
import { VenueRepository } from "./repositories/venue.repository";
import { createVenueRoutes } from "./routes/venue.routes";
import { EnsureVenueFromCms } from "./services/ensure-venue-from-cms.service";
import { FollowVenue } from "./services/follow-venue.service";
import { GetVenueByCmsId } from "./services/get-venue-by-cms-id.service";
import { GetVenueFollowStatus } from "./services/get-venue-follow-status.service";
import { ListFollowedVenues } from "./services/list-followed-venues.service";
import { UnfollowVenue } from "./services/unfollow-venue.service";

export type CreateVenueModuleParams = {
  prisma: PrismaClient;
  venueRepository?: VenueRepository;
  venueFollowRepository?: VenueFollowRepository;
  hasAuthenticatedCaller: (req: Request) => boolean;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type VenueModule = {
  router: Router;
  venueRepository: VenueRepository;
  venueFollowRepository: VenueFollowRepository;
};

export function createVenueModule({
  prisma,
  venueRepository: venueRepositoryOverride,
  venueFollowRepository: venueFollowRepositoryOverride,
  hasAuthenticatedCaller,
  tryGetSessionUserId,
  requireAuth,
}: CreateVenueModuleParams): VenueModule {
  const venueRepository =
    venueRepositoryOverride ?? new PrismaVenueRepository(prisma);

  const venueFollowRepository =
    venueFollowRepositoryOverride ??
    (venueRepositoryOverride
      ? new InMemoryVenueFollowRepository((cmsId) =>
          venueRepository.findByCmsId(cmsId),
        )
      : new PrismaVenueFollowRepository(prisma));

  const controller = createVenueController({
    getVenueByCmsId: new GetVenueByCmsId(venueRepository),
    ensureVenueFromCms: new EnsureVenueFromCms(venueRepository),
    followVenue: new FollowVenue(venueRepository, venueFollowRepository),
    unfollowVenue: new UnfollowVenue(venueRepository, venueFollowRepository),
    getVenueFollowStatus: new GetVenueFollowStatus(
      venueRepository,
      venueFollowRepository,
    ),
    listFollowedVenues: new ListFollowedVenues(venueFollowRepository),
    hasAuthenticatedCaller,
    tryGetSessionUserId,
  });

  return {
    router: createVenueRoutes(controller, { requireAuth }),
    venueRepository,
    venueFollowRepository,
  };
}

export { createVenueController } from "./controllers/venue.controller";
export { CmsId } from "./entities/cms-id";
export { Slug } from "./entities/slug";
export { Venue } from "./entities/venue";
export { VenueName } from "./entities/venue-name";
export { InMemoryVenueFollowRepository } from "./repositories/in-memory-venue-follow.repository";
export { InMemoryVenueRepository } from "./repositories/in-memory-venue.repository";
export { PrismaVenueFollowRepository } from "./repositories/prisma-venue-follow.repository";
export { PrismaVenueRepository } from "./repositories/prisma-venue.repository";
export { VenuePersistenceError } from "./repositories/venue-persistence-error";
export type { VenueFollowRepository } from "./repositories/venue-follow.repository";
export type { VenueRepository } from "./repositories/venue.repository";
export { EnsureVenueFromCms } from "./services/ensure-venue-from-cms.service";
export { FollowVenue } from "./services/follow-venue.service";
export { GetVenueByCmsId } from "./services/get-venue-by-cms-id.service";
export { GetVenueFollowStatus } from "./services/get-venue-follow-status.service";
export { ListFollowedVenues } from "./services/list-followed-venues.service";
export { UnfollowVenue } from "./services/unfollow-venue.service";
