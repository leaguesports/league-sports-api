"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerService = void 0;
class PlayerService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createPlayer() {
        return this.prisma.player.create({
            data: {},
        });
    }
    async getPlayerById(id) {
        return this.prisma.player.findUnique({
            where: { id },
        });
    }
}
exports.PlayerService = PlayerService;
//# sourceMappingURL=playerService.js.map