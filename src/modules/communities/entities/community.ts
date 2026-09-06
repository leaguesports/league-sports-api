import { randomUUID } from "node:crypto";

import { requiredTrimmed } from "../../../lib/domain-error";
import { City } from "./city";
import { CommunityMemberRole } from "./community-member-role";
import { CommunityMembership } from "./community-membership";
import { CommunityMembershipNotFoundError } from "./community-membership-not-found-error";
import { CommunityName } from "./community-name";
import { CommunitySport } from "./community-sport";
import { SoleOwnerLeaveError } from "./sole-owner-leave-error";

export type CommunitySnapshot = {
  id: string;
  name: string;
  city: string;
  sport: "padel" | "multi" | null;
  createdAt: string;
  updatedAt: string;
  members: Array<{
    id: string;
    userId: string;
    role: "owner" | "member";
    joinedAt: string;
  }>;
};

export type CreateCommunityProps = {
  name: CommunityName;
  city: City;
  sport: CommunitySport | null;
  ownerUserId: string;
};

let lastCreatedAtMs = 0;

function nextCreatedAt(): Date {
  const now = Date.now();
  lastCreatedAtMs = now <= lastCreatedAtMs ? lastCreatedAtMs + 1 : now;
  return new Date(lastCreatedAtMs);
}

export class Community {
  private constructor(
    readonly id: string,
    readonly name: CommunityName,
    readonly city: City,
    readonly sport: CommunitySport | null,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private membersValue: CommunityMembership[],
    private removedUserIdsValue: string[],
  ) {}

  static create(props: CreateCommunityProps): Community {
    const now = nextCreatedAt();
    const owner = CommunityMembership.owner(props.ownerUserId, now);
    return new Community(
      randomUUID(),
      props.name,
      props.city,
      props.sport,
      now,
      now,
      [owner],
      [],
    );
  }

  static rehydrate(props: {
    id: string;
    name: CommunityName;
    city: City;
    sport: CommunitySport | null;
    createdAt: Date;
    updatedAt: Date;
    members: CommunityMembership[];
  }): Community {
    return new Community(
      props.id,
      props.name,
      props.city,
      props.sport,
      props.createdAt,
      props.updatedAt,
      [...props.members],
      [],
    );
  }

  static fromSnapshot(snapshot: CommunitySnapshot): Community {
    return Community.rehydrate({
      id: snapshot.id,
      name: CommunityName.from(snapshot.name),
      city: City.from(snapshot.city),
      sport: CommunitySport.from(snapshot.sport),
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
      members: snapshot.members.map((member) =>
        CommunityMembership.rehydrate({
          id: member.id,
          userId: member.userId,
          role: CommunityMemberRole.from(member.role),
          joinedAt: new Date(member.joinedAt),
        }),
      ),
    });
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get members(): readonly CommunityMembership[] {
    return this.membersValue;
  }

  get memberCount(): number {
    return this.membersValue.length;
  }

  /** User ids removed since this instance was created or rehydrated. */
  get removedUserIds(): readonly string[] {
    return this.removedUserIdsValue;
  }

  membershipOf(userId: string): CommunityMembership | null {
    const id = userId.trim();
    return this.membersValue.find((member) => member.userId === id) ?? null;
  }

  join(userId: string): void {
    const id = requiredTrimmed(userId, "userId");
    this.removedUserIdsValue = this.removedUserIdsValue.filter(
      (removed) => removed !== id,
    );
    if (this.membershipOf(id)) {
      return;
    }
    this.membersValue = [...this.membersValue, CommunityMembership.member(id)];
    this.updatedAtValue = new Date();
  }

  leave(userId: string): void {
    const id = requiredTrimmed(userId, "userId");
    const membership = this.membershipOf(id);
    if (!membership) {
      throw new CommunityMembershipNotFoundError();
    }

    const ownerCount = this.membersValue.filter((member) => member.role.isOwner)
      .length;
    if (membership.role.isOwner && ownerCount <= 1) {
      throw new SoleOwnerLeaveError();
    }

    this.membersValue = this.membersValue.filter(
      (member) => member.userId !== id,
    );
    if (!this.removedUserIdsValue.includes(id)) {
      this.removedUserIdsValue = [...this.removedUserIdsValue, id];
    }
    this.updatedAtValue = new Date();
  }

  toSnapshot(): CommunitySnapshot {
    const members = [...this.membersValue].sort((a, b) => {
      if (a.role.value !== b.role.value) {
        return a.role.isOwner ? -1 : 1;
      }
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

    return {
      id: this.id,
      name: this.name.value,
      city: this.city.value,
      sport: this.sport?.value ?? null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAtValue.toISOString(),
      members: members.map((member) => member.toSnapshot()),
    };
  }
}
