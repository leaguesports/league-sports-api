import { CmsId } from "../../venue/entities/cms-id";
import { Match } from "../entities/match";

export type LockedPadelBadgeRow = {
  lockedAt: Date;
  won: boolean | null;
};

export interface MatchRepository {
  findById(id: string): Promise<Match | null>;
  create(match: Match): Promise<Match>;
  persistLock(match: Match): Promise<Match>;
  listLockedByPlayerUserId(userId: string): Promise<Match[]>;
  listLockedByVenueCmsId(cmsId: CmsId): Promise<Match[]>;
  /** Slim session-attributed locked-match rows for badge evaluation. */
  listLockedPadelResultsForBadges(userId: string): Promise<LockedPadelBadgeRow[]>;
}
