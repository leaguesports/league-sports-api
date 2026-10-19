import { randomUUID } from "crypto";

import { PrismaClient } from "../../../generated/prisma/client";
import { InMemorySessionRepository } from "./in-memory-session.repository";
import { PrismaSessionRepository } from "./prisma-session.repository";
import { SessionNotFoundError } from "./session.repository";
import { JoinCodeAllocationError } from "../utils/joinCode";

type LobbyRow = {
  id: string;
  joinCode: string;
  createdAt: Date;
  updatedAt: Date;
};

type SessionRow = {
  id: string;
  sport: string;
  config: unknown;
  state: unknown;
  status: "live" | "closed";
  venueId: string | null;
  lobbyId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type EventRow = {
  id: string;
  sessionId: string;
  seq: number;
  type: string;
  data: unknown;
  createdBy: string | null;
  createdAt: Date;
};

function joinCodeConflict() {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    meta: { target: ["joinCode"] },
  });
}

type FakeDb = {
  lobby: {
    create(args: { data: { joinCode: string } }): Promise<LobbyRow>;
    delete(args: { where: { id: string } }): Promise<LobbyRow>;
  };
  session: {
    create(args: {
      data: {
        sport: string;
        config: unknown;
        state: unknown;
        status: "live" | "closed";
        venueId: string | null;
        createdBy: string | null;
        lobbyId?: string | null;
      };
    }): Promise<SessionRow>;
    findUnique(args: { where: { id: string } }): Promise<SessionRow | null>;
    update(args: {
      where: { id: string };
      data: { status: "closed"; lobbyId: null };
    }): Promise<SessionRow>;
  };
  sessionEvent: {
    create(args: {
      data: {
        sessionId: string;
        seq: number;
        type: string;
        data: unknown;
        createdBy: string | null;
      };
    }): Promise<EventRow>;
  };
  $transaction<T>(fn: (tx: FakeDb) => Promise<T>): Promise<T>;
};

function createFakeDb() {
  const lobbies = new Map<string, LobbyRow>();
  const sessions = new Map<string, SessionRow>();
  const events: EventRow[] = [];

  const db: FakeDb = {
    lobby: {
      async create({ data }: { data: { joinCode: string } }) {
        for (const lobby of lobbies.values()) {
          if (lobby.joinCode === data.joinCode) {
            throw joinCodeConflict();
          }
        }
        const now = new Date();
        const row: LobbyRow = {
          id: randomUUID(),
          joinCode: data.joinCode,
          createdAt: now,
          updatedAt: now,
        };
        lobbies.set(row.id, row);
        return row;
      },
      async delete({ where }: { where: { id: string } }) {
        const row = lobbies.get(where.id);
        if (!row) {
          throw new Error(`Lobby not found: ${where.id}`);
        }
        lobbies.delete(where.id);
        return row;
      },
    },
    session: {
      async create({
        data,
      }: {
        data: {
          sport: string;
          config: unknown;
          state: unknown;
          status: "live" | "closed";
          venueId: string | null;
          createdBy: string | null;
          lobbyId?: string | null;
        };
      }) {
        const now = new Date();
        const row: SessionRow = {
          id: randomUUID(),
          sport: data.sport,
          config: data.config,
          state: data.state,
          status: data.status,
          venueId: data.venueId,
          lobbyId: data.lobbyId ?? null,
          createdBy: data.createdBy,
          createdAt: now,
          updatedAt: now,
        };
        sessions.set(row.id, row);
        return row;
      },
      async findUnique({ where }: { where: { id: string } }) {
        return sessions.get(where.id) ?? null;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: { status: "closed"; lobbyId: null };
      }) {
        const existing = sessions.get(where.id);
        if (!existing) {
          throw new Error(`Session not found: ${where.id}`);
        }
        const updated: SessionRow = {
          ...existing,
          status: data.status,
          lobbyId: data.lobbyId,
          updatedAt: new Date(),
        };
        sessions.set(where.id, updated);
        return updated;
      },
    },
    sessionEvent: {
      async create({
        data,
      }: {
        data: {
          sessionId: string;
          seq: number;
          type: string;
          data: unknown;
          createdBy: string | null;
        };
      }) {
        const row: EventRow = {
          id: randomUUID(),
          sessionId: data.sessionId,
          seq: data.seq,
          type: data.type,
          data: data.data,
          createdBy: data.createdBy,
          createdAt: new Date(),
        };
        events.push(row);
        return row;
      },
    },
    async $transaction<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
      const snapshot = {
        lobbies: new Map(lobbies),
        sessions: new Map(sessions),
        events: [...events],
      };
      try {
        return await fn(db);
      } catch (error) {
        lobbies.clear();
        for (const [id, row] of snapshot.lobbies) lobbies.set(id, row);
        sessions.clear();
        for (const [id, row] of snapshot.sessions) sessions.set(id, row);
        events.splice(0, events.length, ...snapshot.events);
        throw error;
      }
    },
  };

  return { db, lobbies, sessions, events };
}

