import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { Config } from "../config";
import { PrismaClient } from "../generated/prisma/client";

export function createPrismaClient(config: Config): PrismaClient {
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}
