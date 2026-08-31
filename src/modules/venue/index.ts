import { Request, Router } from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { createVenueController } from "./controllers/venue.controller";
import { PrismaVenueRepository } from "./repositories/prisma-venue.repository";
import { VenueRepository } from "./repositories/venue.repository";
import { createVenueRoutes } from "./routes/venue.routes";
import { EnsureVenueFromCms } from "./services/ensure-venue-from-cms.service";
import { GetVenueByCmsId } from "./services/get-venue-by-cms-id.service";

export type CreateVenueModuleParams = {
  prisma: PrismaClient;
  venueRepository?: VenueRepository;
  hasAuthenticatedCaller: (req: Request) => boolean;
};

export type VenueModule = {
  router: Router;
  venueRepository: VenueRepository;
};

export function createVenueModule({
  prisma,
  venueRepository: venueRepositoryOverride,
  hasAuthenticatedCaller,
}: CreateVenueModuleParams): VenueModule {
  const venueRepository =
    venueRepositoryOverride ?? new PrismaVenueRepository(prisma);

  const controller = createVenueController({
    getVenueByCmsId: new GetVenueByCmsId(venueRepository),
    ensureVenueFromCms: new EnsureVenueFromCms(venueRepository),
    hasAuthenticatedCaller,
  });

  return {
    router: createVenueRoutes(controller),
    venueRepository,
  };
}

export { createVenueController } from "./controllers/venue.controller";
export { CmsId } from "./entities/cms-id";
export { Slug } from "./entities/slug";
export { Venue } from "./entities/venue";
export { VenueName } from "./entities/venue-name";
export { InMemoryVenueRepository } from "./repositories/in-memory-venue.repository";
export { PrismaVenueRepository } from "./repositories/prisma-venue.repository";
export { VenuePersistenceError } from "./repositories/venue-persistence-error";
export type { VenueRepository } from "./repositories/venue.repository";
export { EnsureVenueFromCms } from "./services/ensure-venue-from-cms.service";
export { GetVenueByCmsId } from "./services/get-venue-by-cms-id.service";
