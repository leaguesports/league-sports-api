import { PrismaClient } from "../generated/prisma/client";
export declare class ProfileService {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    createProfile(playerId: string, firstName: string, lastName: string): Promise<{
        id: string;
        playerId: string;
        firstName: string;
        lastName: string;
    }>;
}
//# sourceMappingURL=profileService.d.ts.map