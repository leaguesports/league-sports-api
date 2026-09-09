import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import {
  FriendProfile,
  FriendProfileLookup,
  FriendshipRepository,
} from "../../friends/repositories/friendship.repository";
import { HomeVenueCmsId } from "../entities/home-venue-cms-id";
import { Team } from "../entities/team";
import { TeamInviteLinkNotFoundError } from "../entities/team-invite-link-not-found-error";
import { TeamInviteToken } from "../entities/team-invite-token";
import { TeamMemberRole } from "../entities/team-member-role";
import { TeamName } from "../entities/team-name";
import { TeamNotFoundError } from "../entities/team-not-found-error";
import { TeamNotFriendError } from "../entities/team-not-friend-error";
import { TeamSport } from "../entities/team-sport";
import { TeamRepository } from "../repositories/team.repository";

export type PublicTeamMember = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  role: "owner" | "captain" | "member";
  status: "active" | "invited";
  joinedAt: string;
};

export type PublicInviteLink = {
  token: string;
  createdAt: string;
};

export type PublicTeamSummary = {
  id: string;
  name: string;
  sport: "padel" | "golf" | "darts";
  homeVenueCmsId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  myRole: "owner" | "captain" | "member";
  myStatus: "active" | "invited";
};

export type PublicTeam = PublicTeamSummary & {
  members: PublicTeamMember[];
  inviteLink: PublicInviteLink | null;
};

export type PublicTeamSearchHit = {
  id: string;
  name: string;
  sport: "padel" | "golf" | "darts";
  homeVenueCmsId: string | null;
  memberCount: number;
  source: "friend" | "name";
};

async function requireAcceptedFriend(
  friendships: FriendshipRepository,
  actorId: string,
  otherUserId: string,
): Promise<void> {
  const existing = await friendships.findBetween(actorId, otherUserId);
  if (!existing || existing.status !== "accepted") {
    throw new TeamNotFriendError();
  }
}

function parseUserIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new DomainError("userIds is required");
  }
  const ids: string[] = [];
  for (const item of raw) {
    const id = requiredTrimmed(item, "userId");
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function resolveProfile(
  lookup: FriendProfileLookup,
  userId: string,
): Promise<FriendProfile> {
  const profile = await lookup.findByUserId(userId);
  if (profile) return profile;
  return {
    userId,
    displayName: "Player",
    handle: userId.slice(0, 8),
    avatarUrl: null,
  };
}

function toPublicSummary(team: Team, userId: string): PublicTeamSummary {
  const snapshot = team.toSnapshot();
  const membership = team.membershipOf(userId);
  return {
    id: snapshot.id,
    name: snapshot.name,
    sport: snapshot.sport,
    homeVenueCmsId: snapshot.homeVenueCmsId,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    memberCount: team.memberCount,
    myRole: membership?.role.value ?? "member",
    myStatus: membership?.status.value ?? "active",
  };
}

async function toPublicMembers(
  lookup: FriendProfileLookup,
  team: Team,
): Promise<PublicTeamMember[]> {
  const out: PublicTeamMember[] = [];
  for (const member of team.toSnapshot().members) {
    const profile = await resolveProfile(lookup, member.userId);
    out.push({
      id: profile.userId,
      displayName: profile.displayName,
      handle: profile.handle,
      avatarUrl: profile.avatarUrl,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt,
    });
  }
  return out;
}

function publicInviteLink(team: Team, userId: string): PublicInviteLink | null {
  const membership = team.membershipOf(userId);
  if (!membership?.role.canInvite || !membership.status.isActive) {
    return null;
  }
  const link = team.activeInviteLink();
  if (!link) return null;
  return { token: link.token.value, createdAt: link.createdAt.toISOString() };
}

async function toPublicTeam(
  lookup: FriendProfileLookup,
  team: Team,
  userId: string,
): Promise<PublicTeam> {
  return {
    ...toPublicSummary(team, userId),
    members: await toPublicMembers(lookup, team),
    inviteLink: publicInviteLink(team, userId),
  };
}

async function loadTeam(teams: TeamRepository, teamId: string): Promise<Team> {
  const id = requiredTrimmed(teamId, "team id");
  const team = await teams.findById(id);
  if (!team) throw new TeamNotFoundError();
  return team;
}

export class CreateTeam {
  constructor(
    private readonly teams: TeamRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    name: unknown;
    sport: unknown;
    homeVenueCmsId?: unknown;
  }): Promise<{ team: PublicTeam }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const team = Team.create({
      name: TeamName.from(input.name),
      sport: TeamSport.from(input.sport),
      createdBy: userId,
      homeVenueCmsId: HomeVenueCmsId.from(input.homeVenueCmsId),
    });
    const saved = await this.teams.create(team);
    return { team: await toPublicTeam(this.profiles, saved, userId) };
  }
}

