import { GameDayRecord, WeekendRecord } from "../entities/record";

export interface GameDayRepository {
  create(day: GameDayRecord): Promise<GameDayRecord>;
  createWeekend(event: WeekendRecord): Promise<WeekendRecord>;
  findWeekend(id: string): Promise<WeekendRecord | null>;
  findById(id: string): Promise<GameDayRecord | null>;
  findByInviteCode(code: string): Promise<GameDayRecord | null>;
  findByWatchTokenHash(hash: string): Promise<GameDayRecord | null>;
  listByWeekend(weekendEventId: string): Promise<GameDayRecord[]>;
  /**
   * Load a draft, run mutate, and store it. Throw from mutate to leave the
   * stored day unchanged. Returns null when the id does not exist.
   */
  update(
    id: string,
    mutate: (day: GameDayRecord) => void,
  ): Promise<GameDayRecord | null>;
}
