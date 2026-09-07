import { DomainError } from "../../../lib/domain-error";

export type TeamMemberStatusValue = "active" | "invited";

export class TeamMemberStatus {
  static readonly ACTIVE = new TeamMemberStatus("active");
  static readonly INVITED = new TeamMemberStatus("invited");

  private constructor(readonly value: TeamMemberStatusValue) {}

  static from(raw: unknown): TeamMemberStatus {
    if (raw === "active") return TeamMemberStatus.ACTIVE;
    if (raw === "invited") return TeamMemberStatus.INVITED;
    throw new DomainError("status must be active or invited");
  }

  get isActive(): boolean {
    return this.value === "active";
  }

  get isInvited(): boolean {
    return this.value === "invited";
  }

  equals(other: TeamMemberStatus): boolean {
    return this.value === other.value;
  }
}
