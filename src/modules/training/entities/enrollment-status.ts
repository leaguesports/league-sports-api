import { DomainError } from "../../../lib/domain-error";

export type EnrollmentStatusValue = "active" | "completed";

export class EnrollmentStatus {
  static readonly ACTIVE = new EnrollmentStatus("active");
  static readonly COMPLETED = new EnrollmentStatus("completed");

  private constructor(readonly value: EnrollmentStatusValue) {}

  static from(raw: unknown): EnrollmentStatus {
    if (raw === "active") return EnrollmentStatus.ACTIVE;
    if (raw === "completed") return EnrollmentStatus.COMPLETED;
    throw new DomainError("status must be active or completed");
  }

  get isActive(): boolean {
    return this.value === "active";
  }

  get isCompleted(): boolean {
    return this.value === "completed";
  }

  equals(other: EnrollmentStatus): boolean {
    return this.value === other.value;
  }
}