describe("PrismaSessionRepository", () => {
  test("stores the server-built session and retries a colliding join code", async () => {
    const fake = createFakeDb();
    const codes = ["TAKEN1", "FREE11"];
    fake.lobbies.set("existing-lobby", {
      id: "existing-lobby",
      joinCode: "TAKEN1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const repository = new PrismaSessionRepository(
      fake.db as unknown as PrismaClient,
      { generate: () => codes.shift() ?? "EXTRA1" },
    );

    const created = await repository.createLiveSession({
      sport: "golf",
      config: {},
      state: { from: "plugin" },
      venueId: "venue-1",
      createdBy: "user-1",
    });

    expect(created.lobby.joinCode).toBe("FREE11");
    expect(created.session).toMatchObject({
      sport: "golf",
      state: { from: "plugin" },
      status: "live",
      venueId: "venue-1",
      createdBy: "user-1",
      lobbyId: created.lobby.id,
    });
    expect(fake.lobbies.size).toBe(2);
  });

  test("fails clearly when join codes keep colliding", async () => {
    const fake = createFakeDb();
    fake.lobbies.set("existing-lobby", {
      id: "existing-lobby",
      joinCode: "TAKEN1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const repository = new PrismaSessionRepository(
      fake.db as unknown as PrismaClient,
      { generate: () => "TAKEN1" },
    );

    await expect(
      repository.createLiveSession({
        sport: "golf",
        config: {},
        state: {},
      }),
    ).rejects.toBeInstanceOf(JoinCodeAllocationError);
    expect(fake.sessions.size).toBe(0);
    expect(fake.lobbies.size).toBe(1);
  });

  test("closeSession marks the session closed and deletes its lobby", async () => {
    const fake = createFakeDb();
    const repository = new PrismaSessionRepository(
      fake.db as unknown as PrismaClient,
      { generate: () => "ABC123" },
    );
    const created = await repository.createLiveSession({
      sport: "padel",
      config: {},
      state: {},
      createdBy: null,
    });

    const closed = await repository.closeSession(created.session.id);

    expect(closed.status).toBe("closed");
    expect(closed.lobbyId).toBeNull();
    expect(fake.lobbies.has(created.lobby.id)).toBe(false);
    expect(fake.sessions.get(created.session.id)?.status).toBe("closed");
  });

  test("closeSession rejects an unknown session and leaves a recorded session without a lobby", async () => {
    const fake = createFakeDb();
    const repository = new PrismaSessionRepository(
      fake.db as unknown as PrismaClient,
      { generate: () => "ABC123" },
    );

    await expect(repository.closeSession("missing")).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );

    const recorded = await repository.recordSession({
      sport: "golf",
      config: { holes: 18 },
      state: { total: 6 },
      createdBy: "user-2",
      events: [
        { type: "add", data: 2, createdBy: "user-2" },
        { type: "add", data: 3, createdBy: "user-2" },
      ],
    });

    expect(recorded.session.status).toBe("closed");
    expect(recorded.session.lobbyId).toBeNull();
    expect(recorded.events.map((event) => event.seq)).toEqual([1, 2]);
    expect(fake.lobbies.size).toBe(0);

    const closedAgain = await repository.closeSession(recorded.session.id);
    expect(closedAgain.status).toBe("closed");
    expect(closedAgain.lobbyId).toBeNull();
  });
});

describe("InMemorySessionRepository", () => {
  test("closeSession deletes the lobby and a colliding join code is retried", async () => {
    const repository = new InMemorySessionRepository({
      generate: (() => {
        const codes = ["SAME11", "SAME11", "OTHER1"];
        return () => codes.shift() ?? "EXTRA1";
      })(),
    });

    const first = await repository.createLiveSession({
      sport: "golf",
      config: {},
      state: { ready: true },
      createdBy: "user-1",
    });
    const second = await repository.createLiveSession({
      sport: "golf",
      config: {},
      state: {},
    });

    expect(first.lobby.joinCode).toBe("SAME11");
    expect(second.lobby.joinCode).toBe("OTHER1");

    const closed = await repository.closeSession(first.session.id);
    expect(closed).toMatchObject({ status: "closed", lobbyId: null });
    expect(repository.findLobby(first.lobby.id)).toBeUndefined();
    expect(repository.findSession(first.session.id)?.status).toBe("closed");
    expect(repository.findLobby(second.lobby.id)?.joinCode).toBe("OTHER1");
  });
});
