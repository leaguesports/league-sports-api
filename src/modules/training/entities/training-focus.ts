import { DomainError } from "../../../lib/domain-error";

export const TRAINING_FOCUSES = [
  "accuracy",
  "consistency",
  "intensity",
] as const;
export type TrainingFocusValue = (typeof TRAINING_FOCUSES)[number];

export class TrainingFocus {
  static readonly ACCURACY = new TrainingFocus("accuracy");
  static readonly CONSISTENCY = new TrainingFocus("consistency");
  static readonly INTENSITY = new TrainingFocus("intensity");

  private constructor(readonly value: TrainingFocusValue) {}

  static from(raw: unknown): TrainingFocus | null {
    if (raw == null) return null;
    if (typeof raw !== "string") {
      throw new DomainError("focus must be accuracy, consistency, or intensity");
    }

    const focus = raw.trim().toLowerCase();
    if (focus.length === 0) return null;
    if (focus === "accuracy") return TrainingFocus.ACCURACY;
    if (focus === "consistency") return TrainingFocus.CONSISTENCY;
    if (focus === "intensity") return TrainingFocus.INTENSITY;

    throw new DomainError("focus must be accuracy, consistency, or intensity");
  }

  equals(other: TrainingFocus): boolean {
    return this.value === other.value;
  }
}
