import { CmsId } from "../../venue/entities/cms-id";
import { DartsMatch } from "../entities/darts-match";

export interface DartsMatchRepository {
  findById(id: string): Promise<DartsMatch | null>;
  create(match: DartsMatch): Promise<DartsMatch>;
  persist(match: DartsMatch): Promise<DartsMatch>;
  listLockedByPlayerUserId(userId: string): Promise<DartsMatch[]>;
  listLockedByVenueCmsId(cmsId: CmsId): Promise<DartsMatch[]>;
}
