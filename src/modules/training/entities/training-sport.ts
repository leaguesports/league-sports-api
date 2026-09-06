import { DomainError } from "../../../lib/domain-error";

export const TRAINING_SPORTS = ["padel"] as const;
export type TrainingSportValue = (typeof TRAINING_SPORTS)[number];

export class TrainingSport {
  static readonly PADEL = new TrainingSport("padel");

  private constructor(readonly value: TrainingSportValue) {}

  static from(raw: unknown): TrainingSport {
    if (typeof raw !== "string") {
      throw new DomainError("sport must be padel");
    }

    const sport = raw.trim().toLowerCase();
    if (sport === "padel") return TrainingSport.PADEL;

    throw new DomainError("sport must be padel");
  }

  equals(other: TrainingSport): boolean {
    return this.value === other.value;
  }
}
