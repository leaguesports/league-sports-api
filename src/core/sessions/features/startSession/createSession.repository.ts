import { PrismaClient } from "../../../../generated/prisma/client";
import { StartSessionRequest } from "./startSession.schema";

export class CreateSessionRepository {
    private readonly db: PrismaClient;

    constructor({ db }: { db: PrismaClient }) {
        this.db = db;
    }

    async execute(request: StartSessionRequest) {
        return await this.db.$transaction(async (tx) => {
            const session = await tx.session.create({
                data: {
                    sport: request.sport,
                    config: request.config,
                    state: request.state,
                }
            })

            const lobby = await tx.lobby.create({
                data: {
                    sessionId: session.id,
                    joinCode: "123456",
                }
            })

            return { session, lobby };
        })
    }
}