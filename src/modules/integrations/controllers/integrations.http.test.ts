import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";
import jwt from "jsonwebtoken";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { InMemoryIntegrationConnectionRepository } from "../repositories/in-memory-integration-connection.repository";

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

describe("integrations HTTP", () => {
  const config = makeConfig();
  let connections: InMemoryIntegrationConnectionRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    connections = new InMemoryIntegrationConnectionRepository();
    app = await createApp(config, {
      venueRepository: new InMemoryVenueRepository(),
      friendshipRepository: new InMemoryFriendshipRepository(),
      friendProfileLookup: new InMemoryFriendProfileLookup(),
      integrationConnectionRepository: connections,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  function cookie(userId: string) {
    return `token=${jwt.sign({ userId }, config.JWT_SECRET)}`;
  }

  test("guests get 401 on every integrations route", async () => {
    const list = await fetch(`${server.url}/api/me/integrations`);
    expect(list.status).toBe(401);

    const connect = await fetch(
      `${server.url}/api/me/integrations/generic-import/connect`,
      { method: "POST", headers: { "Content-Type": "application/json" } },
    );
    expect(connect.status).toBe(401);

    const disconnect = await fetch(
      `${server.url}/api/me/integrations/generic-import`,
      { method: "DELETE" },
    );
    expect(disconnect.status).toBe(401);

    const sync = await fetch(
      `${server.url}/api/me/integrations/generic-import/sync`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport: "padel",
          playedAt: "2026-09-06T10:00:00.000Z",
        }),
      },
    );
    expect(sync.status).toBe(401);
  });

  test("list, connect, sync, and disconnect generic-import", async () => {
    const listed = await fetch(`${server.url}/api/me/integrations`, {
      headers: { Cookie: cookie("user-a") },
    });
    expect(listed.status).toBe(200);
    const listedBody = (await listed.json()) as {
      providers: Array<{
        id: string;
        available: boolean;
        comingSoon: boolean;
        status: string;
      }>;
    };
    expect(listedBody.providers.map((provider) => provider.id)).toEqual([
      "generic-import",
      "trackman",
      "autodarts",
    ]);
    expect(listedBody.providers[0]).toMatchObject({
      available: true,
      comingSoon: false,
      status: "disconnected",
    });
    expect(listedBody.providers[1]).toMatchObject({
      id: "trackman",
      available: false,
      comingSoon: true,
    });

    const token = "hub-import-token-99";
    const connected = await fetch(
      `${server.url}/api/me/integrations/generic-import/connect`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({ token }),
      },
    );
    expect(connected.status).toBe(200);
    const connectedBody = await connected.json();
    expect(connectedBody).toMatchObject({
      provider: {
        id: "generic-import",
        status: "connected",
        credentialMasked: "••••n-99",
      },
    });
    expect(JSON.stringify(connectedBody)).not.toContain(token);

    const synced = await fetch(
      `${server.url}/api/me/integrations/generic-import/sync`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({
          sport: "padel",
          playedAt: "2026-09-06T10:00:00.000Z",
          title: "Club night",
        }),
      },
    );
    expect(synced.status).toBe(200);
    expect(await synced.json()).toMatchObject({
      provider: {
        status: "connected",
        importedSessionCount: 1,
        lastImportedSession: { sport: "padel", title: "Club night" },
      },
    });

    const wrapped = await fetch(
      `${server.url}/api/me/integrations/generic-import/sync`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({
          sessions: [
            {
              sport: "golf",
              playedAt: "2026-09-06T11:00:00.000Z",
              title: "Range",
            },
          ],
        }),
      },
    );
    expect(wrapped.status).toBe(200);
    expect(await wrapped.json()).toMatchObject({
      provider: {
        importedSessionCount: 2,
        lastImportedSession: { title: "Range" },
      },
    });

    const disconnected = await fetch(
      `${server.url}/api/me/integrations/generic-import`,
      {
        method: "DELETE",
        headers: { Cookie: cookie("user-a") },
      },
    );
    expect(disconnected.status).toBe(200);
    expect(await disconnected.json()).toMatchObject({
      provider: {
        status: "disconnected",
        importedSessionCount: 2,
        credentialMasked: null,
      },
    });
  });

  test("unknown provider, coming soon, and invalid payloads map to HTTP errors", async () => {
    const missing = await fetch(
      `${server.url}/api/me/integrations/not-a-provider/connect`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({}),
      },
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: "Integration provider not found",
    });

    const comingSoon = await fetch(
      `${server.url}/api/me/integrations/trackman/connect`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({ token: "vendor-key" }),
      },
    );
    expect(comingSoon.status).toBe(409);
    expect(await comingSoon.json()).toEqual({
      error: "trackman is not available yet",
    });

    const notConnected = await fetch(
      `${server.url}/api/me/integrations/generic-import/sync`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({
          sport: "padel",
          playedAt: "2026-09-06T10:00:00.000Z",
        }),
      },
    );
    expect(notConnected.status).toBe(409);

    const invalid = await fetch(
      `${server.url}/api/me/integrations/generic-import/sync`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({}),
      },
    );
    expect(invalid.status).toBe(400);
  });

  test("connections are scoped to the session user", async () => {
    await fetch(`${server.url}/api/me/integrations/generic-import/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({}),
    });

    const other = await fetch(`${server.url}/api/me/integrations`, {
      headers: { Cookie: cookie("user-b") },
    });
    const otherBody = (await other.json()) as {
      providers: Array<{ id: string; status: string }>;
    };
    expect(
      otherBody.providers.find((provider) => provider.id === "generic-import")
        ?.status,
    ).toBe("disconnected");
  });
});
