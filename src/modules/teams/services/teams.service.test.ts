import { DomainError } from "../../../lib/domain-error";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { Team } from "../entities/team";
import { TeamName } from "../entities/team-name";
import { TeamNotFriendError } from "../entities/team-not-friend-error";
import { TeamSport } from "../entities/team-sport";
import { InMemoryTeamRepository } from "../repositories/in-memory-team.repository";
import {
  CreateInviteLink,
  CreateTeam,
  DeleteTeam,
  GetTeam,
  InviteFriends,
  JoinByToken,
  LeaveTeam,
  ListMyTeams,
  RemoveMember,
  TransferOwnership,
  UpdateMemberRole,
  UpdateTeam,
} from "./teams.service";

async function becomeFriends(
  friendships: InMemoryFriendshipRepository,
  a: string,
  b: string,
) {
  const pending = await friendships.createPending(a, b);
  await friendships.accept(pending.id);
}

function setup() {
  const teams = new InMemoryTeamRepository();
  const friendships = new InMemoryFriendshipRepository();
  const profiles = new InMemoryFriendProfileLookup();
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
  return {
    teams,
    friendships,
    profiles,
    create: new CreateTeam(teams, profiles),
    get: new GetTeam(teams, profiles),
    list: new ListMyTeams(teams),
    update: new UpdateTeam(teams, profiles),
    remove: new DeleteTeam(teams),
    invite: new InviteFriends(teams, friendships, profiles),
    inviteLink: new CreateInviteLink(teams),
    join: new JoinByToken(teams, profiles),
    updateRole: new UpdateMemberRole(teams, profiles),
    removeMember: new RemoveMember(teams, profiles),
    leave: new LeaveTeam(teams),
    transfer: new TransferOwnership(teams, profiles),
  };
}

