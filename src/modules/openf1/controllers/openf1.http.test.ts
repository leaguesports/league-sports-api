import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryOpenF1Client } from "../client/in-memory-openf1-client";
import { OpenF1Client } from "../client/openf1-client";
import { Meeting } from "../entities/meeting";
import { OpenF1UnavailableError } from "../entities/openf1-unavailable-error";
import { Session } from "../entities/session";
import {
  monacoGrandPrixMeetingApi,
  spanishGrandPrixMeetingApi,
  spanishGrandPrixSessionsApi,
} from "../test/fixtures";

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

describe("OpenF1 HTTP", () => {
  const config = makeConfig();
  let client: InMemoryOpenF1Client;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    client = new InMemoryOpenF1Client(
      [
        Meeting.fromApi(monacoGrandPrixMeetingApi),
        Meeting.fromApi(spanishGrandPrixMeetingApi),
      ],
      spanishGrandPrixSessionsApi.map((row) => Session.fromApi(row)),
    );
    app = await createApp(config, { openF1Client: client });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("lists meetings and returns a weekend for the Spanish GP event slug", async () => {
    const listed = await fetch(
      `${server.url}/api/openf1/meetings?year=2026&countryName=Spain`,
    );
    expect(listed.status).toBe(200);
    const listedBody = (await listed.json()) as {
      meetings: Array<{ meetingKey: number; eventSlug: string }>;
    };
    expect(listedBody.meetings).toEqual([
      expect.objectContaining({
        meetingKey: 1294,
        eventSlug: "spanish-grand-prix-2026-09-13",
      }),
    ]);

    const event = await fetch(
      `${server.url}/api/openf1/events/spanish-grand-prix-2026-09-13`,
    );
    expect(event.status).toBe(200);
    const eventBody = (await event.json()) as {
      meeting: { meetingName: string; location: string };
      sessions: Array<{ sessionName: string; sessionKey: number }>;
    };
    expect(eventBody.meeting).toMatchObject({
      meetingName: "Spanish Grand Prix",
      location: "Madrid",
    });
    expect(eventBody.sessions.map((session) => session.sessionName)).toEqual([
      "Practice 1",
      "Qualifying",
      "Race",
    ]);
  });

  test("gets a meeting weekend by key and a single session", async () => {
    const meeting = await fetch(`${server.url}/api/openf1/meetings/1294`);
    expect(meeting.status).toBe(200);
    const meetingBody = (await meeting.json()) as {
      sessions: Array<{ sessionKey: number }>;
    };
    expect(meetingBody.sessions[2]?.sessionKey).toBe(11369);

    const sessions = await fetch(
      `${server.url}/api/openf1/sessions?meetingKey=1294&sessionType=Qualifying`,
    );
    expect(sessions.status).toBe(200);
    const sessionsBody = (await sessions.json()) as {
      sessions: Array<{ sessionName: string }>;
    };
    expect(sessionsBody.sessions).toHaveLength(1);
    expect(sessionsBody.sessions[0]?.sessionName).toBe("Qualifying");

    const session = await fetch(`${server.url}/api/openf1/sessions/11369`);
    expect(session.status).toBe(200);
    expect(await session.json()).toEqual({
      session: expect.objectContaining({
        sessionName: "Race",
        sessionType: "Race",
      }),
    });
  });

  test("returns 404 / 400 / 503 for missing, invalid, and upstream failures", async () => {
    const missing = await fetch(
      `${server.url}/api/openf1/events/italian-grand-prix-2026-09-06`,
    );
    expect(missing.status).toBe(404);

    const invalid = await fetch(`${server.url}/api/openf1/meetings/not-a-key`);
    expect(invalid.status).toBe(400);

    const badYear = await fetch(`${server.url}/api/openf1/meetings?year=twenty`);
    expect(badYear.status).toBe(400);

    const failingClient: OpenF1Client = {
      listMeetings: async () => {
        throw new OpenF1UnavailableError();
      },
      listSessions: async () => {
        throw new OpenF1UnavailableError();
      },
    };
    const failingApp = await createApp(config, { openF1Client: failingClient });
    const failingServer = await listen(failingApp);
    try {
      const unavailable = await fetch(
        `${failingServer.url}/api/openf1/meetings?year=2026`,
      );
      expect(unavailable.status).toBe(503);
    } finally {
      await failingServer.close();
      await failingApp.locals.prisma?.$disconnect();
    }
  });
});
