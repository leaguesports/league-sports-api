import { CmsId } from "../../venue/entities/cms-id";
import { Match } from "../entities/match";

export interface MatchRepository {
  findById(id: string): Promise<Match | null>;
  create(match: Match): Promise<Match>;
  persistLock(match: Match): Promise<Match>;
  listLockedByPlayerUserId(userId: string): Promise<Match[]>;
  listLockedByVenueCmsId(cmsId: CmsId): Promise<Match[]>;
}
