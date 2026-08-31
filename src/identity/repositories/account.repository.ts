import { PrismaClient } from "../../generated/prisma/client";

export class AccountRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createAccount(
    userId: string,
    provider: string,
    providerId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date,
  ) {
    return this.prisma.account.create({
      data: {
        userId,
        provider,
        providerId,
        accessToken,
        refreshToken,
        expiresAt,
      },
    });
  }

  async getAccountByProviderAndProviderId(
    provider: string,
    providerId: string,
  ) {
    return this.prisma.account.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId,
        },
      },
    });
  }
}
