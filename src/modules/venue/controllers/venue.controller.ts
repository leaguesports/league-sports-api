import { Request, Response } from "express";
import { z } from "zod";

import { EnsureVenueFromCms } from "../services/ensure-venue-from-cms.service";
import { GetVenueByCmsId } from "../services/get-venue-by-cms-id.service";
import { DomainError } from "../../../lib/domain-error";
import { VenuePersistenceError } from "../repositories/venue-persistence-error";

const cmsIdParamSchema = z.object({
  cmsId: z.string(),
});

const ensureVenueBodySchema = z.object({
  name: z.string(),
  slug: z.string(),
  cmsId: z.string().optional(),
});

export function createVenueController(deps: {
  getVenueByCmsId: GetVenueByCmsId;
  ensureVenueFromCms: EnsureVenueFromCms;
  hasAuthenticatedCaller: (req: Request) => boolean;
}) {
  return {
    async getByCmsId(req: Request, res: Response) {
      try {
        const { cmsId } = z.parse(cmsIdParamSchema, req.params);
        const venue = await deps.getVenueByCmsId.execute(cmsId);

        if (!venue) {
          return res.status(404).json({ error: "Venue not found" });
        }

        return res.status(200).json(venue.toSnapshot());
      } catch (error) {
        return sendVenueError(res, error);
      }
    },

    async ensureFromCms(req: Request, res: Response) {
      try {
        const { cmsId } = z.parse(cmsIdParamSchema, req.params);
        const body = z.parse(ensureVenueBodySchema, req.body ?? {});

        if (body.cmsId !== undefined && body.cmsId.trim() !== cmsId.trim()) {
          return res
            .status(400)
            .json({ error: "cmsId in body must match the path" });
        }

        const { venue, created } = await deps.ensureVenueFromCms.execute({
          cmsId,
          name: body.name,
          slug: body.slug,
          refreshDetails: deps.hasAuthenticatedCaller(req),
        });

        return res.status(created ? 201 : 200).json(venue.toSnapshot());
      } catch (error) {
        return sendVenueError(res, error);
      }
    },
  };
}

function sendVenueError(res: Response, error: unknown) {
  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid venue payload" });
  }

  if (error instanceof VenuePersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
