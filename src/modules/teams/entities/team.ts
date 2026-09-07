import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { HomeVenueCmsId } from "./home-venue-cms-id";
import { TeamForbiddenError } from "./team-forbidden-error";
import { TeamInviteLink } from "./team-invite-link";
import { TeamInviteLinkNotFoundError } from "./team-invite-link-not-found-error";
import { TeamInviteToken } from "./team-invite-token";
import { TeamMemberRole } from "./team-member-role";
import { TeamMemberStatus } from "./team-member-status";
import { TeamMembership } from "./team-membership";
import { TeamMembershipNotFoundError } from "./team-membership-not-found-error";
import { TeamName } from "./team-name";
import { TeamOwnerLeaveError } from "./team-owner-leave-error";
import { TeamSport } from "./team-sport";

export type TeamSnapshot = {
  id: string;
  name: string;
  sport: "padel" | "golf" | "darts";
  homeVenueCmsId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  members: ReturnType<TeamMembership["toSnapshot"]>[];
  inviteLinks: ReturnType<TeamInviteLink["toSnapshot"]>[];
};

export type CreateTeamProps = {
  name: TeamName;
  sport: TeamSport;
  createdBy: string;
  homeVenueCmsId?: HomeVenueCmsId | null;
};

export type UpdateTeamDetailsProps = {
  name?: TeamName;
  sport?: TeamSport;
  homeVenueCmsId?: HomeVenueCmsId | null;
};

const ROLE_RANK: Record<TeamMemberRole["value"], number> = {
  owner: 0,
  captain: 1,
  member: 2,
};

export class Team {
  private constructor(
    readonly id: string,
    private nameValue: TeamName,
    private sportValue: TeamSport,
    private homeVenueCmsIdValue: HomeVenueCmsId | null,
    readonly createdBy: string,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private membersValue: TeamMembership[],
    private inviteLinksValue: TeamInviteLink[],
    private removedUserIdsValue: string[],
  ) {}

  static create(props: CreateTeamProps): Team {
    const createdBy = requiredTrimmed(props.createdBy, "userId");
    const now = new Date();
    return new Team(
      randomUUID(),
      props.name,
      props.sport,
      props.homeVenueCmsId ?? null,
      createdBy,
      now,
      now,
      [TeamMembership.owner(createdBy, now)],
      [],
      [],
    );
  }

  static rehydrate(props: {
    id: string;
    name: TeamName;
    sport: TeamSport;
    homeVenueCmsId: HomeVenueCmsId | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    members: TeamMembership[];
    inviteLinks: TeamInviteLink[];
  }): Team {
    const team = new Team(
      props.id,
      props.name,
      props.sport,
      props.homeVenueCmsId,
      props.createdBy,
      props.createdAt,
      props.updatedAt,
      [...props.members],
      [...props.inviteLinks],
      [],
    );
    team.assertExactlyOneOwner();
    return team;
  }

  static fromSnapshot(snapshot: TeamSnapshot): Team {
    return Team.rehydrate({
      id: snapshot.id,
      name: TeamName.from(snapshot.name),
      sport: TeamSport.from(snapshot.sport),
      homeVenueCmsId: HomeVenueCmsId.from(snapshot.homeVenueCmsId),
      createdBy: snapshot.createdBy,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
      members: snapshot.members.map((member) =>
        TeamMembership.rehydrate({
          id: member.id,
          userId: member.userId,
          role: TeamMemberRole.from(member.role),
          status: TeamMemberStatus.from(member.status),
          joinedAt: new Date(member.joinedAt),
        }),
      ),
      inviteLinks: snapshot.inviteLinks.map((link) =>
        TeamInviteLink.rehydrate({
          id: link.id,
          token: TeamInviteToken.from(link.token),
          createdBy: link.createdBy,
          createdAt: new Date(link.createdAt),
          revokedAt: link.revokedAt ? new Date(link.revokedAt) : null,
        }),
      ),
    });
  }

  get name(): TeamName {
    return this.nameValue;
  }

  get sport(): TeamSport {
    return this.sportValue;
  }