export class GetTeam {
  constructor(
    private readonly teams: TeamRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    teamId: string;
  }): Promise<{ team: PublicTeam }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const team = await loadTeam(this.teams, input.teamId);
    team.assertCanView(userId);
    return { team: await toPublicTeam(this.profiles, team, userId) };
  }
}

export class ListMyTeams {
  constructor(private readonly teams: TeamRepository) {}

  async execute(input: { userId: string }): Promise<{
    teams: PublicTeamSummary[];
    pendingInvites: PublicTeamSummary[];
  }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const rows = await this.teams.listForUser(userId);
    const teams: PublicTeamSummary[] = [];
    const pendingInvites: PublicTeamSummary[] = [];

    for (const team of rows) {
      const membership = team.membershipOf(userId);
      if (!membership) continue;
      const summary = toPublicSummary(team, userId);
      if (membership.status.isInvited) {
        pendingInvites.push(summary);
      } else if (membership.status.isActive) {
        teams.push(summary);
      }
    }

    return { teams, pendingInvites };
  }
}

export class UpdateTeam {
  constructor(
    private readonly teams: TeamRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    teamId: string;
    name?: unknown;
    sport?: unknown;
    homeVenueCmsId?: unknown;
    hasHomeVenueCmsId: boolean;
  }): Promise<{ team: PublicTeam }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const team = await loadTeam(this.teams, input.teamId);
    team.updateDetails(userId, {
      name: input.name === undefined ? undefined : TeamName.from(input.name),
      sport: input.sport === undefined ? undefined : TeamSport.from(input.sport),
      ...(input.hasHomeVenueCmsId
        ? { homeVenueCmsId: HomeVenueCmsId.from(input.homeVenueCmsId) }
        : {}),
    });
    const saved = await this.teams.persist(team);
    return { team: await toPublicTeam(this.profiles, saved, userId) };
  }
}

export class DeleteTeam {
  constructor(private readonly teams: TeamRepository) {}

  async execute(input: {
    userId: string;
    teamId: string;
  }): Promise<{ ok: true }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const team = await loadTeam(this.teams, input.teamId);
    team.assertCanDelete(userId);
    await this.teams.delete(team.id);
    return { ok: true as const };
  }
}

export class InviteFriends {
  constructor(
    private readonly teams: TeamRepository,
    private readonly friendships: FriendshipRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    teamId: string;
    userIds: unknown;
  }): Promise<{ team: PublicTeam }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const team = await loadTeam(this.teams, input.teamId);
    const userIds = parseUserIds(input.userIds);
    if (userIds.length === 0) {
      throw new DomainError("userIds is required");
    }

    for (const inviteeId of userIds) {
      await requireAcceptedFriend(this.friendships, userId, inviteeId);
      team.inviteFriend(userId, inviteeId);
    }

    const saved = await this.teams.persist(team);
    return { team: await toPublicTeam(this.profiles, saved, userId) };
  }
}

export class CreateInviteLink {
  constructor(private readonly teams: TeamRepository) {}

  async execute(input: {
    userId: string;
    teamId: string;
  }): Promise<{ inviteLink: PublicInviteLink }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const team = await loadTeam(this.teams, input.teamId);
    const link = team.regenerateInviteLink(userId);
    await this.teams.persist(team);
    return {
      inviteLink: {
        token: link.token.value,
        createdAt: link.createdAt.toISOString(),
      },
    };
  }
}

export class JoinByToken {
  constructor(
    private readonly teams: TeamRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    token: unknown;
  }): Promise<{ team: PublicTeam }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const token = TeamInviteToken.from(input.token);
    const team = await this.teams.findByInviteToken(token.value);
    if (!team) {
      throw new TeamInviteLinkNotFoundError();
    }
    team.joinWithToken(userId, token);
    const saved = await this.teams.persist(team);
    return { team: await toPublicTeam(this.profiles, saved, userId) };
  }
}

