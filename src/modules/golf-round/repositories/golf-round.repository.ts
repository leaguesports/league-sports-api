import { CmsId } from "../../venue/entities/cms-id";
import { GolfRound } from "../entities/golf-round";

export interface GolfRoundRepository {
  findById(id: string): Promise<GolfRound | null>;
  create(round: GolfRound): Promise<GolfRound>;
  persistLock(round: GolfRound): Promise<GolfRound>;
  listLockedByPlayerUserId(userId: string): Promise<GolfRound[]>;
  listLockedByVenueCmsId(cmsId: CmsId): Promise<GolfRound[]>;
  /** Session-attributed lock timestamps for badge evaluation. */
  listLockedAtForBadges(userId: string): Promise<Date[]>;
}
