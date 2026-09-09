import { ScorecardLockedEvent } from "../../scorecards/on-scorecard-locked";
import { GolfTourPersistenceError } from "../entities/golf-tour-persistence-error";
import { GolfTourRepository } from "../repositories/golf-tour.repository";

export class LockGolfTourFourballOnScorecardLock {
  constructor(private readonly tours: GolfTourRepository) {}

  async execute(event: ScorecardLockedEvent): Promise<void> {
    if (event.sport !== "golf") return;
    try {
      const tour = await this.tours.findByGolfRoundId(event.scorecardId);
      if (!tour) return;
      const fourball = tour.lockFourballFromScorecard(event.scorecardId);
      if (!fourball) return;
      await this.tours.persist(tour);
    } catch (error) {
      if (error instanceof GolfTourPersistenceError) return;
      console.error("Failed to lock golf tour fourball from scorecard lock", error);
    }
  }
}
