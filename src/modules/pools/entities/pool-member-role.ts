import { DomainError } from "../../../lib/domain-error";

export type PoolMemberRoleValue = "owner" | "member";

export class PoolMemberRole {
  static readonly OWNER = new PoolMemberRole("owner");
  static readonly MEMBER = new PoolMemberRole("member");

  private constructor(readonly value: PoolMemberRoleValue) {}

  static from(raw: unknown): PoolMemberRole {
    if (raw === "owner") return PoolMemberRole.OWNER;
    if (raw === "member") return PoolMemberRole.MEMBER;
    throw new DomainError("role must be owner or member");
  }

  get isOwner(): boolean {
    return this.value === "owner";
  }
}
