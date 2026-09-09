import {
  PreferencesRepository,
  UpdateUserPreferencesInput,
  UserPreferences,
} from "./preferences.repository";

function emptyPrefs(userId: string): UserPreferences {
  return {
    userId,
    sports: [],
    activeSport: null,
    onboardingCompletedAt: null,
    onboardingSkippedAt: null,
  };
}

export class InMemoryPreferencesRepository implements PreferencesRepository {
  private readonly byUserId = new Map<string, UserPreferences>();

  seed(prefs: UserPreferences): void {
    this.byUserId.set(prefs.userId, {
      ...prefs,
      sports: [...prefs.sports],
    });
  }

  async getForUser(userId: string): Promise<UserPreferences> {
    const existing = this.byUserId.get(userId);
    if (!existing) return emptyPrefs(userId);
    return { ...existing, sports: [...existing.sports] };
  }

  async updateForUser(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferences> {
    const current = await this.getForUser(userId);
    const next: UserPreferences = {
      userId,
      sports: input.sports !== undefined ? [...input.sports] : current.sports,
      activeSport:
        input.activeSport !== undefined
          ? input.activeSport
          : current.activeSport,
      onboardingCompletedAt:
        input.onboardingCompletedAt !== undefined
          ? input.onboardingCompletedAt
          : current.onboardingCompletedAt,
      onboardingSkippedAt:
        input.onboardingSkippedAt !== undefined
          ? input.onboardingSkippedAt
          : current.onboardingSkippedAt,
    };
    this.byUserId.set(userId, next);
    return { ...next, sports: [...next.sports] };
  }
}
