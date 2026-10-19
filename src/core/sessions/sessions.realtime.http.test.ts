import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../app";
import { Config } from "../../config";
import { signAuthenticationToken } from "../identity/utils/jwt";
import {
  CommittedSessionEvent,
  SessionPublisher,
} from "./realtime/publisher";
import { InMemorySessionRepository } from "./repositories/in-memory-session.repository";

function makeConfig(): Config {
  return {
    PORT: 0,
    DATABASE_URL: "postgresql://localhost/league",
    NODE_ENV: "development",
    GOOGLE_CLIENT_ID: "id",
    GOOGLE_CLIENT_SECRET: "secret",
    GOOGLE_REDIRECT_URI: "http://localhost:3000/callback",
    JWT_SECRET: "jwt-test-secret",
    FRONTEND_URL: "http://localhost:3001",
    CORS_ORIGINS: ["http://localhost:3001"],
  };
}

async function listen(app: Express) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

class RecordingPublisher implements SessionPublisher {
  readonly messages: CommittedSessionEvent[] = [];

  async publish(event: CommittedSessionEvent): Promise<void> {
    this.messages.push(event);
  }
}

class ThrowingPublisher implements SessionPublisher {
  async publish(): Promise<void> {
    throw new Error("ably down");
  }
}

describe("session realtime publish", () => {
  const config = makeConfig();

  test("publishes each committed event after the write, and skips replays", async () => {
    const sessions = new InMemorySessionRepository({ generate: () => "JOIN99" });
    const publisher = new RecordingPublisher();
    const app = await createApp(config, {
      sessionRepository: sessions,
      sessionPublisher: publisher,
    });
    const server = await listen(app);

    try {
      const hostToken = signAuthenticationToken(config, { userId: "user-host" });
      const started = await start(server.url, hostToken);
      const sam = started.invited[0];
      expect(sam?.name).toBe("Sam");

      expect(publisher.messages.map(summary)).toEqual([
        { sessionId: started.session.id, seq: 1, type: "participant.joined" },
        { sessionId: started.session.id, seq: 2, type: "participant.invited" },
      ]);
      expect(publisher.messages[0]?.state).toEqual(publisher.messages[1]?.state);
      expect(publisher.messages[0]?.state).toEqual(started.session.state);
      expect(JSON.stringify(publisher.messages)).not.toContain(started.token);
      expect(JSON.stringify(publisher.messages)).not.toContain("user-host");

      const rejected = await postEvent(server.url, started.session.id, "not-a-token", {
        type: "hole.scored",
        data: { participantId: started.participant.id, hole: 1, strokes: 4 },
      });
      expect(rejected.status).toBe(401);
      expect(publisher.messages).toHaveLength(2);

      const claimed = await fetch(`${server.url}/api/sessions/${started.session.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimPid: sam?.id }),
      });
      expect(claimed.status).toBe(200);
      const samSeat = (await claimed.json()) as { token: string; participant: { id: string } };
      expect(summary(publisher.messages[2]!)).toEqual({
        sessionId: started.session.id,
        seq: 3,
        type: "participant.claimed",
      });

      const scored = await postEvent(server.url, started.session.id, started.token, {
        type: "hole.scored",
        data: { participantId: samSeat.participant.id, hole: 1, strokes: 5 },
        clientEventId: "offline-1",
      });
      expect(scored.status).toBe(201);
      const scoredBody = (await scored.json()) as { seq: number; state: unknown };
      expect(summary(publisher.messages[3]!)).toEqual({
        sessionId: started.session.id,
        seq: scoredBody.seq,
        type: "hole.scored",
      });
      expect(publisher.messages[3]?.state).toEqual(scoredBody.state);

      const replay = await postEvent(server.url, started.session.id, started.token, {
        type: "hole.scored",
        data: { participantId: samSeat.participant.id, hole: 1, strokes: 5 },
        clientEventId: "offline-1",
      });
      expect(replay.status).toBe(200);
      expect(publisher.messages).toHaveLength(4);

      const left = await fetch(`${server.url}/api/sessions/${started.session.id}/leave`, {
        method: "POST",
        headers: { "X-Session-Token": samSeat.token },
      });
      expect(left.status).toBe(200);
      expect(summary(publisher.messages[4]!)).toEqual({
        sessionId: started.session.id,
        seq: 5,
        type: "participant.left",
      });

      const playerFinish = await fetch(
        `${server.url}/api/sessions/${started.session.id}/finish`,
        { method: "POST", headers: { "X-Session-Token": samSeat.token } },
      );
      expect(playerFinish.status).toBe(403);
      expect(publisher.messages).toHaveLength(5);

      const done = await fetch(`${server.url}/api/sessions/${started.session.id}/finish`, {
        method: "POST",
        headers: { "X-Session-Token": started.token },
      });
      expect(done.status).toBe(200);
      const doneBody = (await done.json()) as { seq: number; state: { result?: { seq: number } } };
      expect(summary(publisher.messages[5]!)).toEqual({
        sessionId: started.session.id,
        seq: doneBody.seq,
        type: "round.finished",
      });
      expect(publisher.messages[5]?.state).toEqual(doneBody.state);
      expect(doneBody.state.result?.seq).toBe(doneBody.seq);
    } finally {
      await server.close();
      await app.locals.prisma?.$disconnect();
    }
  });

  test("a publisher failure still returns the written session", async () => {
    const sessions = new InMemorySessionRepository({ generate: () => "JOIN99" });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const app = await createApp(config, {
      sessionRepository: sessions,
      sessionPublisher: new ThrowingPublisher(),
    });
    const server = await listen(app);

    try {
      const started = await start(server.url, null);
      expect(sessions.findSession(started.session.id)?.status).toBe("live");
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(`channel=session:${started.session.id}`),
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("event=participant.joined"));
    } finally {
      warn.mockRestore();
      await server.close();
      await app.locals.prisma?.$disconnect();
    }
  });
});

function summary(event: CommittedSessionEvent) {
  return { sessionId: event.sessionId, seq: event.seq, type: event.type };
}

async function start(url: string, cookie: string | null) {
  const response = await fetch(`${url}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: `token=${cookie}` } : {}),
    },
    body: JSON.stringify({
      sport: "golf",
      name: "Host",
      config: { tees: [{ id: "white", name: "White" }] },
      sportData: { teeId: "white" },
      invited: [{ name: "Sam", sportData: { teeId: "white" } }],
    }),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as {
    session: { id: string; state: unknown };
    participant: { id: string };
    token: string;
    invited: { id: string; name: string }[];
  };
}

function postEvent(
  url: string,
  sessionId: string,
  token: string,
  body: unknown,
) {
  return fetch(`${url}/api/sessions/${sessionId}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Token": token,
    },
    body: JSON.stringify(body),
  });
}
