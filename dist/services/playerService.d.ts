import { PrismaClient } from "../generated/prisma/client";
export declare class PlayerService {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    createPlayer(): Promise<{
        id: string;
    }>;
    getPlayerById(id: string): Promise<{
        id: string;
    } | null>;
}
//# sourceMappingURL=playerService.d.ts.map