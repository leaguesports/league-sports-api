import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { OptionalStartsAt } from "../../team-matches/entities/optional-starts-at";
import { OptionalVenueCmsId } from "../../team-matches/entities/optional-venue-cms-id";
import { TeamSport } from "../../teams/entities/team-sport";
import {
  buildSingleElimSlots,
  fisherYatesShuffle,
} from "./bracket";
import { TournamentAlreadyActiveError } from "./tournament-already-active-error";
import { TournamentForbiddenError } from "./tournament-forbidden-error";
import { TournamentFullError } from "./tournament-full-error";
import { TournamentInviteToken } from "./tournament-invite-token";
import { TournamentName } from "./tournament-name";
import { TournamentNotReadyError } from "./tournament-not-ready-error";
import { TournamentRegistration } from "./tournament-registration";
import { TournamentRegistrationNotFoundError } from "./tournament-registration-not-found-error";
import { TournamentRegistrationStatus } from "./tournament-registration-status";
import { TournamentSize } from "./tournament-size";
import { TournamentSlot } from "./tournament-slot";
import { TournamentSlotNotFoundError } from "./tournament-slot-not-found-error";
import { TournamentStatus } from "./tournament-status";

export type TournamentSnapshot = {
  id: string;
  name: string;
  sport: "padel" | "golf" | "darts";
  size: 4 | 8 | 16;
  status: "draft" | "registration" | "active" | "completed";
  venueCmsId: string | null;
  startsAt: string | null;
  organizerUserId: string;
  winnerTeamId: string | null;
  inviteToken: string;
  createdAt: string;
  updatedAt: string;
  registrations: ReturnType<TournamentRegistration["toSnapshot"]>[];
  slots: ReturnType<TournamentSlot["toSnapshot"]>[];
};

export type CreateTournamentProps = {
  name: TournamentName;
  sport: TeamSport;
  size: TournamentSize;
  organizerUserId: string;
  venueCmsId?: OptionalVenueCmsId;
  startsAt?: OptionalStartsAt;
};

export type UpdateTournamentDetailsProps = {
  name?: TournamentName;
  sport?: TeamSport;
  size?: TournamentSize;
  venueCmsId?: OptionalVenueCmsId;
  startsAt?: OptionalStartsAt;
};

export class Tournament {
  private constructor(
    readonly id: string,
    private nameValue: TournamentName,
    private sportValue: TeamSport,
    private sizeValue: TournamentSize,
    private statusValue: TournamentStatus,
    private venueCmsIdValue: OptionalVenueCmsId,
    private startsAtValue: OptionalStartsAt,
    readonly organizerUserId: string,
    private winnerTeamIdValue: string | null,
    readonly inviteToken: TournamentInviteToken,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private registrationsValue: TournamentRegistration[],
    private slotsValue: TournamentSlot[],
  ) {}

  static create(props: CreateTournamentProps): Tournament {
    const organizerUserId = requiredTrimmed(props.organizerUserId, "userId");
    const now = new Date();
    return new Tournament(
      randomUUID(),
      props.name,
      props.sport,
      props.size,
      TournamentStatus.DRAFT,
      props.venueCmsId ?? OptionalVenueCmsId.from(null),
      props.startsAt ?? OptionalStartsAt.from(null),
      organizerUserId,
      null,
      TournamentInviteToken.generate(),
      now,
      now,
      [],
      [],
    );
  }

  static rehydrate(props: {
    id: string;
    name: TournamentName;
    sport: TeamSport;
    size: TournamentSize;
    status: TournamentStatus;
    venueCmsId: OptionalVenueCmsId;
    startsAt: OptionalStartsAt;
    organizerUserId: string;
    winnerTeamId: string | null;
    inviteToken: TournamentInviteToken;
    createdAt: Date;
    updatedAt: Date;
    registrations: TournamentRegistration[];
    slots: TournamentSlot[];
  }): Tournament {
    return new Tournament(
      props.id,
      props.name,
      props.sport,
      props.size,
      props.status,
      props.venueCmsId,
      props.startsAt,
      props.organizerUserId,
      props.winnerTeamId,
      props.inviteToken,
      props.createdAt,
      props.updatedAt,
      [...props.registrations],
      [...props.slots],
    );
  }

  static fromSnapshot(snapshot: TournamentSnapshot): Tournament {
    return Tournament.rehydrate({
      id: snapshot.id,
      name: TournamentName.from(snapshot.name),
      sport: TeamSport.from(snapshot.sport),
      size: TournamentSize.from(snapshot.size),
      status: TournamentStatus.from(snapshot.status),
      venueCmsId: OptionalVenueCmsId.from(snapshot.venueCmsId),
      startsAt: OptionalStartsAt.from(snapshot.startsAt),
      organizerUserId: snapshot.organizerUserId,
      winnerTeamId: snapshot.winnerTeamId,
      inviteToken: TournamentInviteToken.from(snapshot.inviteToken),
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
      registrations: snapshot.registrations.map((row) =>
        TournamentRegistration.fromSnapshot(row),
      ),
      slots: snapshot.slots.map((row) => TournamentSlot.fromSnapshot(row)),
    });
  }

