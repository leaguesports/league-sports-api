import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import type { GolfPlayer } from "../../golf-round/entities/golf-player";
import { CmsId } from "../../venue/entities/cms-id";
import { GolfTourCamp } from "./golf-tour-camp";
import { GolfTourCampName } from "./golf-tour-camp-name";
import { GolfTourCampNotFoundError } from "./golf-tour-camp-not-found-error";
import { GolfTourForbiddenError } from "./golf-tour-forbidden-error";
import { GolfTourFormat } from "./golf-tour-format";
import { GolfTourFourball } from "./golf-tour-fourball";
import { GolfTourFourballNotFoundError } from "./golf-tour-fourball-not-found-error";
import { GolfTourName } from "./golf-tour-name";
import { GolfTourRound } from "./golf-tour-round";
import { GolfTourRoundNotFoundError } from "./golf-tour-round-not-found-error";
import { GolfTourStatus } from "./golf-tour-status";
import { TourDate } from "./tour-date";

export const DEFAULT_CAMP_NAMES = ["Camp A", "Camp B"] as const;

export type GolfTourSnapshot = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "draft" | "active" | "completed";
  hostUserId: string;
  createdAt: string;
  updatedAt: string;
  camps: ReturnType<GolfTourCamp["toSnapshot"]>[];
  rounds: ReturnType<GolfTourRound["toSnapshot"]>[];
  fourballs: ReturnType<GolfTourFourball["toSnapshot"]>[];
};

export type CreateGolfTourProps = {
  name: GolfTourName;
  startDate: TourDate;
  endDate: TourDate;
  hostUserId: string;
  campNames?: GolfTourCampName[];
};

export type UpdateGolfTourDetailsProps = {
  name?: GolfTourName;
  startDate?: TourDate;
  endDate?: TourDate;
};

export class GolfTour {
  private constructor(
    readonly id: string,
    private nameValue: GolfTourName,
    private startDateValue: TourDate,
    private endDateValue: TourDate,
    private statusValue: GolfTourStatus,
    readonly hostUserId: string,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private campsValue: GolfTourCamp[],
    private roundsValue: GolfTourRound[],
    private fourballsValue: GolfTourFourball[],
  ) {}

  static create(props: CreateGolfTourProps): GolfTour {
    const hostUserId = requiredTrimmed(props.hostUserId, "userId");
    assertDateRange(props.startDate, props.endDate);
    const campNames = props.campNames ?? [
      GolfTourCampName.from(DEFAULT_CAMP_NAMES[0]),
      GolfTourCampName.from(DEFAULT_CAMP_NAMES[1]),
    ];
    if (campNames.length < 2) {
      throw new DomainError("A tour needs at least two camps");
    }
    const now = new Date();
    const camps = campNames.map((name, index) =>
      GolfTourCamp.create({
        id: randomUUID(),
        name,
        sortOrder: index,
      }),
    );
    return new GolfTour(
      randomUUID(),
      props.name,
      props.startDate,
      props.endDate,
      GolfTourStatus.DRAFT,
      hostUserId,
      now,
      now,
      camps,
      [],
      [],
    );
  }

  static rehydrate(props: {
    id: string;
    name: GolfTourName;
    startDate: TourDate;
    endDate: TourDate;
    status: GolfTourStatus;
    hostUserId: string;
    createdAt: Date;
    updatedAt: Date;
    camps: GolfTourCamp[];
    rounds: GolfTourRound[];
    fourballs: GolfTourFourball[];
  }): GolfTour {
    return new GolfTour(
      props.id,
      props.name,
      props.startDate,
      props.endDate,
      props.status,
      props.hostUserId,
      props.createdAt,
      props.updatedAt,
      [...props.camps].sort((a, b) => a.sortOrder - b.sortOrder),
      [...props.rounds],
      [...props.fourballs],
    );
  }

  static fromSnapshot(snapshot: GolfTourSnapshot): GolfTour {
    return GolfTour.rehydrate({
      id: snapshot.id,
      name: GolfTourName.from(snapshot.name),
      startDate: TourDate.from(snapshot.startDate, "startDate"),
      endDate: TourDate.from(snapshot.endDate, "endDate"),
      status: GolfTourStatus.from(snapshot.status),
      hostUserId: snapshot.hostUserId,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
      camps: snapshot.camps.map((camp) => GolfTourCamp.fromSnapshot(camp)),
      rounds: snapshot.rounds.map((round) => GolfTourRound.fromSnapshot(round)),
      fourballs: snapshot.fourballs.map((fourball) =>
        GolfTourFourball.fromSnapshot(fourball),
      ),
    });
  }

