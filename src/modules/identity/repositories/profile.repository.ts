import { PrismaClient } from "../../../generated/prisma/client";
import { handleCandidate, slugifyHandle } from "../utils/handle";

export type CreateProfileInput = {
  userId: string;
  firstName: string;
  lastName: string;
  email?: string;
  handle: string;
  avatarUrl?: string | null;
};

export class ProfileRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createProfile(input: CreateProfileInput) {
    return this.prisma.profile.create({
      data: {
        userId: input.userId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? "",
        handle: input.handle,
        avatarUrl: input.avatarUrl ?? null,
      },
    });
  }

  async getProfileByUserId(userId: string) {
    return this.prisma.profile.findUnique({
      where: { userId },
    });
  }

  async updateHandle(userId: string, handle: string) {
    return this.prisma.profile.update({
      where: { userId },
      data: { handle },
    });
  }

  async isHandleTaken(handle: string, excludeUserId?: string) {
    const existing = await this.prisma.profile.findUnique({
      where: { handle },
      select: { userId: true },
    });
    if (!existing) return false;
    if (excludeUserId && existing.userId === excludeUserId) return false;
    return true;
  }

  /**
   * Allocates a unique handle from email local-part or display name.
   */
  async allocateHandle(seed: string, excludeUserId?: string): Promise<string> {
    const local = seed.includes("@") ? seed.split("@")[0]! : seed;
    const base = slugifyHandle(local);

    for (let attempt = 1; attempt <= 50; attempt += 1) {
      const candidate = handleCandidate(base, attempt);
      if (!(await this.isHandleTaken(candidate, excludeUserId))) {
        return candidate;
      }
    }

    return `player${Date.now().toString(36)}`;
  }
}