  get name(): TournamentName {
    return this.nameValue;
  }

  get sport(): TeamSport {
    return this.sportValue;
  }

  get size(): TournamentSize {
    return this.sizeValue;
  }

  get status(): TournamentStatus {
    return this.statusValue;
  }

  get venueCmsId(): string | null {
    return this.venueCmsIdValue.value;
  }

  get startsAt(): Date | null {
    return this.startsAtValue.value;
  }

  get winnerTeamId(): string | null {
    return this.winnerTeamIdValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get registrations(): readonly TournamentRegistration[] {
    return this.registrationsValue;
  }

  get slots(): readonly TournamentSlot[] {
    return this.slotsValue;
  }

  get acceptedCount(): number {
    return this.acceptedRegistrations().length;
  }

  get hasDraw(): boolean {
    return this.slotsValue.length > 0;
  }

  isOrganizer(userId: string): boolean {
    return this.organizerUserId === userId.trim();
  }

  registrationOf(teamId: string): TournamentRegistration | null {
    const id = teamId.trim();
    return (
      this.registrationsValue.find((entry) => entry.teamId === id) ?? null
    );
  }

  slotById(slotId: string): TournamentSlot | null {
    return this.slotsValue.find((slot) => slot.id === slotId) ?? null;
  }

  slotByTeamMatchId(teamMatchId: string): TournamentSlot | null {
    return (
      this.slotsValue.find((slot) => slot.teamMatchId === teamMatchId) ?? null
    );
  }

  enteredTeamIds(): string[] {
    return this.registrationsValue
      .filter((entry) => !entry.status.isWithdrawn)
      .map((entry) => entry.teamId);
  }

  assertOrganizer(userId: string): void {
    if (!this.isOrganizer(userId)) {
      throw new TournamentForbiddenError(
        "Only the tournament organizer can do that",
      );
    }
  }

  assertCanDelete(userId: string): void {
    this.assertOrganizer(userId);
    if (!this.statusValue.isDraft) {
      throw new DomainError("Only a draft tournament can be deleted");
    }
  }

  updateDetails(actorId: string, details: UpdateTournamentDetailsProps): void {
    this.assertOrganizer(actorId);
    if (!this.statusValue.isDraft) {
      throw new DomainError("Only a draft tournament can be edited");
    }
    if (
      details.name == null &&
      details.sport == null &&
      details.size == null &&
      !("venueCmsId" in details) &&
      !("startsAt" in details)
    ) {
      throw new DomainError("At least one field is required");
    }

    if (details.name) this.nameValue = details.name;
    if (details.sport) this.sportValue = details.sport;
    if (details.size) this.sizeValue = details.size;
    if ("venueCmsId" in details) {
      this.venueCmsIdValue = details.venueCmsId ?? OptionalVenueCmsId.from(null);
    }
    if ("startsAt" in details) {
      this.startsAtValue = details.startsAt ?? OptionalStartsAt.from(null);
    }
    this.touch();
  }

  openRegistration(actorId: string): void {
    this.assertOrganizer(actorId);
    if (this.statusValue.isRegistration) return;
    if (!this.statusValue.isDraft) {
      throw new DomainError("Registration can only be opened from draft");
    }
    this.statusValue = TournamentStatus.REGISTRATION;
    this.touch();
  }

  inviteTeam(actorId: string, teamId: string, now = new Date()): TournamentRegistration {
    this.assertOrganizer(actorId);
    this.assertOpenForRegistration();
    const id = requiredTrimmed(teamId, "teamId");
    const existing = this.registrationOf(id);
    if (existing) {
      if (existing.status.isAccepted || existing.status.isPending) {
        return existing;
      }
      this.assertRoomForAccepted();
      existing.markPending(now);
      this.touch(now);
      return existing;
    }
    this.assertRoomForAccepted();
    const created = TournamentRegistration.create(
      id,
      actorId,
      TournamentRegistrationStatus.PENDING,
      now,
    );
    this.registrationsValue = [...this.registrationsValue, created];
    this.touch(now);
    return created;
  }

  registerAccepted(
    teamId: string,
    registeredBy: string,
    now = new Date(),
  ): TournamentRegistration {
    this.assertOpenForRegistration();
    const id = requiredTrimmed(teamId, "teamId");
    const existing = this.registrationOf(id);
    if (existing) {
      if (existing.status.isAccepted) return existing;
      this.assertRoomForAccepted();
      existing.accept(now);
      this.touch(now);
      return existing;
    }
    this.assertRoomForAccepted();
    const created = TournamentRegistration.create(
      id,
      registeredBy,
      TournamentRegistrationStatus.ACCEPTED,
      now,
    );
    this.registrationsValue = [...this.registrationsValue, created];
    this.touch(now);
    return created;
  }

  acceptRegistration(teamId: string, now = new Date()): TournamentRegistration {
    this.assertOpenForRegistration();
    const entry = this.requireRegistration(teamId);
    if (entry.status.isAccepted) return entry;
    if (!entry.status.isPending) {
      throw new DomainError("Only a pending entry can be accepted");
    }
    this.assertRoomForAccepted();
    entry.accept(now);
    this.touch(now);
    return entry;
  }

  withdrawRegistration(teamId: string, now = new Date()): TournamentRegistration {
    this.assertOpenForRegistration();
    const entry = this.requireRegistration(teamId);
    if (entry.status.isWithdrawn) return entry;
    entry.withdraw(now);
    this.touch(now);
    return entry;
  }

  generateDraw(
    actorId: string,
    shuffle: <T>(items: T[]) => T[] = fisherYatesShuffle,
  ): void {
    this.assertOrganizer(actorId);
    if (this.hasDraw && this.statusValue.isActive) {
      return;
    }
    if (this.hasDraw) {
      throw new TournamentAlreadyActiveError();
    }
    if (!this.statusValue.isRegistration) {
      throw new TournamentNotReadyError(
        "Open registration and fill the field before generating a draw",
      );
    }
    const accepted = this.acceptedRegistrations();
    if (accepted.length !== this.sizeValue.value) {
      throw new TournamentNotReadyError(
        `Cannot generate draw until ${this.sizeValue.value} teams are accepted`,
      );
    }

    const shuffled = shuffle(accepted);
    const seeded = shuffled.map((entry, index) => {
      const seed = index + 1;
      entry.assignSeed(seed);
      return { teamId: entry.teamId, seed };
    });
    this.slotsValue = buildSingleElimSlots(this.sizeValue, seeded);
    this.statusValue = TournamentStatus.ACTIVE;
    this.touch();
  }

  start(actorId: string): void {
    this.assertOrganizer(actorId);
    if (this.statusValue.isActive) return;
    if (this.statusValue.isCompleted) {
      throw new DomainError("Tournament is already completed");
    }
    if (!this.hasDraw) {
      throw new TournamentNotReadyError(
        "Generate the draw before starting the tournament",
      );
    }
    this.statusValue = TournamentStatus.ACTIVE;
    this.touch();
  }

  attachFixture(slotId: string, teamMatchId: string): TournamentSlot {
    if (!this.statusValue.isActive) {
      throw new TournamentNotReadyError(
        "Fixtures can only be started after the tournament is active",
      );
    }
    const slot = this.requireSlot(slotId);
    if (!slot.isReady) {
      throw new TournamentNotReadyError(
        "Both teams must be set before starting this fixture",
      );
    }
    slot.attachMatch(teamMatchId);
    this.touch();
    return slot;
  }

  advanceFromMatch(teamMatchId: string, winnerTeamId: string): void {
    if (!this.statusValue.isActive && !this.statusValue.isCompleted) {
      throw new DomainError("Tournament is not active");
    }
    const slot = this.slotByTeamMatchId(teamMatchId);
    if (!slot) {
      throw new TournamentSlotNotFoundError();
    }
    if (!winnerTeamId) {
      throw new DomainError("Bracket advancement requires a match winner");
    }
    slot.setWinner(winnerTeamId);

    if (slot.isFinal) {
      this.winnerTeamIdValue = winnerTeamId;
      this.statusValue = TournamentStatus.COMPLETED;
      this.touch();
      return;
    }

    if (!slot.nextSlotId || !slot.nextSide) {
      throw new DomainError("Non-final fixture is missing its next slot");
    }
    const next = this.requireSlot(slot.nextSlotId);
    next.placeSide(slot.nextSide, winnerTeamId);
    this.touch();
  }

  toSnapshot(): TournamentSnapshot {
    return {
      id: this.id,
      name: this.nameValue.value,
      sport: this.sportValue.value,
      size: this.sizeValue.value,
      status: this.statusValue.value,
      venueCmsId: this.venueCmsIdValue.value,
      startsAt: this.startsAtValue.toIsoString(),
      organizerUserId: this.organizerUserId,
      winnerTeamId: this.winnerTeamIdValue,
      inviteToken: this.inviteToken.value,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAtValue.toISOString(),
      registrations: this.registrationsValue.map((entry) => entry.toSnapshot()),
      slots: this.slotsValue.map((slot) => slot.toSnapshot()),
    };
  }

  private acceptedRegistrations(): TournamentRegistration[] {
    return this.registrationsValue.filter((entry) => entry.status.isAccepted);
  }

  private requireRegistration(teamId: string): TournamentRegistration {
    const entry = this.registrationOf(teamId);
    if (!entry) throw new TournamentRegistrationNotFoundError();
    return entry;
  }

  private requireSlot(slotId: string): TournamentSlot {
    const slot = this.slotById(slotId);
    if (!slot) throw new TournamentSlotNotFoundError();
    return slot;
  }

  private assertOpenForRegistration(): void {
    if (!this.statusValue.isOpenForRegistration) {
      throw new DomainError("Registration is not open");
    }
    if (this.hasDraw) {
      throw new DomainError("Cannot change entries after the draw");
    }
  }

  private assertRoomForAccepted(): void {
    if (this.acceptedCount >= this.sizeValue.value) {
      throw new TournamentFullError();
    }
  }

  private touch(now = new Date()): void {
    this.updatedAtValue = now;
  }
}