describe("teams services", () => {
  test("create makes the session user the sole owner", async () => {
    const { create } = setup();
    const result = await create.execute({
      userId: "user-a",
      name: "  Sunday Smash  ",
      sport: "Padel",
    });

    expect(result.team).toMatchObject({
      name: "Sunday Smash",
      sport: "padel",
      memberCount: 1,
      myRole: "owner",
      myStatus: "active",
      createdBy: "user-a",
    });
    expect(result.team.members).toEqual([
      expect.objectContaining({
        id: "user-a",
        handle: "alex",
        role: "owner",
        status: "active",
      }),
    ]);
  });

  test("list splits active memberships from pending invites", async () => {
    const ctx = setup();
    const created = await ctx.create.execute({
      userId: "user-a",
      name: "Active Side",
      sport: "golf",
    });
    await becomeFriends(ctx.friendships, "user-a", "user-b");
    await ctx.invite.execute({
      userId: "user-a",
      teamId: created.team.id,
      userIds: ["user-b"],
    });

    const inviteTeam = Team.create({
      name: TeamName.from("Pending Side"),
      sport: TeamSport.from("darts"),
      createdBy: "user-c",
    });
    const snapshot = inviteTeam.toSnapshot();
    snapshot.members.push({
      id: "invite-mem",
      userId: "user-a",
      role: "member",
      status: "invited",
      joinedAt: new Date().toISOString(),
    });
    await ctx.teams.create(Team.fromSnapshot(snapshot));

    const listed = await ctx.list.execute({ userId: "user-a" });
    expect(listed.teams.map((team) => team.name)).toContain("Active Side");
    expect(listed.pendingInvites.map((team) => team.name)).toEqual([
      "Pending Side",
    ]);
    expect(listed.pendingInvites[0]?.myStatus).toBe("invited");
  });

  test("invite requires an accepted friendship and direct-adds", async () => {
    const ctx = setup();
    const created = await ctx.create.execute({
      userId: "user-a",
      name: "Squad",
      sport: "padel",
    });

    await expect(
      ctx.invite.execute({
        userId: "user-a",
        teamId: created.team.id,
        userIds: ["user-b"],
      }),
    ).rejects.toBeInstanceOf(TeamNotFriendError);

    const pending = await ctx.friendships.createPending("user-a", "user-b");
    await expect(
      ctx.invite.execute({
        userId: "user-a",
        teamId: created.team.id,
        userIds: ["user-b"],
      }),
    ).rejects.toBeInstanceOf(TeamNotFriendError);

    await ctx.friendships.accept(pending.id);
    const invited = await ctx.invite.execute({
      userId: "user-a",
      teamId: created.team.id,
      userIds: ["user-b"],
    });
    expect(invited.team.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "user-b",
          role: "member",
          status: "active",
        }),
      ]),
    );
  });

  test("join via invite token adds an active member", async () => {
    const ctx = setup();
    const created = await ctx.create.execute({
      userId: "user-a",
      name: "Open Squad",
      sport: "darts",
    });
    const link = await ctx.inviteLink.execute({
      userId: "user-a",
      teamId: created.team.id,
    });
    const joined = await ctx.join.execute({
      userId: "user-c",
      token: link.inviteLink.token,
    });
    expect(joined.team.myRole).toBe("member");
    expect(joined.team.memberCount).toBe(2);
  });

  test("update, roles, remove, leave, transfer, and delete", async () => {
    const ctx = setup();
    await becomeFriends(ctx.friendships, "user-a", "user-b");
    await becomeFriends(ctx.friendships, "user-a", "user-c");
    const created = await ctx.create.execute({
      userId: "user-a",
      name: "Club",
      sport: "padel",
    });
    const teamId = created.team.id;

    const updated = await ctx.update.execute({
      userId: "user-a",
      teamId,
      name: "Night Club",
      sport: "golf",
      hasHomeVenueCmsId: true,
      homeVenueCmsId: "venue-9",
    });
    expect(updated.team).toMatchObject({
      name: "Night Club",
      sport: "golf",
      homeVenueCmsId: "venue-9",
    });

    await ctx.invite.execute({
      userId: "user-a",
      teamId,
      userIds: ["user-b", "user-c"],
    });
    const captained = await ctx.updateRole.execute({
      userId: "user-a",
      teamId,
      memberUserId: "user-b",
      role: "captain",
    });
    expect(
      captained.team.members.find((member) => member.id === "user-b")?.role,
    ).toBe("captain");

    const removed = await ctx.removeMember.execute({
      userId: "user-b",
      teamId,
      memberUserId: "user-c",
    });
    expect(removed.team.members.map((member) => member.id)).not.toContain(
      "user-c",
    );

    await ctx.invite.execute({
      userId: "user-a",
      teamId,
      userIds: ["user-c"],
    });
    await ctx.leave.execute({ userId: "user-c", teamId });

    const transferred = await ctx.transfer.execute({
      userId: "user-a",
      teamId,
      newOwnerUserId: "user-b",
    });
    expect(transferred.team.myRole).toBe("captain");
    expect(
      transferred.team.members.find((member) => member.id === "user-b")?.role,
    ).toBe("owner");

    await expect(
      ctx.remove.execute({ userId: "user-a", teamId }),
    ).rejects.toBeInstanceOf(Error);

    await ctx.remove.execute({ userId: "user-b", teamId });
    await expect(ctx.get.execute({ userId: "user-b", teamId })).rejects.toThrow(
      "Team not found",
    );
  });

  test("rejects empty invite list and unknown sport", async () => {
    const ctx = setup();
    await expect(
      ctx.create.execute({
        userId: "user-a",
        name: "X",
        sport: "tennis",
      }),
    ).rejects.toBeInstanceOf(DomainError);

    const created = await ctx.create.execute({
      userId: "user-a",
      name: "X",
      sport: "padel",
    });
    await expect(
      ctx.invite.execute({
        userId: "user-a",
        teamId: created.team.id,
        userIds: [],
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
