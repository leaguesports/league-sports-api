import { PrismaClient } from "../../../generated/prisma/client";
import {
  decimalToNumber,
  GolfHandicapIndexLookup,
} from "./golf-handicap-index.lookup";

export class PrismaGolfHandicapIndexLookup implements GolfHandicapIndexLookup {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserIds(userIds: string[]): Promise<Map<string, number | null>> {
    const found = new Map<string, number | null>();
    const unique = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
    for (const userId of unique) {
      found.set(userId, null);
    }
    if (unique.length === 0) {
      return found;
    }

    const rows = await this.prisma.profile.findMany({
      where: { userId: { in: unique } },
      select: { userId: true, golfHandicapIndex: true },
    });
    for (const row of rows) {
      found.set(row.userId, decimalToNumber(row.golfHandicapIndex));
    }
    return found;
  }
}
