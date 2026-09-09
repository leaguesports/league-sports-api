import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { signAuthenticationToken } from "../../identity/utils/jwt";
import { RoadmapFeature } from "../entities/roadmap-feature";
import { RoadmapFeatureStatus } from "../entities/roadmap-feature-status";
import { InMemoryRoadmapRepository } from "../repositories/in-memory-roadmap.repository";
import { RecordingRoadmapEmailSender } from "../services/email-sender";
import { InMemoryWindowRateLimiter } from "../services/rate-limiter";
import { signRoadmapUnsubscribeToken } from "../services/unsubscribe-token";

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
    ROADMAP_SHIP_SECRET: "ship-test-secret",
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

function cookieHeader(res: Response): string {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const parts = headers.getSetCookie?.() ?? [headers.get("set-cookie") ?? ""];
  return parts
    .filter(Boolean)
    .map((part) => part.split(";")[0])
    .join("; ");
}

function voterCookie(res: Response): string | undefined {
  return cookieHeader(res)
    .split("; ")
    .find((part) => part.startsWith("roadmap_voter_id="));
}

describe("roadmap HTTP", () => {
  const config = makeConfig();
  let repo: InMemoryRoadmapRepository;
  let emails: RecordingRoadmapEmailSender;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };
  let feature: RoadmapFeature;

  beforeEach(async () => {
    repo = new InMemoryRoadmapRepository();
    emails = new RecordingRoadmapEmailSender();
    feature = repo.seedFeature(
      RoadmapFeature.create({
        slug: "live-scorecards",
        title: "Live scorecards",
        description: "Keep score together.",
        status: RoadmapFeatureStatus.PLANNED,
        githubIssueUrl:
          "https://github.com/leaguesports/league-sports-api/issues/999",
      }),
    );

    app = await createApp(config, {
      roadmapRepository: repo,
      roadmapEmailSender: emails,
      roadmapVoteRateLimiter: new InMemoryWindowRateLimiter(2, 60_000),
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("GET features omits githubIssueUrl and supports sort", async () => {
    const res = await fetch(`${server.url}/api/roadmap/features`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      features: Array<Record<string, unknown>>;
    };
    expect(body.features).toHaveLength(1);
    expect(body.features[0]).toMatchObject({
      id: feature.id,
      slug: "live-scorecards",
      title: "Live scorecards",
      status: "PLANNED",
      voteCount: 0,
      viewerHasVoted: false,
    });
    expect(body.features[0]).not.toHaveProperty("githubIssueUrl");
    expect(JSON.stringify(body)).not.toContain("githubIssueUrl");
    expect(JSON.stringify(body)).not.toContain(
      "github.com/leaguesports/league-sports-api/issues/999",
    );
  });

  test("vote toggles, sets cookie, and viewerHasVoted follows the cookie", async () => {
    const first = await fetch(
      `${server.url}/api/roadmap/features/${feature.id}/vote`,
      { method: "POST" },
    );
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ voted: true, voteCount: 1 });
    const cookie = voterCookie(first);
    expect(cookie).toMatch(/^roadmap_voter_id=/);

    const listed = await fetch(`${server.url}/api/roadmap/features`, {
      headers: { Cookie: cookie! },
    });
    const listedBody = (await listed.json()) as {
      features: Array<{ viewerHasVoted: boolean; voteCount: number }>;
    };
    expect(listedBody.features[0].viewerHasVoted).toBe(true);
    expect(listedBody.features[0].voteCount).toBe(1);

    const second = await fetch(
      `${server.url}/api/roadmap/features/${feature.id}/vote`,
      { method: "POST", headers: { Cookie: cookie! } },
    );
    expect(await second.json()).toEqual({ voted: false, voteCount: 0 });

    const after = await fetch(`${server.url}/api/roadmap/features`, {
      headers: { Cookie: cookie! },
    });
    const afterBody = (await after.json()) as {
      features: Array<{ viewerHasVoted: boolean }>;
    };
    expect(afterBody.features[0].viewerHasVoted).toBe(false);
  });

  test("signed-in vote binds userId and still sets the voter cookie", async () => {
    const session = `token=${signAuthenticationToken(config, { userId: "user-a" })}`;
    const voted = await fetch(
      `${server.url}/api/roadmap/features/${feature.id}/vote`,
      { method: "POST", headers: { Cookie: session } },
    );
    expect(voted.status).toBe(200);
    expect(voterCookie(voted)).toMatch(/^roadmap_voter_id=/);
    expect(await repo.hasVote(feature.id, "user:user-a")).toBe(true);

    const listed = await fetch(`${server.url}/api/roadmap/features`, {
      headers: { Cookie: session },
    });
    const body = (await listed.json()) as {
      features: Array<{ viewerHasVoted: boolean }>;
    };
    expect(body.features[0].viewerHasVoted).toBe(true);
  });

  test("notify is idempotent and preferences/unsubscribe work", async () => {
    const notifyOnce = await fetch(
      `${server.url}/api/roadmap/features/${feature.id}/notify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "  Foo@Bar.com " }),
      },
    );
    expect(notifyOnce.status).toBe(200);
    expect(await notifyOnce.json()).toEqual({ watching: true });

    const notifyTwice = await fetch(
      `${server.url}/api/roadmap/features/${feature.id}/notify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "foo@bar.com" }),
      },
    );
    expect(notifyTwice.status).toBe(200);

    const token = signRoadmapUnsubscribeToken(config.JWT_SECRET, "foo@bar.com");
    const prefs = await fetch(
      `${server.url}/api/roadmap/preferences?token=${encodeURIComponent(token)}`,
    );
    expect(prefs.status).toBe(200);
    expect(await prefs.json()).toEqual({
      email: "foo@bar.com",
      features: [
        expect.objectContaining({
          id: feature.id,
          slug: "live-scorecards",
          title: "Live scorecards",
        }),
      ],
    });

    const removed = await fetch(`${server.url}/api/roadmap/preferences`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, featureId: feature.id }),
    });
    expect(await removed.json()).toEqual({ removed: true });

    await fetch(
      `${server.url}/api/roadmap/features/${feature.id}/notify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "foo@bar.com" }),
      },
    );

    const unsub = await fetch(`${server.url}/api/roadmap/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(unsub.status).toBe(200);
    expect(await unsub.json()).toMatchObject({
      email: "foo@bar.com",
      unsubscribed: true,
    });

    const empty = await fetch(
      `${server.url}/api/roadmap/preferences?token=${encodeURIComponent(token)}`,
    );
    expect(await empty.json()).toEqual({
      email: "foo@bar.com",
      features: [],
    });
  });

  test("create request hides email on create and public list", async () => {
    const created = await fetch(`${server.url}/api/roadmap/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "BUG",
        title: "Scorecard lock hangs",
        details: "Locking a padel card never returns.",
        email: "secret@example.com",
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      request: Record<string, unknown>;
    };
    expect(createdBody.request).toMatchObject({
      type: "BUG",
      title: "Scorecard lock hangs",
      status: "NEW",
    });
    expect(createdBody.request).not.toHaveProperty("email");
    expect(createdBody.request).not.toHaveProperty("details");
    expect(JSON.stringify(createdBody)).not.toContain("secret@example.com");

    const listed = await fetch(`${server.url}/api/roadmap/requests`);
    expect(listed.status).toBe(200);
    const listedBody = (await listed.json()) as {
      requests: Array<Record<string, unknown>>;
    };
    expect(listedBody.requests[0]).toMatchObject({
      type: "BUG",
      title: "Scorecard lock hangs",
      status: "NEW",
    });
    expect(listedBody.requests[0]).not.toHaveProperty("email");
    expect(listedBody.requests[0]).not.toHaveProperty("details");
    expect(JSON.stringify(listedBody)).not.toContain("secret@example.com");
  });

  test("ship sets SHIPPED and invokes the email sender", async () => {
    await fetch(`${server.url}/api/roadmap/features/${feature.id}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "fan@example.com" }),
    });

    const denied = await fetch(
      `${server.url}/api/roadmap/features/${feature.id}/ship`,
      { method: "POST" },
    );
    expect(denied.status).toBe(401);

    const shipped = await fetch(
      `${server.url}/api/roadmap/features/${feature.slug}/ship`,
      {
        method: "POST",
        headers: { "X-Roadmap-Ship-Secret": "ship-test-secret" },
      },
    );
    expect(shipped.status).toBe(200);
    const body = (await shipped.json()) as {
      feature: { status: string; shippedAt: string | null };
      emailsSent: number;
    };
    expect(body.feature.status).toBe("SHIPPED");
    expect(body.feature.shippedAt).toEqual(expect.any(String));
    expect(body.emailsSent).toBe(1);
    expect(emails.sent).toHaveLength(1);
    expect(emails.sent[0]).toMatchObject({
      to: "fan@example.com",
      subject: "Live scorecards shipped",
    });
    expect(emails.sent[0].text).toContain("Unsubscribe");
    expect(JSON.stringify(body)).not.toContain("githubIssueUrl");

    const again = await fetch(
      `${server.url}/api/roadmap/features/${feature.id}/ship`,
      {
        method: "POST",
        headers: { "X-Roadmap-Ship-Secret": "ship-test-secret" },
      },
    );
    expect(again.status).toBe(409);
    expect(emails.sent).toHaveLength(1);
  });

  test("vote rate-limit returns 429", async () => {
    const first = await fetch(
      `${server.url}/api/roadmap/features/${feature.id}/vote`,
      { method: "POST" },
    );
    const cookie = cookieHeader(first);
    const second = await fetch(
      `${server.url}/api/roadmap/features/${feature.id}/vote`,
      { method: "POST", headers: { Cookie: cookie } },
    );
    expect(second.status).toBe(200);
    const third = await fetch(
      `${server.url}/api/roadmap/features/${feature.id}/vote`,
      { method: "POST", headers: { Cookie: cookie } },
    );
    expect(third.status).toBe(429);
  });
});
