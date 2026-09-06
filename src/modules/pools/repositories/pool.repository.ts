import { PredictionPool } from "../entities/prediction-pool";

export interface PoolRepository {
  findById(id: string): Promise<PredictionPool | null>;
  findByInviteCode(inviteCode: string): Promise<PredictionPool | null>;
  findByIdOrCode(idOrCode: string): Promise<PredictionPool | null>;
  create(pool: PredictionPool): Promise<PredictionPool>;
  persist(pool: PredictionPool): Promise<PredictionPool>;
}
