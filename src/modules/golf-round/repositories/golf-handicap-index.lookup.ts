export interface GolfHandicapIndexLookup {
  findByUserIds(userIds: string[]): Promise<Map<string, number | null>>;
}

export const emptyGolfHandicapIndexLookup: GolfHandicapIndexLookup = {
  async findByUserIds(userIds: string[]) {
    return new Map(userIds.map((userId) => [userId, null]));
  },
};

export class InMemoryGolfHandicapIndexLookup implements GolfHandicapIndexLookup {
  private readonly byUserId = new Map<string, number | null>();

  seed(userId: string, handicapIndex: number | null): void {
    this.byUserId.set(userId, handicapIndex);
  }

  async findByUserIds(userIds: string[]): Promise<Map<string, number | null>> {
    const found = new Map<string, number | null>();
    for (const userId of userIds) {
      found.set(userId, this.byUserId.get(userId) ?? null);
    }
    return found;
  }
}

export function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
