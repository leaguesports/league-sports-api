import { z } from "zod";
import { PrismaClient } from "../../generated/prisma/client";
import { JoinCodeGenerator } from "./util/joinCodeGenerator";

const GOLF_ID = 'golf';
const PADEL_ID = 'padel';

const GolfIdSchema = z.literal(GOLF_ID);
const PadelIdSchema = z.literal(PADEL_ID);

const SportIdSchema = z.union([GolfIdSchema, PadelIdSchema]);

const StartSessionRequestSchema = z.object({
    sport: SportIdSchema,
    config: z.object(),
    state: z.object(),
});

type StartSessionRequest = z.infer<typeof StartSessionRequestSchema>;

export class StartSessionHandler {
    constructor(
        private readonly createSession: CreateSessionHandler,
        private readonly createLobby: CreateLobbyHandler,
        private readonly joinCodeGenerator: JoinCodeGenerator,
    ) {}

    async execute(request: StartSessionRequest) {
        const joinCode = this.joinCodeGenerator.generate();
        const session = await this.createSession.execute(request);
        const lobby = await this.createLobby.execute(session.id, joinCode);
        // TODO: Create an ably channel for the lobby
        return session;
    }
}

class CreateSessionHandler {
    private readonly db: PrismaClient;

    constructor({ db }: { db: PrismaClient }) {
        this.db = db;
    }

    async execute(request: StartSessionRequest) {
        const session = await this.db.session.create({
            data: {
                sport: request.sport,
                config: request.config,
                state: request.state,
            }
        })

        return session;
    }
}

class CreateLobbyHandler {
    private readonly db: PrismaClient;

    constructor({ db }: { db: PrismaClient }) {
        this.db = db;
    }

    async execute(sessionId: string, joinCode: string) {
        const lobby = await this.db.lobby.create({
            data: {
                sessionId,
                joinCode,
            }
        })

        return lobby;
    }
}