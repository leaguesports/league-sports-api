import { CoverageIntent } from "../entities/coverage-intent";
import { CoverageIntentRepository } from "./coverage-intent.repository";

function rowKey(email: string, sport: string, city: string): string {
  return `${email}::${sport}::${city}`;
}

export class InMemoryCoverageIntentRepository
  implements CoverageIntentRepository
{
  private readonly byId = new Map<string, CoverageIntent>();
  private readonly keys = new Map<string, string>();

  async upsert(intent: CoverageIntent): Promise<CoverageIntent> {
    const { sport, city } = intent.uniquenessKey();
    const key = rowKey(intent.email, sport, city);
    const existingId = this.keys.get(key);
    if (existingId) {
      const existing = this.byId.get(existingId)!;
      const next = existing.reactivate(
        intent.sourcePage !== null ? intent.sourcePage : undefined,
      );
      this.byId.set(next.id, next);
      return clone(next);
    }
    const stored = clone(intent);
    this.byId.set(stored.id, stored);
    this.keys.set(key, stored.id);
    return clone(stored);
  }

  async findByEmailSportCity(
    email: string,
    sport: string,
    city: string,
  ): Promise<CoverageIntent | null> {
    const id = this.keys.get(rowKey(email, sport, city));
    if (!id) return null;
    return clone(this.byId.get(id)!);
  }

  async unsubscribeAllByEmail(email: string, now = new Date()): Promise<number> {
    let count = 0;
    for (const intent of this.byId.values()) {
      if (intent.email !== email || !intent.isActive) continue;
      const next = intent.unsubscribe(now);
      this.byId.set(next.id, next);
      count += 1;
    }
    return count;
  }

  seed(intent: CoverageIntent): CoverageIntent {
    const stored = clone(intent);
    const { sport, city } = stored.uniquenessKey();
    this.byId.set(stored.id, stored);
    this.keys.set(rowKey(stored.email, sport, city), stored.id);
    return clone(stored);
  }

  all(): CoverageIntent[] {
    return [...this.byId.values()].map(clone);
  }
}

function clone(intent: CoverageIntent): CoverageIntent {
  return CoverageIntent.fromSnapshot(intent.toSnapshot());
}
