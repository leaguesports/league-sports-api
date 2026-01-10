"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountService = void 0;
class AccountService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createAccount(playerId, provider, providerId, accessToken, refreshToken, expiresAt) {
        return this.prisma.account.create({
            data: {
                playerId,
                provider,
                providerId,
                accessToken,
                refreshToken,
                expiresAt,
            },
        });
    }
    async getAccountByProviderAndProviderId(provider, providerId) {
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
exports.AccountService = AccountService;
//# sourceMappingURL=accountService.js.map