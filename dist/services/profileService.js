"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileService = void 0;
class ProfileService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createProfile(playerId, firstName, lastName) {
        return this.prisma.profile.create({
            data: { playerId, firstName, lastName },
        });
    }
}
exports.ProfileService = ProfileService;
//# sourceMappingURL=profileService.js.map