export class UpdateMemberRole {
  constructor(
    private readonly teams: TeamRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    teamId: string;
    memberUserId: string;
    role: unknown;
  }): Promise<{ team: PublicTeam }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const team = await loadTeam(this.teams, input.teamId);
    team.updateMemberRole(
      userId,
      requiredTrimmed(input.memberUserId, "userId"),
      TeamMemberRole.from(input.role),
    );
    const saved = await this.teams.persist(team);
    return { team: await toPublicTeam(this.profiles, saved, userId) };
  }
}

export class RemoveMember {
  constructor(
    private readonly teams: TeamRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    teamId: string;
    memberUserId: string;
  }): Promise<{ team: PublicTeam }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const team = await loadTeam(this.teams, input.teamId);
    team.removeMember(userId, input.memberUserId);
    const saved = await this.teams.persist(team);
    return { team: await toPublicTeam(this.profiles, saved, userId) };
  }
}

export class LeaveTeam {
  constructor(private readonly teams: TeamRepository) {}

  async execute(input: {
    userId: string;
    teamId: string;
  }): Promise<{ ok: true }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const team = await loadTeam(this.teams, input.teamId);
    team.leave(userId);
    await this.teams.persist(team);
    return { ok: true as const };
  }
}

export class SearchTeams {
  constructor(
    private readonly teams: TeamRepository,
    private readonly friendships: FriendshipRepository,
  ) {}

  async execute(input: {
    userId: string;
    sport: unknown;
    query?: unknown;
  }): Promise<{ teams: PublicTeamSearchHit[] }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const sport = TeamSport.from(input.sport);
    const query =
      typeof input.query === "string" ? input.query.trim() : "";

    const mine = (await this.teams.listForUser(userId)).filter((team) =>
      team.isActiveMember(userId),
    );
    const excludeIds = mine.map((team) => team.id);

    const friendships = await this.friendships.listForUser(userId);
    const friendIds = friendships
      .filter((row) => row.status === "accepted")
      .map((row) =>
        row.requesterId === userId ? row.addresseeId : row.requesterId,
      );

    const friendTeams = await this.teams.listActiveForUsers(
      friendIds,
      sport.value,
    );
    const named =
      query.length > 0
        ? await this.teams.search({
            sport: sport.value,
            query,
            excludeTeamIds: excludeIds,
            limit: 20,
          })
        : [];

    const seen = new Set<string>();
    const teams: PublicTeamSearchHit[] = [];
    for (const team of friendTeams) {
      if (excludeIds.includes(team.id) || seen.has(team.id)) continue;
      seen.add(team.id);
      teams.push({
        id: team.id,
        name: team.name.value,
        sport: team.sport.value,
        homeVenueCmsId: team.homeVenueCmsId?.value ?? null,
        memberCount: team.memberCount,
        source: "friend",
      });
    }
    for (const team of named) {
      if (seen.has(team.id)) continue;
      seen.add(team.id);
      teams.push({
        id: team.id,
        name: team.name.value,
        sport: team.sport.value,
        homeVenueCmsId: team.homeVenueCmsId?.value ?? null,
        memberCount: team.memberCount,
        source: "name",
      });
    }
    return { teams };
  }
}

export class TransferOwnership {
  constructor(
    private readonly teams: TeamRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    teamId: string;
    newOwnerUserId: unknown;
  }): Promise<{ team: PublicTeam }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const team = await loadTeam(this.teams, input.teamId);
    team.transferOwnership(userId, String(input.newOwnerUserId ?? ""));
    const saved = await this.teams.persist(team);
    return { team: await toPublicTeam(this.profiles, saved, userId) };
  }
}

export { TeamForbiddenError } from "../entities/team-forbidden-error";
export { TeamInviteLinkNotFoundError } from "../entities/team-invite-link-not-found-error";
export { TeamMembershipNotFoundError } from "../entities/team-membership-not-found-error";
export { TeamNotFoundError } from "../entities/team-not-found-error";
export { TeamNotFriendError } from "../entities/team-not-friend-error";
export { TeamOwnerLeaveError } from "../entities/team-owner-leave-error";
export { TEAM_SPORTS } from "../entities/team-sport";
