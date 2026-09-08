import { DomainError } from "../../../lib/domain-error";
import { CoverageIntent } from "../entities/coverage-intent";
import { CoverageSportValue } from "../entities/coverage-sport";
import { CoverageIntentRepository } from "../repositories/coverage-intent.repository";
import { normalizeCoverageEmail } from "../entities/coverage-intent";

export type PublicCoverageIntent = {
  id: string;
  sport: CoverageSportValue | null;
  city: string | null;
  sourcePage: string | null;
  createdAt: string;
};

function toPublic(intent: CoverageIntent): PublicCoverageIntent {
  const snapshot = intent.toSnapshot();
  return {
    id: snapshot.id,
    sport: snapshot.sport,
    city: snapshot.city,
    sourcePage: snapshot.sourcePage,
    createdAt: snapshot.createdAt,
  };
}

export class UpsertCoverageIntent {
  constructor(private readonly repository: CoverageIntentRepository) {}

  async execute(input: {
    email: unknown;
    sport?: unknown;
    city?: unknown;
    sourcePage?: unknown;
  }): Promise<{ intent: PublicCoverageIntent }> {
    const created = CoverageIntent.create(input);
    const saved = await this.repository.upsert(created);
    return { intent: toPublic(saved) };
  }
}

export class UnsubscribeCoverageIntents {
  constructor(private readonly repository: CoverageIntentRepository) {}

  async execute(input: { email: string }): Promise<{
    unsubscribed: true;
    count: number;
  }> {
    const email = normalizeCoverageEmail(input.email);
    const count = await this.repository.unsubscribeAllByEmail(email);
    return { unsubscribed: true, count };
  }
}

export function requireCoverageUnsubscribeEmail(
  parse: (secret: string, token: string) => string,
  secret: string,
  token: string,
): string {
  try {
    return parse(secret, token);
  } catch {
    throw new DomainError("unsubscribe token is invalid");
  }
}
