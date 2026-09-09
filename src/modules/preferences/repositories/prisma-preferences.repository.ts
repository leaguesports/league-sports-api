import { PrismaClient } from "../../../generated/prisma/client";
import { PreferencesPersistenceError } from "./preferences-persistence-error";
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

export class PrismaPreferencesRepository implements PreferencesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getForUser(userId: string): Promise<UserPreferences> {
    try {
      const [profile, follows] = await Promise.all([
        this.prisma.profile.findUnique({
          where: { userId },
          select: {
            activeSportSlug: true,
            onboardingCompletedAt: true,
            onboardingSkippedAt: true,
          },
        }),
        this.prisma.sportFollow.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" },
          select: { sportSlug: true },
        }),
      ]);

      if (!profile && follows.length === 0) {
        return emptyPrefs(userId);
      }

      return {
        userId,
        sports: follows.map((row) => row.sportSlug),
        activeSport: profile?.activeSportSlug ?? null,
        onboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
        onboardingSkippedAt: profile?.onboardingSkippedAt ?? null,
      };
    } catch (error) {
      throw new PreferencesPersistenceError("Failed to load preferences", {
        cause: error,
      });
    }
  }

  async updateForUser(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferences> {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (input.sports !== undefined) {
          await tx.sportFollow.deleteMany({ where: { userId } });
          if (input.sports.length > 0) {
            await tx.sportFollow.createMany({
              data: input.sports.map((sportSlug) => ({ userId, sportSlug })),
              skipDuplicates: true,
            });
          }
        }

        const profileData: {
          activeSportSlug?: string | null;
          onboardingCompletedAt?: Date | null;
          onboardingSkippedAt?: Date | null;
        } = {};

        if (input.activeSport !== undefined) {
          profileData.activeSportSlug = input.activeSport;
        }
        if (input.onboardingCompletedAt !== undefined) {
          profileData.onboardingCompletedAt = input.onboardingCompletedAt;
        }
        if (input.onboardingSkippedAt !== undefined) {
          profileData.onboardingSkippedAt = input.onboardingSkippedAt;
        }

        if (Object.keys(profileData).length > 0) {
          await tx.profile.updateMany({
            where: { userId },
            data: profileData,
          });
        }
      });

      return this.getForUser(userId);
    } catch (error) {
      if (error instanceof PreferencesPersistenceError) throw error;
      throw new PreferencesPersistenceError("Failed to update preferences", {
        cause: error,
      });
    }
  }
}
