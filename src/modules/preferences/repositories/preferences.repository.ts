export type UserPreferences = {
  userId: string;
  sports: string[];
  activeSport: string | null;
  onboardingCompletedAt: Date | null;
  onboardingSkippedAt: Date | null;
};

export type UpdateUserPreferencesInput = {
  sports?: string[];
  activeSport?: string | null;
  onboardingCompletedAt?: Date | null;
  onboardingSkippedAt?: Date | null;
};

export interface PreferencesRepository {
  getForUser(userId: string): Promise<UserPreferences>;
  updateForUser(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferences>;
}
