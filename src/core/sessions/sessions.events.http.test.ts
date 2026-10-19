import http from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";

import type { Express } from "express";

import { createApp } from "../../app";
import { Config } from "../../config";
import { signAuthenticationToken } from "../identity/utils/jwt";
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

const golfSetup = {
  tees: [
    { id: "white", name: "White" },
    { id: "blue", name: "Blue" },
  ],
};

describe("POST /api/sessions/:id/events", () => {
  const config = makeConfig();
  let sessions: InMemorySessionRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    sessions = new InMemorySessionRepository({ generate: () => "JOIN99" });
    app = await createApp(config, { sessionRepository: sessions });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("records a score for any joined player, then a replay and a clear", async () => {
    const hostToken = signAuthenticationToken(config, { userId: "user-host" });
    const started = await start(server.url, hostToken, {
      sport: "golf",
      name: "Host",
      config: golfSetup,
      sportData: { teeId: "white", handicapIndex: 8 },
      invited: [{ name: "Sam", sportData: { teeId: "blue" } }],
    });
    const sam = started.invited[0];
    expect(sam?.name).toBe("Sam");

    const guest = await join(server.url, started.session.id, {
      name: "Riley",
      sportData: { teeId: "white" },
    });

    const missingToken = await postEvent(server.url, started.session.id, started.token, {
      type: "hole.scored",
      data: { participantId: started.participant.id, hole: 1, strokes: 4 },
    }, { token: null });
    expect(missingToken.status).toBe(401);
    expect(await missingToken.json()).toEqual({ error: "Session token is required" });

    const badToken = await postEvent(server.url, started.session.id, "not-a-token", {
      type: "hole.scored",
      data: { participantId: started.participant.id, hole: 1, strokes: 4 },
    });
    expect(badToken.status).toBe(401);

    const invitedTarget = await postEvent(server.url, started.session.id, started.token, {
      type: "hole.scored",
      data: { participantId: sam?.id, hole: 1, strokes: 4 },
    });
    expect(invitedTarget.status).toBe(400);
    expect(await invitedTarget.json()).toMatchObject({
      error: "Score target is not a joined participant",
      details: { participantId: sam?.id },
    });

    const unknownTarget = await postEvent(server.url, started.session.id, started.token, {
      type: "hole.scored",
      data: { participantId: randomUUID(), hole: 1, strokes: 4 },
    });
    expect(unknownTarget.status).toBe(400);

    const spoofedWriter = await postEvent(server.url, started.session.id, started.token, {
      type: "hole.scored",
      data: {
        participantId: guest.participant.id,
        hole: 1,
        strokes: 4,
        scoredBy: guest.participant.id,
      },
    });
    expect(spoofedWriter.status).toBe(400);

    const badStrokes = await postEvent(server.url, started.session.id, started.token, {
      type: "hole.scored",
      data: { participantId: guest.participant.id, hole: 1, strokes: 16 },
    });
    expect(badStrokes.status).toBe(400);
    expect(await badStrokes.json()).toMatchObject({ error: "Invalid golf score" });

    const badHole = await postEvent(server.url, started.session.id, started.token, {
      type: "hole.scored",
      data: { participantId: guest.participant.id, hole: 0, strokes: 4 },
    });
    expect(badHole.status).toBe(400);

    const coreEvent = await postEvent(server.url, started.session.id, started.token, {
      type: "participant.joined",
      data: { participantId: guest.participant.id },
    });
    expect(coreEvent.status).toBe(400);
    expect(await coreEvent.json()).toMatchObject({ error: "Event type cannot be captured" });

    const unknownType = await postEvent(server.url, started.session.id, started.token, {
      type: "swing",
      data: {},
    });
    expect(unknownType.status).toBe(400);
    expect(await unknownType.json()).toMatchObject({
      error: "Unknown event type",
      details: { type: "swing" },
    });

    const eventsBefore = sessions.eventsFor(started.session.id).length;
    const scored = await postEvent(server.url, started.session.id, started.token, {
      type: "hole.scored",
      data: { participantId: guest.participant.id, hole: 1, strokes: 4 },
      clientEventId: "offline-1",
    });
    expect(scored.status).toBe(201);
    const scoredBody = (await scored.json()) as { seq: number; state: unknown };
    expect(scoredBody).toEqual({
      seq: eventsBefore + 1,
      state: {
        scores: [
          {
            participantId: guest.participant.id,
            hole: 1,
            strokes: 4,
            scoredBy: started.participant.id,
            seq: eventsBefore + 1,
          },
        ],
      },
    });
    expect(JSON.stringify(scoredBody)).not.toContain("user-host");
    expect(JSON.stringify(scoredBody)).not.toContain(started.token);

    const stored = sessions
      .eventsFor(started.session.id)
      .find((event) => event.seq === scoredBody.seq);
    expect(stored).toMatchObject({
      type: "hole.scored",
      participantId: started.participant.id,
      createdBy: "user-host",
    });

    const replay = await postEvent(server.url, started.session.id, started.token, {
      type: "hole.scored",
      data: { participantId: guest.participant.id, hole: 1, strokes: 4 },
      clientEventId: "offline-1",
    });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(scoredBody);
    expect(sessions.eventsFor(started.session.id)).toHaveLength(eventsBefore + 1);

    const conflict = await postEvent(server.url, started.session.id, started.token, {
      type: "hole.scored",
      data: { participantId: guest.participant.id, hole: 1, strokes: 5 },
      clientEventId: "offline-1",
    });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      error: "clientEventId was already used",
      details: { clientEventId: "offline-1", seq: scoredBody.seq },
    });
    expect(sessions.findSession(started.session.id)?.state).toEqual(scoredBody.state);

    const replaced = await postEvent(server.url, started.session.id, guest.token, {
      type: "hole.scored",
      data: { participantId: guest.participant.id, hole: 1, strokes: 5 },
    });
    expect(replaced.status).toBe(201);
    const replacedBody = (await replaced.json()) as {
      seq: number;
      state: { scores: { scoredBy: string; strokes: number; seq: number }[] };
    };
    expect(replacedBody.state.scores).toEqual([
      {
        participantId: guest.participant.id,
        hole: 1,
        strokes: 5,
        scoredBy: guest.participant.id,
        seq: replacedBody.seq,
      },
    ]);
    expect(replacedBody.seq).toBe(scoredBody.seq + 1);

    const replayAfterReplace = await postEvent(server.url, started.session.id, started.token, {
      type: "hole.scored",
      data: { participantId: guest.participant.id, hole: 1, strokes: 4 },
      clientEventId: "offline-1",
    });
    expect(replayAfterReplace.status).toBe(200);
    const replayBody = (await replayAfterReplace.json()) as { seq: number; state: unknown };
    expect(replayBody.seq).toBe(scoredBody.seq);
    expect(replayBody.state).toEqual(replacedBody.state);

    const cleared = await postEvent(server.url, started.session.id, guest.token, {
      type: "hole.cleared",
      data: { participantId: guest.participant.id, hole: 1 },
    });
    expect(cleared.status).toBe(201);
    expect(await cleared.json()).toMatchObject({ state: { scores: [] } });

    const left = await fetch(`${server.url}/api/sessions/${started.session.id}/leave`, {
      method: "POST",
      headers: { "X-Session-Token": guest.token },
    });
    expect(left.status).toBe(200);
    const afterLeave = await postEvent(server.url, started.session.id, guest.token, {
      type: "hole.scored",
      data: { participantId: started.participant.id, hole: 2, strokes: 4 },
    });
    expect(afterLeave.status).toBe(403);
    expect(await afterLeave.json()).toMatchObject({
      error: "You are not joined in this session",
      details: { status: "left" },
    });

    await sessions.closeSession(started.session.id);
    const closed = await postEvent(server.url, started.session.id, started.token, {
      type: "hole.scored",
      data: { participantId: started.participant.id, hole: 2, strokes: 4 },
    });
    expect(closed.status).toBe(409);
    expect(await closed.json()).toMatchObject({
      error: "Session is closed",
      details: { status: "closed" },
    });
    const leftAfterClose = await postEvent(server.url, started.session.id, guest.token, {
      type: "hole.scored",
      data: { participantId: started.participant.id, hole: 3, strokes: 4 },
    });
    expect(leftAfterClose.status).toBe(403);

    const missing = await postEvent(server.url, randomUUID(), started.token, {
      type: "hole.scored",
      data: { participantId: started.participant.id, hole: 1, strokes: 4 },
    });
    expect(missing.status).toBe(404);
  });

  test("padel has no capturable events and a failed score does not write one", async () => {
    const started = await start(server.url, null, { sport: "padel", config: {} });
    const before = sessions.eventsFor(started.session.id).length;
    const response = await postEvent(server.url, started.session.id, started.token, {
      type: "hole.scored",
      data: { participantId: started.participant.id, hole: 1, strokes: 4 },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Unknown event type" });
    expect(sessions.eventsFor(started.session.id)).toHaveLength(before);
    expect(sessions.findSession(started.session.id)?.state).toEqual({});
  });

  test("an anonymous writer's event has no createdBy", async () => {
    const started = await start(server.url, null, {
      sport: "golf",
      config: golfSetup,
      sportData: { teeId: "blue" },
    });
    const response = await postEvent(server.url, started.session.id, started.token, {
      type: "hole.scored",
      data: { participantId: started.participant.id, hole: 18, strokes: 1 },
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as { seq: number };
    const stored = sessions.eventsFor(started.session.id).find((event) => event.seq === body.seq);
    expect(stored?.createdBy).toBeNull();
    expect(stored?.participantId).toBe(started.participant.id);
  });
});

async function start(
  url: string,
  cookie: string | null,
  body: unknown,
): Promise<{
  session: { id: string };
  participant: { id: string };
  token: string;
  invited: { id: string; name: string }[];
}> {
  const response = await fetch(`${url}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: `token=${cookie}` } : {}),
    },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as {
    session: { id: string };
    participant: { id: string };
    token: string;
    invited: { id: string; name: string }[];
  };
}

async function join(url: string, sessionId: string, body: unknown) {
  const response = await fetch(`${url}/api/sessions/${sessionId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as {
    participant: { id: string; name: string };
    token: string;
  };
}

function postEvent(
  url: string,
  sessionId: string,
  token: string,
  body: unknown,
  options: { token?: string | null } = {},
) {
  const headerToken = options.token === undefined ? token : options.token;
  return fetch(`${url}/api/sessions/${sessionId}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headerToken ? { "X-Session-Token": headerToken } : {}),
    },
    body: JSON.stringify(body),
  });
}
