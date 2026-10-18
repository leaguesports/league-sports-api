import { InviteCodeCollisionError } from "../entities/errors";
import { cloneRecord, GameDayRecord, WeekendRecord } from "../entities/record";
import { GameDayRepository } from "./game-day.repository";

export class InMemoryGameDayRepository implements GameDayRepository {
  private readonly days = new Map<string, GameDayRecord>();
  private readonly weekends = new Map<string, WeekendRecord>();
  private readonly byInvite = new Map<string, string>();
  private readonly byWatch = new Map<string, string>();

  async create(day: GameDayRecord): Promise<GameDayRecord> {
    if (this.byInvite.has(day.inviteCode) || this.byWatch.has(day.watchTokenHash)) {
      throw new InviteCodeCollisionError();
    }
    const stored = cloneRecord(day);
    this.days.set(stored.id, stored);
    this.byInvite.set(stored.inviteCode, stored.id);
    this.byWatch.set(stored.watchTokenHash, stored.id);
    return cloneRecord(stored);
  }

  async createWeekend(event: WeekendRecord): Promise<WeekendRecord> {
    const stored = cloneRecord(event);
    this.weekends.set(stored.id, stored);
    return cloneRecord(stored);
  }

  async findWeekend(id: string): Promise<WeekendRecord | null> {
    const found = this.weekends.get(id);
    return found ? cloneRecord(found) : null;
  }

  async updateWeekend(
    id: string,
    mutate: (event: WeekendRecord) => void,
  ): Promise<WeekendRecord | null> {
    const current = this.weekends.get(id);
    if (!current) return null;
    const draft = cloneRecord(current);
    mutate(draft);
    this.weekends.set(id, draft);
    return cloneRecord(draft);
  }

  async findById(id: string): Promise<GameDayRecord | null> {
    const found = this.days.get(id);
    return found ? cloneRecord(found) : null;
  }

  async findByInviteCode(code: string): Promise<GameDayRecord | null> {
    const id = this.byInvite.get(code.trim().toUpperCase());
    return id ? this.findById(id) : null;
  }

  async findByWatchTokenHash(hash: string): Promise<GameDayRecord | null> {
    const id = this.byWatch.get(hash);
    return id ? this.findById(id) : null;
  }

  async listByWeekend(weekendEventId: string): Promise<GameDayRecord[]> {
    return [...this.days.values()]
      .filter((day) => day.weekendEventId === weekendEventId)
      .map((day) => cloneRecord(day));
  }

  async update(
    id: string,
    mutate: (day: GameDayRecord) => void,
  ): Promise<GameDayRecord | null> {
    const current = this.days.get(id);
    if (!current) return null;
    const draft = cloneRecord(current);
    mutate(draft);
    this.days.set(id, draft);
    return cloneRecord(draft);
  }
}
