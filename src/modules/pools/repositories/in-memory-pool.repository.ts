import { PredictionPool } from "../entities/prediction-pool";
import { PoolPersistenceError } from "../entities/pool-persistence-error";
import { PoolRepository } from "./pool.repository";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class InMemoryPoolRepository implements PoolRepository {
  private readonly byId = new Map<string, PredictionPool>();
  private readonly byCode = new Map<string, string>();

  async findById(id: string): Promise<PredictionPool | null> {
    return clone(this.byId.get(id) ?? null);
  }

  async findByInviteCode(inviteCode: string): Promise<PredictionPool | null> {
    const id = this.byCode.get(inviteCode.toLowerCase());
    if (!id) return null;
    return this.findById(id);
  }

  async findByIdOrCode(idOrCode: string): Promise<PredictionPool | null> {
    const trimmed = idOrCode.trim();
    if (!trimmed) return null;
    if (UUID_PATTERN.test(trimmed)) {
      return (await this.findById(trimmed)) ?? this.findByInviteCode(trimmed);
    }
    return this.findByInviteCode(trimmed);
  }

  async create(pool: PredictionPool): Promise<PredictionPool> {
    const stored = clone(pool)!;
    if (this.byCode.has(stored.inviteCode.value)) {
      throw new PoolPersistenceError("Invite code already in use");
    }
    this.byId.set(stored.id, stored);
    this.byCode.set(stored.inviteCode.value, stored.id);
    return clone(stored)!;
  }

  async persist(pool: PredictionPool): Promise<PredictionPool> {
    if (!this.byId.has(pool.id)) {
      throw new PoolPersistenceError("Unable to save prediction pool");
    }
    const stored = clone(pool)!;
    this.byId.set(stored.id, stored);
    this.byCode.set(stored.inviteCode.value, stored.id);
    return clone(stored)!;
  }
}

function clone(pool: PredictionPool | null): PredictionPool | null {
  if (!pool) return null;
  return PredictionPool.fromSnapshot(pool.toSnapshot());
}
