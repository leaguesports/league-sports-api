import { CoverageIntent } from "../entities/coverage-intent";

export interface CoverageIntentRepository {
  upsert(intent: CoverageIntent): Promise<CoverageIntent>;
  findByEmailSportCity(
    email: string,
    sport: string,
    city: string,
  ): Promise<CoverageIntent | null>;
  unsubscribeAllByEmail(email: string, now?: Date): Promise<number>;
}