  get homeVenueCmsId(): HomeVenueCmsId | null {
    return this.homeVenueCmsIdValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get members(): readonly TeamMembership[] {
    return this.membersValue;
  }

  get inviteLinks(): readonly TeamInviteLink[] {
    return this.inviteLinksValue;
  }

  get memberCount(): number {
    return this.membersValue.filter((member) => member.status.isActive).length;
  }

  /** User ids removed since this instance was created or rehydrated. */
  get removedUserIds(): readonly string[] {
    return this.removedUserIdsValue;
  }

  membershipOf(userId: string): TeamMembership | null {
    const id = userId.trim();
    return this.membersValue.find((member) => member.userId === id) ?? null;
  }

  isMember(userId: string): boolean {
    return this.membershipOf(userId) != null;
  }

  isActiveMember(userId: string): boolean {
    return this.membershipOf(userId)?.status.isActive === true;
  }

  owner(): TeamMembership {
    const owner = this.membersValue.find((member) => member.role.isOwner);
    if (!owner) {
      throw new DomainError("Team is missing an owner");
    }
    return owner;
  }

  activeInviteLink(): TeamInviteLink | null {
    return (
      [...this.inviteLinksValue]
        .filter((link) => link.isActive)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ??
      null
    );
  }

  assertCanView(userId: string): void {
    if (!this.isMember(userId)) {
      throw new TeamForbiddenError("Only a team member can view this team");
    }
  }

  assertOwner(userId: string): TeamMembership {
    const membership = this.membershipOf(userId);
    if (!membership?.role.isOwner || !membership.status.isActive) {
      throw new TeamForbiddenError("Only the team owner can do that");
    }
    return membership;
  }

  updateDetails(actorId: string, details: UpdateTeamDetailsProps): void {
    this.assertOwner(actorId);
    if (
      details.name == null &&
      details.sport == null &&
      !("homeVenueCmsId" in details)
    ) {
      throw new DomainError("At least one field is required");
    }

    if (details.name) this.nameValue = details.name;
    if (details.sport) this.sportValue = details.sport;
    if ("homeVenueCmsId" in details) {
      this.homeVenueCmsIdValue = details.homeVenueCmsId ?? null;
    }
    this.touch();
  }

  /**
   * Direct-add an accepted friend as an active member.
   * Friendship is verified by the application service before this call.
   */
  inviteFriend(actorId: string, userId: string, now = new Date()): void {
    const actor = this.requireActiveStaff(actorId);
    const id = requiredTrimmed(userId, "userId");
    if (id === actor.userId) {
      throw new DomainError("Cannot invite yourself");
    }

    const existing = this.membershipOf(id);
    if (existing) {
      if (existing.status.isInvited) existing.activate();
      this.touch(now);
      return;
    }

    this.removedUserIdsValue = this.removedUserIdsValue.filter(
      (removed) => removed !== id,
    );
    this.membersValue = [
      ...this.membersValue,
      TeamMembership.member(id, TeamMemberStatus.ACTIVE, now),
    ];
    this.assertExactlyOneOwner();
    this.touch(now);
  }

  joinAsMember(userId: string, now = new Date()): void {
    const id = requiredTrimmed(userId, "userId");
    const existing = this.membershipOf(id);
    if (existing) {
      if (existing.status.isInvited) existing.activate();
      this.touch(now);
      return;
    }

    this.removedUserIdsValue = this.removedUserIdsValue.filter(
      (removed) => removed !== id,
    );
    this.membersValue = [
      ...this.membersValue,
      TeamMembership.member(id, TeamMemberStatus.ACTIVE, now),
    ];
    this.assertExactlyOneOwner();
    this.touch(now);
  }

  joinWithToken(userId: string, token: TeamInviteToken, now = new Date()): void {
    const link = this.inviteLinksValue.find(
      (item) => item.token.equals(token) && item.isActive,
    );
    if (!link) {
      throw new TeamInviteLinkNotFoundError();
    }
    this.joinAsMember(userId, now);
  }

  regenerateInviteLink(actorId: string, now = new Date()): TeamInviteLink {
    this.requireActiveStaff(actorId);
    for (const link of this.inviteLinksValue) {
      link.revoke(now);
    }
    const created = TeamInviteLink.create(actorId, now);
    this.inviteLinksValue = [...this.inviteLinksValue, created];
    this.touch(now);
    return created;
  }

  updateMemberRole(
    actorId: string,
    userId: string,
    role: TeamMemberRole,
  ): void {
    this.assertOwner(actorId);
    if (role.isOwner) {
      throw new DomainError("Use transfer ownership to appoint a new owner");
    }

    const target = this.requireMembership(userId);
    if (!target.status.isActive) {
      throw new TeamForbiddenError("Only an active member can change role");
    }
    if (target.role.isOwner) {
      throw new TeamOwnerLeaveError();
    }

    target.assignRole(role);
    this.assertExactlyOneOwner();
    this.touch();
  }

  removeMember(actorId: string, userId: string): void {
    const actor = this.requireActiveStaff(actorId);
    const id = requiredTrimmed(userId, "userId");
    if (id === actor.userId) {
      throw new DomainError("Use leave to remove yourself");
    }

    const target = this.requireMembership(id);
    if (target.role.isOwner) {
      throw new TeamForbiddenError("Cannot remove the team owner");
    }
    if (actor.role.isCaptain && !target.role.isMember) {
      throw new TeamForbiddenError("Captain can only remove members");
    }

    this.dropMembership(id);
    this.assertExactlyOneOwner();
    this.touch();
  }

  leave(actorId: string): void {
    const membership = this.requireMembership(actorId);
    if (membership.role.isOwner) {
      throw new TeamOwnerLeaveError();
    }
    this.dropMembership(membership.userId);
    this.assertExactlyOneOwner();
    this.touch();
  }

  transferOwnership(actorId: string, newOwnerUserId: string): void {
    const actor = this.assertOwner(actorId);
    const targetId = requiredTrimmed(newOwnerUserId, "userId");
    if (targetId === actor.userId) {
      throw new DomainError("Already the team owner");
    }

    const target = this.requireMembership(targetId);
    if (!target.status.isActive) {
      throw new TeamForbiddenError("Can only transfer ownership to an active member");
    }

    actor.assignRole(TeamMemberRole.CAPTAIN);
    target.assignRole(TeamMemberRole.OWNER);
    target.activate();
    this.assertExactlyOneOwner();
    this.touch();
  }

  assertCanDelete(actorId: string): void {
    this.assertOwner(actorId);
  }

  toSnapshot(): TeamSnapshot {
    const members = [...this.membersValue].sort((a, b) => {
      const rank = ROLE_RANK[a.role.value] - ROLE_RANK[b.role.value];
      if (rank !== 0) return rank;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

    return {
      id: this.id,
      name: this.nameValue.value,
      sport: this.sportValue.value,
      homeVenueCmsId: this.homeVenueCmsIdValue?.value ?? null,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAtValue.toISOString(),
      members: members.map((member) => member.toSnapshot()),
      inviteLinks: this.inviteLinksValue.map((link) => link.toSnapshot()),
    };
  }

  private requireMembership(userId: string): TeamMembership {
    const membership = this.membershipOf(userId);
    if (!membership) {
      throw new TeamMembershipNotFoundError();
    }
    return membership;
  }

  private requireActiveStaff(userId: string): TeamMembership {
    const membership = this.membershipOf(userId);
    if (!membership?.status.isActive || !membership.role.canInvite) {
      throw new TeamForbiddenError("Only an owner or captain can do that");
    }
    return membership;
  }

  private dropMembership(userId: string): void {
    this.membersValue = this.membersValue.filter(
      (member) => member.userId !== userId,
    );
    if (!this.removedUserIdsValue.includes(userId)) {
      this.removedUserIdsValue = [...this.removedUserIdsValue, userId];
    }
  }

  private assertExactlyOneOwner(): void {
    const owners = this.membersValue.filter((member) => member.role.isOwner);
    if (owners.length !== 1) {
      throw new DomainError("Team must have exactly one owner");
    }
  }

  private touch(now = new Date()): void {
    this.updatedAtValue = now;
  }
}
