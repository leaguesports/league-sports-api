import { DomainError } from "../../../lib/domain-error";

export type CommunityMemberRoleValue = "owner" | "member";

export class CommunityMemberRole {
  static readonly OWNER = new CommunityMemberRole("owner");
  static readonly MEMBER = new CommunityMemberRole("member");

  private constructor(readonly value: CommunityMemberRoleValue) {}

  static from(raw: unknown): CommunityMemberRole {
    if (raw === "owner") return CommunityMemberRole.OWNER;
    if (raw === "member") return CommunityMemberRole.MEMBER;
    throw new DomainError("role must be owner or member");
  }

  get isOwner(): boolean {
    return this.value === "owner";
  }

  equals(other: CommunityMemberRole): boolean {
    return this.value === other.value;
  }
}