  get name(): GolfTourName {
    return this.nameValue;
  }

  get startDate(): TourDate {
    return this.startDateValue;
  }

  get endDate(): TourDate {
    return this.endDateValue;
  }

  get status(): GolfTourStatus {
    return this.statusValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get camps(): readonly GolfTourCamp[] {
    return this.campsValue;
  }

  get rounds(): readonly GolfTourRound[] {
    return this.roundsValue;
  }

  get fourballs(): readonly GolfTourFourball[] {
    return this.fourballsValue;
  }

  isHost(userId: string): boolean {
    return this.hostUserId === userId.trim();
  }

  isPlayer(userId: string): boolean {
    const id = userId.trim();
    return this.fourballsValue.some((fourball) => fourball.hasPlayerUserId(id));
  }

  canRead(userId: string): boolean {
    return this.isHost(userId) || this.isPlayer(userId);
  }

  campById(campId: string): GolfTourCamp | null {
    return this.campsValue.find((camp) => camp.id === campId) ?? null;
  }

  roundById(roundId: string): GolfTourRound | null {
    return this.roundsValue.find((round) => round.id === roundId) ?? null;
  }

  fourballById(fourballId: string): GolfTourFourball | null {
    return (
      this.fourballsValue.find((fourball) => fourball.id === fourballId) ?? null
    );
  }

  fourballByGolfRoundId(golfRoundId: string): GolfTourFourball | null {
    const id = golfRoundId.trim();
    return (
      this.fourballsValue.find((fourball) => fourball.golfRoundId === id) ??
      null
    );
  }

  assertHost(userId: string): void {
    if (!this.isHost(userId)) {
      throw new GolfTourForbiddenError("Only the tour host can do that");
    }
  }

  assertCanStartFourball(userId: string, fourball: GolfTourFourball): void {
    if (this.isHost(userId) || fourball.hasPlayerUserId(userId)) return;
    throw new GolfTourForbiddenError(
      "Only the host or a seated player can start this fourball",
    );
  }

  updateDetails(actorId: string, details: UpdateGolfTourDetailsProps): void {
    this.assertHost(actorId);
    this.assertMutable();
    if (!details.name && !details.startDate && !details.endDate) {
      throw new DomainError("At least one field is required");
    }
    const start = details.startDate ?? this.startDateValue;
    const end = details.endDate ?? this.endDateValue;
    assertDateRange(start, end);
    for (const round of this.roundsValue) {
      if (!round.date.isWithin(start, end)) {
        throw new DomainError(
          "Existing rounds must stay within the tour start and end dates",
        );
      }
    }
    if (details.name) this.nameValue = details.name;
    this.startDateValue = start;
    this.endDateValue = end;
    this.touch();
  }

  addCamp(
    actorId: string,
    props: { name: GolfTourCampName; color?: string | null },
  ): GolfTourCamp {
    this.assertHost(actorId);
    this.assertMutable();
    const sortOrder =
      this.campsValue.reduce((max, camp) => Math.max(max, camp.sortOrder), -1) +
      1;
    const camp = GolfTourCamp.create({
      id: randomUUID(),
      name: props.name,
      color: props.color,
      sortOrder,
    });
    this.campsValue = [...this.campsValue, camp];
    this.touch();
    return camp;
  }

  renameCamp(
    actorId: string,
    campId: string,
    details: { name?: GolfTourCampName; color?: string | null },
  ): GolfTourCamp {
    this.assertHost(actorId);
    this.assertMutable();
    const camp = this.requireCamp(campId);
    if (!details.name && !("color" in details)) {
      throw new DomainError("At least one field is required");
    }
    camp.rename(details);
    this.touch();
    return camp;
  }

  addRound(
    actorId: string,
    props: {
      date: TourDate;
      venueCmsId: CmsId;
      label?: string | null;
      format?: GolfTourFormat;
    },
  ): GolfTourRound {
    this.assertHost(actorId);
    this.assertMutable();
    this.assertRoundDate(props.date);
    const round = GolfTourRound.create({
      id: randomUUID(),
      date: props.date,
      venueCmsId: props.venueCmsId,
      label: props.label,
      format: props.format,
    });
    this.roundsValue = [...this.roundsValue, round];
    this.touch();
    return round;
  }

  updateRound(
    actorId: string,
    roundId: string,
    details: {
      date?: TourDate;
      venueCmsId?: CmsId;
      label?: string | null;
      format?: GolfTourFormat;
    },
  ): GolfTourRound {
    this.assertHost(actorId);
    this.assertMutable();
    const round = this.requireRound(roundId);
    if (
      !details.date &&
      !details.venueCmsId &&
      !("label" in details) &&
      !details.format
    ) {
      throw new DomainError("At least one field is required");
    }
    const nextDate = details.date ?? round.date;
    this.assertRoundDate(nextDate);
    round.update(details);
    this.touch();
    return round;
  }

  addFourball(
    actorId: string,
    props: { roundId: string; campId: string; players?: GolfPlayer[] },
  ): GolfTourFourball {
    this.assertHost(actorId);
    this.assertMutable();
    this.requireRound(props.roundId);
    this.requireCamp(props.campId);
    const fourball = GolfTourFourball.create({
      id: randomUUID(),
      roundId: props.roundId,
      campId: props.campId,
      players: props.players,
    });
    this.fourballsValue = [...this.fourballsValue, fourball];
    this.touch();
    return fourball;
  }

  assignFourballPlayers(
    actorId: string,
    fourballId: string,
    players: GolfPlayer[],
  ): GolfTourFourball {
    this.assertHost(actorId);
    this.assertMutable();
    const fourball = this.requireFourball(fourballId);
    fourball.assignPlayers(players);
    this.touch();
    return fourball;
  }

  moveFourballCamp(
    actorId: string,
    fourballId: string,
    campId: string,
  ): GolfTourFourball {
    this.assertHost(actorId);
    this.assertMutable();
    this.requireCamp(campId);
    const fourball = this.requireFourball(fourballId);
    fourball.moveToCamp(campId);
    this.touch();
    return fourball;
  }

  cancelFourball(actorId: string, fourballId: string): GolfTourFourball {
    this.assertHost(actorId);
    this.assertMutable();
    const fourball = this.requireFourball(fourballId);
    fourball.cancel();
    this.touch();
    return fourball;
  }

  startFourball(fourballId: string, golfRoundId: string): GolfTourFourball {
    this.assertMutable();
    const fourball = this.requireFourball(fourballId);
    fourball.start(golfRoundId);
    if (this.statusValue.isDraft) {
      this.statusValue = GolfTourStatus.ACTIVE;
    }
    this.touch();
    return fourball;
  }

  lockFourballFromScorecard(golfRoundId: string): GolfTourFourball | null {
    const fourball = this.fourballByGolfRoundId(golfRoundId);
    if (!fourball) return null;
    fourball.lockFromScorecard(golfRoundId);
    if (this.shouldAutoComplete()) {
      this.statusValue = GolfTourStatus.COMPLETED;
    }
    this.touch();
    return fourball;
  }

  complete(actorId: string): void {
    this.assertHost(actorId);
    if (this.statusValue.isCompleted) return;
    this.statusValue = GolfTourStatus.COMPLETED;
    this.touch();
  }

  shouldAutoComplete(): boolean {
    const playable = this.fourballsValue.filter(
      (fourball) => !fourball.status.isCancelled,
    );
    if (playable.length === 0) return false;
    return playable.every((fourball) => fourball.status.isLocked);
  }

  toSnapshot(): GolfTourSnapshot {
    return {
      id: this.id,
      name: this.nameValue.value,
      startDate: this.startDateValue.toDayString(),
      endDate: this.endDateValue.toDayString(),
      status: this.statusValue.value,
      hostUserId: this.hostUserId,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAtValue.toISOString(),
      camps: this.campsValue.map((camp) => camp.toSnapshot()),
      rounds: this.roundsValue.map((round) => round.toSnapshot()),
      fourballs: this.fourballsValue.map((fourball) => fourball.toSnapshot()),
    };
  }

  private requireCamp(campId: string): GolfTourCamp {
    const camp = this.campById(campId.trim());
    if (!camp) throw new GolfTourCampNotFoundError();
    return camp;
  }

  private requireRound(roundId: string): GolfTourRound {
    const round = this.roundById(roundId.trim());
    if (!round) throw new GolfTourRoundNotFoundError();
    return round;
  }

  private requireFourball(fourballId: string): GolfTourFourball {
    const fourball = this.fourballById(fourballId.trim());
    if (!fourball) throw new GolfTourFourballNotFoundError();
    return fourball;
  }

  private assertMutable(): void {
    if (!this.statusValue.isMutable) {
      throw new DomainError("A completed tour cannot be changed");
    }
  }

  private assertRoundDate(date: TourDate): void {
    if (!date.isWithin(this.startDateValue, this.endDateValue)) {
      throw new DomainError("Round date must be within the tour start and end dates");
    }
  }

  private touch(now = new Date()): void {
    this.updatedAtValue = now;
  }
}

function assertDateRange(start: TourDate, end: TourDate): void {
  if (end.isBefore(start)) {
    throw new DomainError("endDate must be on or after startDate");
  }
}
