import { PrismaClient } from "../generated/prisma/client";
export declare class CommunityService {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    getCommunitiesByPlayerId(playerId: string): Promise<{
        id: string;
        name: string;
        description: string;
    }[]>;
    getCommunityById(id: string): Promise<{
        id: string;
        name: string;
        description: string;
    } | null>;
    createCommunity(playerId: string, name: string, description: string): Promise<{
        id: string;
        name: string;
        description: string;
    }>;
}
//# sourceMappingURL=communityService.d.ts.map