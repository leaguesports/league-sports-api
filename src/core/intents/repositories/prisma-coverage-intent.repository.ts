import { PrismaClient } from "../../../generated/prisma/client";
import { CoverageIntent } from "../entities/coverage-intent";
import { CoveragePersistenceError } from "../entities/coverage-persistence-error";
import { CoverageIntentRepository } from "./coverage-intent.repository";

type IntentRow = {
  id: string;
  email: string;
  sport: string;
  city: string;
  sourcePage: string | null;
  createdAt: Date;
  unsubscribedAt: Date | null;
};

function toIntent(row: IntentRow): CoverageIntent {
  return CoverageIntent.rehydrate({
    id: row.id,
    email: row.email,
    sport: row.sport === "" ? null : row.sport,
    city: row.city === "" ? null : row.city,
    sourcePage: row.sourcePage,
    createdAt: row.createdAt,
    unsubscribedAt: row.unsubscribedAt,
  });
}

export class PrismaCoverageIntentRepository
  implements CoverageIntentRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(intent: CoverageIntent): Promise<CoverageIntent> {
    const snapshot = intent.toSnapshot();
    const { sport, city } = intent.uniquenessKey();
    try {
      const row = await this.prisma.coverageIntent.upsert({
        where: {
          email_sport_city: { email: snapshot.email, sport, city },
        },
        create: {
          id: snapshot.id,
          email: snapshot.email,
          sport,
          city,
          sourcePage: snapshot.sourcePage,
          createdAt: intent.createdAt,
        },
        update: {
          unsubscribedAt: null,
          ...(snapshot.sourcePage != null
            ? { sourcePage: snapshot.sourcePage }
            : {}),
        },
      });
      return toIntent(row);
    } catch (error) {
      throw new CoveragePersistenceError("Failed to save coverage intent", {
        cause: error,
      });
    }
  }

  async findByEmailSportCity(
    email: string,
    sport: string,
    city: string,
  ): Promise<CoverageIntent | null> {
    try {
      const row = await this.prisma.coverageIntent.findUnique({
        where: { email_sport_city: { email, sport, city } },
      });
      return row ? toIntent(row) : null;
    } catch (error) {
      throw new CoveragePersistenceError("Failed to load coverage intent", {
        cause: error,
      });
    }
  }

  async unsubscribeAllByEmail(
    email: string,
    now = new Date(),
  ): Promise<number> {
    try {
      const result = await this.prisma.coverageIntent.updateMany({
        where: { email, unsubscribedAt: null },
        data: { unsubscribedAt: now },
      });
      return result.count;
    } catch (error) {
      throw new CoveragePersistenceError("Failed to unsubscribe", {
        cause: error,
      });
    }
  }
}
