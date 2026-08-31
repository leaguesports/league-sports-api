import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";
import jwt from "jsonwebtoken";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { CmsId } from "../entities/cms-id";
import { InMemoryVenueRepository } from "../repositories/in-memory-venue.repository";
import { VenuePersistenceError } from "../repositories/venue-persistence-error";

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

describe("venues HTTP", () => {
  const config = makeConfig();
  let venues: InMemoryVenueRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    venues = new InMemoryVenueRepository();
    app = await createApp(config, { venueRepository: venues });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("GET is read-only and returns 404 when missing", async () => {
    const response = await fetch(
      `${server.url}/api/venues/sanity-1?name=ShouldNotWrite&slug=should-not-write`,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Venue not found" });
    expect(await venues.findByCmsId(CmsId.from("sanity-1"))).toBeNull();
  });

  test("PUT creates on first call and returns the same id on the second", async () => {
    const first = await fetch(`${server.url}/api/venues/sanity-1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmsId: "sanity-1",
        name: "Grand Prix Arena",
        slug: "grand-prix-arena",
      }),
    });
    const firstBody = (await first.json()) as { id: string; cmsId: string };

    expect(first.status).toBe(201);
    expect(firstBody.cmsId).toBe("sanity-1");

    const second = await fetch(`${server.url}/api/venues/sanity-1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmsId: "sanity-1",
        name: "Poisoned",
        slug: "poisoned",
      }),
    });
    const secondBody = (await second.json()) as {
      id: string;
      name: string;
      slug: string;
    };

    expect(second.status).toBe(200);
    expect(secondBody.id).toBe(firstBody.id);
    expect(secondBody.name).toBe("Grand Prix Arena");
    expect(secondBody.slug).toBe("grand-prix-arena");

    const read = await fetch(`${server.url}/api/venues/sanity-1`);
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({
      id: firstBody.id,
      cmsId: "sanity-1",
      name: "Grand Prix Arena",
      slug: "grand-prix-arena",
    });
  });

  test("PUT rejects missing or whitespace-only name and slug", async () => {
    const missing = await fetch(`${server.url}/api/venues/sanity-1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(missing.status).toBe(400);

    const blankName = await fetch(`${server.url}/api/venues/sanity-1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   ", slug: "grand-prix-arena" }),
    });
    expect(blankName.status).toBe(400);

    const blankSlug = await fetch(`${server.url}/api/venues/sanity-1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Grand Prix Arena", slug: "   " }),
    });
    expect(blankSlug.status).toBe(400);

    expect(await venues.findByCmsId(CmsId.from("sanity-1"))).toBeNull();
  });

  test("authenticated PUT refreshes name and slug", async () => {
    const created = await fetch(`${server.url}/api/venues/sanity-1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Grand Prix Arena",
        slug: "grand-prix-arena",
      }),
    });
    const createdBody = (await created.json()) as { id: string };
    const token = jwt.sign({ userId: "user-1" }, config.JWT_SECRET);

    const refreshed = await fetch(`${server.url}/api/venues/sanity-1`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${token}`,
      },
      body: JSON.stringify({
        name: "Arena Renamed",
        slug: "arena-renamed",
      }),
    });
    const refreshedBody = (await refreshed.json()) as {
      id: string;
      name: string;
      slug: string;
    };

    expect(refreshed.status).toBe(200);
    expect(refreshedBody.id).toBe(createdBody.id);
    expect(refreshedBody.name).toBe("Arena Renamed");
    expect(refreshedBody.slug).toBe("arena-renamed");
  });

  test("PUT maps persistence failures instead of returning 200", async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
    app = await createApp(config, {
      venueRepository: {
        findById: async () => null,
        findByCmsId: async () => null,
        findByCmsIds: async () => [],
        ensureFromCms: async () => {
          throw new VenuePersistenceError();
        },
      },
    });
    server = await listen(app);

    const response = await fetch(`${server.url}/api/venues/sanity-1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Grand Prix Arena",
        slug: "grand-prix-arena",
      }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Unable to save venue" });
  });
});
