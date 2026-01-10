"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunityService = void 0;
var CommunityRole;
(function (CommunityRole) {
    CommunityRole["OWNER"] = "OWNER";
    CommunityRole["ADMIN"] = "ADMIN";
    CommunityRole["MEMBER"] = "MEMBER";
})(CommunityRole || (CommunityRole = {}));
class CommunityService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getCommunitiesByPlayerId(playerId) {
        return this.prisma.community.findMany({
            where: { members: { some: { playerId } } },
        });
    }
    async getCommunityById(id) {
        return this.prisma.community.findUnique({
            where: { id },
        });
    }
    async createCommunity(playerId, name, description) {
        const community = await this.prisma.$transaction(async (tx) => {
            const _community = await tx.community.create({
                data: { name, description },
            });
            await tx.communityMember.create({
                data: {
                    communityId: _community.id,
                    playerId,
                    role: CommunityRole.OWNER,
                },
            });
            return _community;
        });
        return community;
    }
}
exports.CommunityService = CommunityService;
//# sourceMappingURL=communityService.js.map