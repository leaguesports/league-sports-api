import { DomainError } from "../../../lib/domain-error";
import {
  PreferencesRepository,
  UserPreferences,
} from "../repositories/preferences.repository";

const SPORT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SPORTS = 20;

export type PublicPreferences = {
  sports: string[];
  activeSport: string | null;
  onboardingCompletedAt: string | null;
  onboardingSkippedAt: string | null;
};

export function toPublicPreferences(
  prefs: UserPreferences,
): PublicPreferences {
  return {
    sports: [...prefs.sports],
    activeSport: prefs.activeSport,
    onboardingCompletedAt: prefs.onboardingCompletedAt?.toISOString() ?? null,
    onboardingSkippedAt: prefs.onboardingSkippedAt?.toISOString() ?? null,
  };
}

export function normalizeSportSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function assertSportSlug(raw: string): string {
  const slug = normalizeSportSlug(raw);
  if (!slug || !SPORT_SLUG_PATTERN.test(slug) || slug.length > 64) {
    throw new DomainError(`Invalid sport slug: ${raw}`);
  }
  return slug;
}

export function assertSportSlugs(raw: string[]): string[] {
  if (raw.length > MAX_SPORTS) {
    throw new DomainError(`Select at most ${MAX_SPORTS} sports`);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const slug = assertSportSlug(item);
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

export class GetPreferences {
  constructor(private readonly preferences: PreferencesRepository) {}

  async execute(input: { userId: string }): Promise<PublicPreferences> {
    const userId = input.userId.trim();
    if (!userId) throw new DomainError("userId is required");
    return toPublicPreferences(await this.preferences.getForUser(userId));
  }
}

export type UpdatePreferencesInput = {
  userId: string;
  sports?: string[];
  activeSport?: string | null;
  completeOnboarding?: boolean;
  skipOnboarding?: boolean;
};

export class UpdatePreferences {
  constructor(private readonly preferences: PreferencesRepository) {}

  async execute(input: UpdatePreferencesInput): Promise<PublicPreferences> {
    const userId = input.userId.trim();
    if (!userId) throw new DomainError("userId is required");

    const patch: Parameters<PreferencesRepository["updateForUser"]>[1] = {};

    if (input.sports !== undefined) {
      patch.sports = assertSportSlugs(input.sports);
    }

    if (input.activeSport !== undefined) {
      patch.activeSport =
        input.activeSport === null || input.activeSport === ""
          ? null
          : assertSportSlug(input.activeSport);
    }

    if (input.completeOnboarding === true) {
      patch.onboardingCompletedAt = new Date();
    }

    if (input.skipOnboarding === true) {
      patch.onboardingSkippedAt = new Date();
    }

    if (
      patch.sports === undefined &&
      patch.activeSport === undefined &&
      patch.onboardingCompletedAt === undefined &&
      patch.onboardingSkippedAt === undefined
    ) {
      throw new DomainError("No preference fields to update");
    }

    // Keep activeSport inside the followed set when both are provided.
    if (
      patch.sports !== undefined &&
      patch.activeSport &&
      !patch.sports.includes(patch.activeSport)
    ) {
      patch.sports = [...patch.sports, patch.activeSport];
    }

    if (
      patch.sports !== undefined &&
      patch.activeSport === undefined
    ) {
      const current = await this.preferences.getForUser(userId);
      if (
        current.activeSport &&
        !patch.sports.includes(current.activeSport)
      ) {
        patch.activeSport =
          patch.sports.length === 1 ? patch.sports[0]! : null;
      }
    }

    return toPublicPreferences(
      await this.preferences.updateForUser(userId, patch),
    );
  }
}
