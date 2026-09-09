import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { signAuthenticationToken } from "../../identity/utils/jwt";
import { InMemoryNotificationRepository } from "../../notifications/repositories/in-memory-notification.repository";
import { InMemoryOrganisedGameRepository } from "../../organised-games/repositories/in-memory-organised-game.repository";
import { InMemoryTeamRepository } from "../../teams/repositories/in-memory-team.repository";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { InMemoryLobbyRepository } from "../repositories/in-memory-lobby.repository";

const WINDOW = {
  windowStart: "2026-12-01T16:00:00.000Z",
  windowEnd: "2026-12-01T18:00:00.000Z",
};

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

describe("lobby HTTP", () => {
  const config = makeConfig();
  let venues: InMemoryVenueRepository;
  let friendships: InMemoryFriendshipRepository;
  let profiles: InMemoryFriendProfileLookup;
  let lobby: InMemoryLobbyRepository;
  let organised: InMemoryOrganisedGameRepository;
  let notifications: InMemoryNotificationRepository;
  let teams: InMemoryTeamRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  function cookie(userId: string) {
    return `token=${signAuthenticationToken(config, { userId })}`;
  }

  beforeEach(async () => {
    venues = new InMemoryVenueRepository();
    friendships = new InMemoryFriendshipRepository();
    profiles = new InMemoryFriendProfileLookup();
    lobby = new InMemoryLobbyRepository();
    organised = new InMemoryOrganisedGameRepository();
    notifications = new InMemoryNotificationRepository();
    teams = new InMemoryTeamRepository();

    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-court-1"),
        VenueName.from("Padel Club"),
        Slug.from("padel-club"),
      ),
      { refreshDetails: false },
    );

    profiles.seed({
      userId: "user-a",
      displayName: "Alex Smith",
      handle: "alex",
      avatarUrl: "https://cdn.example/alex.png",
    });
    profiles.seed({
      userId: "user-b",
      displayName: "Blake Jones",
      handle: "blake",
      avatarUrl: null,
    });
    profiles.seed({
      userId: "user-c",
      displayName: "Casey Lee",
      handle: "casey",
      avatarUrl: null,
    });

    app = await createApp(config, {
      venueRepository: venues,
      friendshipRepository: friendships,
      friendProfileLookup: profiles,
      lobbyRepository: lobby,
      organisedGameRepository: organised,
      notificationRepository: notifications,
      teamRepository: teams,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("looking / post / join / kick / accept require auth", async () => {
    const looking = await fetch(`${server.url}/api/lobby/looking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport: "padel",
        ...WINDOW,
        city: "Cape Town",
      }),
    });
    expect(looking.status).toBe(401);

    const open = await fetch(`${server.url}/api/lobby/open-games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport: "padel",
        ...WINDOW,
        city: "Cape Town",
      }),
    });
    expect(open.status).toBe(401);

    const join = await fetch(`${server.url}/api/lobby/open-games/x/join`, {
      method: "POST",
    });
    expect(join.status).toBe(401);

    const kick = await fetch(`${server.url}/api/lobby/open-games/x/kick`, {
      method: "POST",
    });
    expect(kick.status).toBe(401);

    const accept = await fetch(`${server.url}/api/lobby/proposals/x/accept`, {
      method: "POST",
    });
    expect(accept.status).toBe(401);
  });

  test("looking CRUD and public list privacy", async () => {
    const created = await fetch(`${server.url}/api/lobby/looking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        sport: "golf",
        ...WINDOW,
        city: "Cape Town",
        area: "Sea Point",
        skill: "casual",
        partySizeWithMe: 1,
      }),
    });
    expect(created.status).toBe(200);
    const createdBody = (await created.json()) as {
      looking: { id: string; firstName: string; expiresAt: string };
    };
    expect(createdBody.looking.firstName).toBe("Alex");
    expect(createdBody.looking.expiresAt).toBeTruthy();

    const listed = await fetch(`${server.url}/api/lobby?city=Cape%20Town`);
    expect(listed.status).toBe(200);
    const listBody = (await listed.json()) as {
      lookings: Array<Record<string, unknown>>;
    };
    expect(listBody.lookings).toEqual([
      {
        id: createdBody.looking.id,
        firstName: "Alex",
        sport: "golf",
        windowStart: WINDOW.windowStart,
        windowEnd: WINDOW.windowEnd,
        city: "Cape Town",
        area: "Sea Point",
      },
    ]);
    expect(JSON.stringify(listBody.lookings[0])).not.toContain("alex");
    expect(JSON.stringify(listBody.lookings[0])).not.toContain("Smith");

    const cleared = await fetch(`${server.url}/api/lobby/looking`, {
      method: "DELETE",
      headers: { Cookie: cookie("user-a") },
    });
    expect(cleared.status).toBe(200);
    const after = await fetch(`${server.url}/api/lobby?sport=golf`);
    const afterBody = (await after.json()) as { lookings: unknown[] };
    expect(afterBody.lookings).toEqual([]);
  });

  test("open game create, join, kick", async () => {
    const created = await fetch(`${server.url}/api/lobby/open-games`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        sport: "padel",
        ...WINDOW,
        city: "Cape Town",
        venueCmsId: "sanity-court-1",
        slotsNeeded: 4,
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      openGame: { id: string; slotsRemaining: number };
    };
    expect(createdBody.openGame.slotsRemaining).toBe(3);

    const joined = await fetch(
      `${server.url}/api/lobby/open-games/${createdBody.openGame.id}/join`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-b"),
        },
        body: JSON.stringify({ partySizeWithMe: 1 }),
      },
    );
    expect(joined.status).toBe(200);
    const joinedBody = (await joined.json()) as {
      openGame: { slotsFilled: number; status: string };
    };
    expect(joinedBody.openGame.slotsFilled).toBe(2);
    expect(joinedBody.openGame.status).toBe("open");

    const kicked = await fetch(
      `${server.url}/api/lobby/open-games/${createdBody.openGame.id}/kick`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({ userId: "user-b" }),
      },
    );
    expect(kicked.status).toBe(200);
    const kickedBody = (await kicked.json()) as {
      openGame: { slotsFilled: number };
    };
    expect(kickedBody.openGame.slotsFilled).toBe(1);

    const forbidden = await fetch(
      `${server.url}/api/lobby/open-games/${createdBody.openGame.id}/kick`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-b"),
        },
        body: JSON.stringify({ userId: "user-a" }),
      },
    );
    expect(forbidden.status).toBe(403);
  });

  test("proposal accept converts to Organise; pass cancels", async () => {
    await fetch(`${server.url}/api/lobby/looking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        sport: "padel",
        ...WINDOW,
        city: "Cape Town",
        venueCmsId: "sanity-court-1",
        partySizeWithMe: 2,
      }),
    });
    const lookingB = await fetch(`${server.url}/api/lobby/looking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-b"),
      },
      body: JSON.stringify({
        sport: "padel",
        ...WINDOW,
        city: "Cape Town",
        partySizeWithMe: 2,
      }),
    });
    const lookingBody = (await lookingB.json()) as {
      proposals: Array<{ id: string }>;
    };
    expect(lookingBody.proposals).toHaveLength(1);
    const proposalId = lookingBody.proposals[0].id;

    const acceptA = await fetch(
      `${server.url}/api/lobby/proposals/${proposalId}/accept`,
      { method: "POST", headers: { Cookie: cookie("user-a") } },
    );
    expect(acceptA.status).toBe(200);

    const acceptB = await fetch(
      `${server.url}/api/lobby/proposals/${proposalId}/accept`,
      { method: "POST", headers: { Cookie: cookie("user-b") } },
    );
    expect(acceptB.status).toBe(200);
    const accepted = (await acceptB.json()) as {
      proposal: {
        status: string;
        organiseGameId: string | null;
        source: string;
      };
    };
    expect(accepted.proposal.status).toBe("accepted");
    expect(accepted.proposal.source).toBe("lobby");
    expect(accepted.proposal.organiseGameId).toBeTruthy();
    expect(
      await organised.findById(accepted.proposal.organiseGameId!),
    ).toBeTruthy();

    await fetch(`${server.url}/api/lobby/looking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        sport: "darts",
        ...WINDOW,
        city: "Cape Town",
      }),
    });
    const dartsB = await fetch(`${server.url}/api/lobby/looking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-b"),
      },
      body: JSON.stringify({
        sport: "darts",
        ...WINDOW,
        city: "Cape Town",
      }),
    });
    const dartsBody = (await dartsB.json()) as {
      proposals: Array<{ id: string }>;
    };
    const pass = await fetch(
      `${server.url}/api/lobby/proposals/${dartsBody.proposals[0].id}/pass`,
      { method: "POST", headers: { Cookie: cookie("user-a") } },
    );
    expect(pass.status).toBe(200);
    const passed = (await pass.json()) as { proposal: { status: string } };
    expect(passed.proposal.status).toBe("cancelled");
  });
});
