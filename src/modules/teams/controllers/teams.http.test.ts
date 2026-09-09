import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { signAuthenticationToken } from "../../identity/utils/jwt";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { Team } from "../entities/team";
import { TeamName } from "../entities/team-name";
import { TeamSport } from "../entities/team-sport";
import { InMemoryTeamRepository } from "../repositories/in-memory-team.repository";

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

async function becomeFriends(
  friendships: InMemoryFriendshipRepository,
  a: string,
  b: string,
) {
  const pending = await friendships.createPending(a, b);
  await friendships.accept(pending.id);
}

type PublicTeam = {
  id: string;
  name: string;
  sport: string;
  homeVenueCmsId: string | null;
  memberCount: number;
  myRole: string;
  myStatus: string;
  members: Array<{
    id: string;
    handle: string;
    role: string;
    status: string;
  }>;
  inviteLink: { token: string; createdAt: string } | null;
};

describe("teams HTTP", () => {
  const config = makeConfig();
  let teams: InMemoryTeamRepository;
  let friendships: InMemoryFriendshipRepository;
  let profiles: InMemoryFriendProfileLookup;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  function cookie(userId: string) {
    return `token=${signAuthenticationToken(config, { userId })}`;
  }

  async function json(
    path: string,
    init: RequestInit & { userId?: string } = {},
  ) {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (init.userId) {
      headers.set("Cookie", cookie(init.userId));
    }
    return fetch(`${server.url}${path}`, { ...init, headers });
  }

  beforeEach(async () => {
    teams = new InMemoryTeamRepository();
    friendships = new InMemoryFriendshipRepository();
    profiles = new InMemoryFriendProfileLookup();

    profiles.seed({
      userId: "user-a",
      displayName: "Alex",
      handle: "alex",
      avatarUrl: null,
    });
    profiles.seed({
      userId: "user-b",
      displayName: "Blake",
      handle: "blake",
      avatarUrl: null,
    });
    profiles.seed({
      userId: "user-c",
      displayName: "Casey",
      handle: "casey",
      avatarUrl: null,
    });

    await becomeFriends(friendships, "user-a", "user-b");

    app = await createApp(config, {
      venueRepository: new InMemoryVenueRepository(),
      friendshipRepository: friendships,
      friendProfileLookup: profiles,
      teamRepository: teams,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("create requires auth and makes the caller the owner", async () => {
    const unauth = await json("/api/teams", {
      method: "POST",
      body: JSON.stringify({ name: "Sunday Smash", sport: "padel" }),
    });
    expect(unauth.status).toBe(401);

    const created = await json("/api/teams", {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({
        name: "Sunday Smash",
        sport: "padel",
        homeVenueCmsId: "sanity-court-1",
      }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { team: PublicTeam };
    expect(body.team).toMatchObject({
      name: "Sunday Smash",
      sport: "padel",
      homeVenueCmsId: "sanity-court-1",
      memberCount: 1,
      myRole: "owner",
      myStatus: "active",
    });
    expect(body.team.members).toEqual([
      expect.objectContaining({ handle: "alex", role: "owner", status: "active" }),
    ]);
  });

  test("list mine + pending invites and get roster", async () => {
    const created = await json("/api/teams", {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ name: "Active Side", sport: "golf" }),
    });
    const { team } = (await created.json()) as { team: PublicTeam };

    const pending = Team.create({
      name: TeamName.from("Pending Side"),
      sport: TeamSport.from("darts"),
      createdBy: "user-c",
    });
    const snapshot = pending.toSnapshot();
    snapshot.members.push({
      id: "invite-mem",
      userId: "user-a",
      role: "member",
      status: "invited",
      joinedAt: new Date().toISOString(),
    });
    await teams.create(Team.fromSnapshot(snapshot));

    const listed = await json("/api/teams", { userId: "user-a" });
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({
      teams: [expect.objectContaining({ id: team.id, myRole: "owner" })],
      pendingInvites: [
        expect.objectContaining({ name: "Pending Side", myStatus: "invited" }),
      ],
    });

    const detail = await json(`/api/teams/${team.id}`, { userId: "user-a" });
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({
      team: {
        id: team.id,
        members: [{ handle: "alex", role: "owner" }],
      },
    });

    const stranger = await json(`/api/teams/${team.id}`, { userId: "user-c" });
    expect(stranger.status).toBe(403);
  });

  test("friend invite direct-adds; strangers are rejected", async () => {
    const created = await json("/api/teams", {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ name: "Squad", sport: "padel" }),
    });
    const { team } = (await created.json()) as { team: PublicTeam };

    const stranger = await json(`/api/teams/${team.id}/invite`, {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ userIds: ["user-c"] }),
    });
    expect(stranger.status).toBe(400);
    expect(await stranger.json()).toMatchObject({
      error: "Can only invite an accepted friend",
    });

    const invited = await json(`/api/teams/${team.id}/invite`, {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ userIds: ["user-b"] }),
    });
    expect(invited.status).toBe(200);
    const invitedBody = (await invited.json()) as { team: PublicTeam };
    expect(invitedBody.team.memberCount).toBe(2);
    expect(invitedBody.team.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          handle: "blake",
          role: "member",
          status: "active",
        }),
      ]),
    );
  });

  test("invite link join adds an active member", async () => {
    const created = await json("/api/teams", {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ name: "Open Squad", sport: "darts" }),
    });
    const { team } = (await created.json()) as { team: PublicTeam };

    const linkRes = await json(`/api/teams/${team.id}/invite-link`, {
      method: "POST",
      userId: "user-a",
    });
    expect(linkRes.status).toBe(201);
    const { inviteLink } = (await linkRes.json()) as {
      inviteLink: { token: string };
    };
    expect(inviteLink.token).toHaveLength(32);

    const joined = await json("/api/teams/join", {
      method: "POST",
      userId: "user-c",
      body: JSON.stringify({ token: inviteLink.token }),
    });
    expect(joined.status).toBe(200);
    expect(await joined.json()).toMatchObject({
      team: {
        id: team.id,
        myRole: "member",
        myStatus: "active",
        memberCount: 2,
      },
    });

    const stale = await json(`/api/teams/${team.id}/invite-link`, {
      method: "POST",
      userId: "user-a",
    });
    const next = (await stale.json()) as { inviteLink: { token: string } };
    const rejected = await json("/api/teams/join", {
      method: "POST",
      userId: "user-b",
      body: JSON.stringify({ token: inviteLink.token }),
    });
    expect(rejected.status).toBe(404);
    const joinedNext = await json("/api/teams/join", {
      method: "POST",
      userId: "user-b",
      body: JSON.stringify({ token: next.inviteLink.token }),
    });
    expect(joinedNext.status).toBe(200);
  });

  test("role updates, remove, leave, transfer, delete, and permission denials", async () => {
    await becomeFriends(friendships, "user-a", "user-c");
    const created = await json("/api/teams", {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ name: "Club", sport: "padel" }),
    });
    const { team } = (await created.json()) as { team: PublicTeam };

    const memberPatch = await json(`/api/teams/${team.id}`, {
      method: "PATCH",
      userId: "user-b",
      body: JSON.stringify({ name: "Hijack" }),
    });
    expect(memberPatch.status).toBe(403);

    const patched = await json(`/api/teams/${team.id}`, {
      method: "PATCH",
      userId: "user-a",
      body: JSON.stringify({ name: "Night Club", sport: "golf" }),
    });
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({
      team: { name: "Night Club", sport: "golf" },
    });

    await json(`/api/teams/${team.id}/invite`, {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ userIds: ["user-b", "user-c"] }),
    });

    const memberPromote = await json(`/api/teams/${team.id}/members/user-c`, {
      method: "PATCH",
      userId: "user-b",
      body: JSON.stringify({ role: "captain" }),
    });
    expect(memberPromote.status).toBe(403);

    const promote = await json(`/api/teams/${team.id}/members/user-b`, {
      method: "PATCH",
      userId: "user-a",
      body: JSON.stringify({ role: "captain" }),
    });
    expect(promote.status).toBe(200);
    expect(await promote.json()).toMatchObject({
      team: {
        members: expect.arrayContaining([
          expect.objectContaining({ id: "user-b", role: "captain" }),
        ]),
      },
    });

    const demoteOwner = await json(`/api/teams/${team.id}/members/user-a`, {
      method: "PATCH",
      userId: "user-a",
      body: JSON.stringify({ role: "member" }),
    });
    expect(demoteOwner.status).toBe(409);

    const removeOwner = await json(`/api/teams/${team.id}/members/user-a`, {
      method: "DELETE",
      userId: "user-b",
    });
    expect(removeOwner.status).toBe(403);

    const removed = await json(`/api/teams/${team.id}/members/user-c`, {
      method: "DELETE",
      userId: "user-b",
    });
    expect(removed.status).toBe(200);
    const removedBody = (await removed.json()) as { team: PublicTeam };
    expect(removedBody.team.members.map((member) => member.id)).not.toContain(
      "user-c",
    );

    await json(`/api/teams/${team.id}/invite`, {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ userIds: ["user-c"] }),
    });
    const ownerLeave = await json(`/api/teams/${team.id}/leave`, {
      method: "POST",
      userId: "user-a",
    });
    expect(ownerLeave.status).toBe(409);

    const left = await json(`/api/teams/${team.id}/leave`, {
      method: "POST",
      userId: "user-c",
    });
    expect(left.status).toBe(200);
    expect(await left.json()).toEqual({ ok: true });

    const memberDelete = await json(`/api/teams/${team.id}`, {
      method: "DELETE",
      userId: "user-b",
    });
    expect(memberDelete.status).toBe(403);

    const transferred = await json(`/api/teams/${team.id}/transfer-ownership`, {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ userId: "user-b" }),
    });
    expect(transferred.status).toBe(200);
    expect(await transferred.json()).toMatchObject({
      team: {
        myRole: "captain",
        members: expect.arrayContaining([
          expect.objectContaining({ id: "user-b", role: "owner" }),
          expect.objectContaining({ id: "user-a", role: "captain" }),
        ]),
      },
    });

    const deleted = await json(`/api/teams/${team.id}`, {
      method: "DELETE",
      userId: "user-b",
    });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ ok: true });

    const missing = await json(`/api/teams/${team.id}`, { userId: "user-b" });
    expect(missing.status).toBe(404);
  });

  test("unknown sport and empty invite payload are 400", async () => {
    const badSport = await json("/api/teams", {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ name: "X", sport: "tennis" }),
    });
    expect(badSport.status).toBe(400);

    const created = await json("/api/teams", {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ name: "X", sport: "padel" }),
    });
    const { team } = (await created.json()) as { team: PublicTeam };
    const emptyInvite = await json(`/api/teams/${team.id}/invite`, {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ userIds: [] }),
    });
    expect(emptyInvite.status).toBe(400);
  });
});
