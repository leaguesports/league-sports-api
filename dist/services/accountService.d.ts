import { PrismaClient } from "../generated/prisma/client";
export declare class AccountService {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    createAccount(playerId: string, provider: string, providerId: string, accessToken: string, refreshToken: string, expiresAt: Date): Promise<{
        id: string;
        provider: string;
        providerId: string;
        accessToken: string;
        refreshToken: string;
        expiresAt: Date;
        playerId: string;
    }>;
    getAccountByProviderAndProviderId(provider: string, providerId: string): Promise<{
        id: string;
        provider: string;
        providerId: string;
        accessToken: string;
        refreshToken: string;
        expiresAt: Date;
        playerId: string;
    } | null>;
}
//# sourceMappingURL=accountService.d.ts.map