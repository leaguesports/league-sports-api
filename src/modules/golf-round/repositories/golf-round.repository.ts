import { CmsId } from "../../venue/entities/cms-id";
import { GolfRound } from "../entities/golf-round";

export interface GolfRoundRepository {
  findById(id: string): Promise<GolfRound | null>;
  create(round: GolfRound): Promise<GolfRound>;
  persistLock(round: GolfRound): Promise<GolfRound>;
  /** Clear lock, score, and totals. Idempotent when the round is already live. */
  persistUnlock(round: GolfRound): Promise<GolfRound>;
  /** Update the score JSON and totals of a round that is already locked. */
  persistLockedScore(round: GolfRound): Promise<GolfRound>;
  listLockedByPlayerUserId(userId: string): Promise<GolfRound[]>;
  listLockedByVenueCmsId(cmsId: CmsId): Promise<GolfRound[]>;
  /** Session-attributed lock timestamps for badge evaluation. */
  listLockedAtForBadges(userId: string): Promise<Date[]>;
  /** Link a round created for a game-day card. Null stays the default. */
  attachToGameDay(roundId: string, gameDayId: string): Promise<void>;
  /**
   * Insert players seated after create. Existing slots are left as stored.
   * The round argument is the source of truth for the new roster.
   */
  persistRoster(round: GolfRound): Promise<GolfRound>;
}
