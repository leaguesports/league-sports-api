import { GolfTour } from "../entities/golf-tour";

export interface GolfTourRepository {
  findById(id: string): Promise<GolfTour | null>;
  findByGolfRoundId(golfRoundId: string): Promise<GolfTour | null>;
  create(tour: GolfTour): Promise<GolfTour>;
  persist(tour: GolfTour): Promise<GolfTour>;
  listForHost(userId: string): Promise<GolfTour[]>;
  listForPlayerUserId(userId: string): Promise<GolfTour[]>;
}
