import { CmsId } from "../../venue/domain/cmsId";
import { Match } from "./match";

export interface MatchRepository {
  findById(id: string): Promise<Match | null>;
  create(match: Match): Promise<Match>;
  persistLock(match: Match): Promise<Match>;
  listLockedByPlayerUserId(userId: string): Promise<Match[]>;
  listLockedByVenueCmsId(cmsId: CmsId): Promise<Match[]>;
}
