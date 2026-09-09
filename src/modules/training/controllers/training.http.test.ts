import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";
import jwt from "jsonwebtoken";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { InMemoryTrainingEnrollmentRepository } from "../repositories/in-memory-training-enrollment.repository";

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

describe("training HTTP", () => {
  const config = makeConfig();
  let enrollments: InMemoryTrainingEnrollmentRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    enrollments = new InMemoryTrainingEnrollmentRepository();
    app = await createApp(config, {
      venueRepository: new InMemoryVenueRepository(),
      friendshipRepository: new InMemoryFriendshipRepository(),
      friendProfileLookup: new InMemoryFriendProfileLookup(),
      trainingEnrollmentRepository: enrollments,
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

  test("guests get 401 on every training route", async () => {
    const list = await fetch(`${server.url}/api/me/training/plans`);
    expect(list.status).toBe(401);

    const enroll = await fetch(`${server.url}/api/me/training/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "accuracy-focus" }),
    });
    expect(enroll.status).toBe(401);

    const advance = await fetch(
      `${server.url}/api/me/training/enrollments/any`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ percentComplete: 50 }),
      },
    );
    expect(advance.status).toBe(401);
  });

  test("list catalog, start, resume, advance, complete, and re-enroll", async () => {
    const listed = await fetch(`${server.url}/api/me/training/plans`, {
      headers: { Cookie: cookie("user-a") },
    });
    expect(listed.status).toBe(200);
    const listedBody = (await listed.json()) as {
      plans: Array<{ id: string; title: string }>;
      enrollments: unknown[];
    };
    expect(listedBody.plans.map((plan) => plan.id)).toEqual([
      "accuracy-focus",
      "consistency-builder",
      "match-intensity",
    ]);
    expect(listedBody.plans[0]).toMatchObject({
      title: "Accuracy Focus",
      sport: "padel",
      focus: "accuracy",
    });
    expect(listedBody.enrollments).toEqual([]);

    const created = await fetch(`${server.url}/api/me/training/enrollments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({ planId: "accuracy-focus" }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      resumed: boolean;
      enrollment: { id: string; status: string; percentComplete: number };
    };
    expect(createdBody.resumed).toBe(false);
    expect(createdBody.enrollment).toMatchObject({
      planId: "accuracy-focus",
      status: "active",
      percentComplete: 0,
    });

    const resumed = await fetch(`${server.url}/api/me/training/enrollments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({ planId: "accuracy-focus" }),
    });
    expect(resumed.status).toBe(200);
    const resumedBody = (await resumed.json()) as {
      resumed: boolean;
      enrollment: { id: string };
    };
    expect(resumedBody.resumed).toBe(true);
    expect(resumedBody.enrollment.id).toBe(createdBody.enrollment.id);

    const advanced = await fetch(
      `${server.url}/api/me/training/enrollments/${createdBody.enrollment.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({
          completedStepIds: ["warm-up", "target-practice"],
        }),
      },
    );
    expect(advanced.status).toBe(200);
    expect(await advanced.json()).toMatchObject({
      enrollment: {
        id: createdBody.enrollment.id,
        completedStepIds: ["warm-up", "target-practice"],
        percentComplete: 50,
        currentStepIndex: 2,
        status: "active",
      },
    });

    const finished = await fetch(
      `${server.url}/api/me/training/enrollments/${createdBody.enrollment.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({ percentComplete: 100 }),
      },
    );
    expect(finished.status).toBe(200);
    expect(await finished.json()).toMatchObject({
      enrollment: { status: "completed", percentComplete: 100 },
    });

    const again = await fetch(`${server.url}/api/me/training/enrollments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({ planId: "accuracy-focus" }),
    });
    expect(again.status).toBe(201);
    const againBody = (await again.json()) as {
      resumed: boolean;
      enrollment: { id: string; status: string };
    };
    expect(againBody.resumed).toBe(false);
    expect(againBody.enrollment.id).not.toBe(createdBody.enrollment.id);
    expect(againBody.enrollment.status).toBe("active");

    const history = await fetch(`${server.url}/api/me/training/plans`, {
      headers: { Cookie: cookie("user-a") },
    });
    const historyBody = (await history.json()) as {
      enrollments: Array<{ id: string; status: string }>;
    };
    expect(historyBody.enrollments).toHaveLength(2);
    expect(historyBody.enrollments[0]).toMatchObject({
      id: againBody.enrollment.id,
      status: "active",
    });
    expect(historyBody.enrollments[1]).toMatchObject({
      id: createdBody.enrollment.id,
      status: "completed",
    });
  });

  test("unknown plan, foreign enrollment, and invalid payload map to HTTP errors", async () => {
    const missingPlan = await fetch(
      `${server.url}/api/me/training/enrollments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({ planId: "not-a-plan" }),
      },
    );
    expect(missingPlan.status).toBe(404);
    expect(await missingPlan.json()).toEqual({
      error: "Training plan not found",
    });

    const created = await fetch(`${server.url}/api/me/training/enrollments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({ planId: "match-intensity" }),
    });
    const { enrollment } = (await created.json()) as {
      enrollment: { id: string };
    };

    const foreign = await fetch(
      `${server.url}/api/me/training/enrollments/${enrollment.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-b"),
        },
        body: JSON.stringify({ percentComplete: 50 }),
      },
    );
    expect(foreign.status).toBe(404);

    const invalid = await fetch(
      `${server.url}/api/me/training/enrollments/${enrollment.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({}),
      },
    );
    expect(invalid.status).toBe(400);
  });
});
