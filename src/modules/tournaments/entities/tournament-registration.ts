import { randomUUID } from "node:crypto";

import { requiredTrimmed } from "../../../lib/domain-error";
import { TournamentRegistrationStatus } from "./tournament-registration-status";

export type TournamentRegistrationSnapshot = {
  id: string;
  teamId: string;
  status: "pending" | "accepted" | "withdrawn";
  seed: number | null;
  registeredBy: string;
  createdAt: string;
  updatedAt: string;
};

export class TournamentRegistration {
  private constructor(
    readonly id: string,
    readonly teamId: string,
    private statusValue: TournamentRegistrationStatus,
    private seedValue: number | null,
    readonly registeredBy: string,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(
    teamId: string,
    registeredBy: string,
    status: TournamentRegistrationStatus,
    now = new Date(),
  ): TournamentRegistration {
    return new TournamentRegistration(
      randomUUID(),
      requiredTrimmed(teamId, "teamId"),
      status,
      null,
      requiredTrimmed(registeredBy, "userId"),
      now,
      now,
    );
  }

  static rehydrate(props: {
    id: string;
    teamId: string;
    status: TournamentRegistrationStatus;
    seed: number | null;
    registeredBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): TournamentRegistration {
    return new TournamentRegistration(
      props.id,
      props.teamId,
      props.status,
      props.seed,
      props.registeredBy,
      props.createdAt,
      props.updatedAt,
    );
  }

  static fromSnapshot(
    snapshot: TournamentRegistrationSnapshot,
  ): TournamentRegistration {
    return TournamentRegistration.rehydrate({
      id: snapshot.id,
      teamId: snapshot.teamId,
      status: TournamentRegistrationStatus.from(snapshot.status),
      seed: snapshot.seed,
      registeredBy: snapshot.registeredBy,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    });
  }

  get status(): TournamentRegistrationStatus {
    return this.statusValue;
  }

  get seed(): number | null {
    return this.seedValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  accept(now = new Date()): void {
    this.statusValue = TournamentRegistrationStatus.ACCEPTED;
    this.touch(now);
  }

  withdraw(now = new Date()): void {
    this.statusValue = TournamentRegistrationStatus.WITHDRAWN;
    this.seedValue = null;
    this.touch(now);
  }

  markPending(now = new Date()): void {
    this.statusValue = TournamentRegistrationStatus.PENDING;
    this.seedValue = null;
    this.touch(now);
  }

  assignSeed(seed: number, now = new Date()): void {
    this.seedValue = seed;
    this.touch(now);
  }

  toSnapshot(): TournamentRegistrationSnapshot {
    return {
      id: this.id,
      teamId: this.teamId,
      status: this.statusValue.value,
      seed: this.seedValue,
      registeredBy: this.registeredBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAtValue.toISOString(),
    };
  }

  private touch(now = new Date()): void {
    this.updatedAtValue = now;
  }
}
