import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { z } from "zod";

import { PrismaClient } from "../generated/prisma/client";

export const prismaConfigSchema = z.object({
  DATABASE_URL: z.string(),
});

export function createPrismaClient(config: { DATABASE_URL: string }): PrismaClient {
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}
