import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { GolfPlayer } from "../../golf-round/entities/golf-player";
import { CmsId } from "../../venue/entities/cms-id";
import { GolfTourCamp } from "./golf-tour-camp";
import { GolfTourCampName } from "./golf-tour-camp-name";
import { GolfTourCampNotFoundError } from "./golf-tour-camp-not-found-error";
import { GolfTourForbiddenError } from "./golf-tour-forbidden-error";
import { GolfTourFormat } from "./golf-tour-format";
import { GolfTourFourball } from "./golf-tour-fourball";
import { GolfTourFourballNotFoundError } from "./golf-tour-fourball-not-found-error";
import { GolfTourName } from "./golf-tour-name";
import { GolfTourRosterMember } from "./golf-tour-roster-member";
import { GolfTourRound } from "./golf-tour-round";
import { GolfTourRoundNotFoundError } from "./golf-tour-round-not-found-error";
import { GolfTourStandingFourball } from "./golf-tour-standing-fourball";
import { GolfTourStandingFourballNotFoundError } from "./golf-tour-standing-fourball-not-found-error";
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
  standingFourballs: ReturnType<GolfTourStandingFourball["toSnapshot"]>[];
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
    private standingFourballsValue: GolfTourStandingFourball[],
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
    standingFourballs?: GolfTourStandingFourball[];
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
      [...(props.standingFourballs ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
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
      standingFourballs: (snapshot.standingFourballs ?? []).map((template) =>
        GolfTourStandingFourball.fromSnapshot(template),
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

  get standingFourballs(): readonly GolfTourStandingFourball[] {
    return this.standingFourballsValue;
  }

  isHost(userId: string): boolean {
    return this.hostUserId === userId.trim();
  }

  isPlayer(userId: string): boolean {
    const id = userId.trim();
    if (this.fourballsValue.some((fourball) => fourball.hasPlayerUserId(id))) {
      return true;
    }
    if (this.campsValue.some((camp) => camp.hasPlayerUserId(id))) {
      return true;
    }
    return this.standingFourballsValue.some((template) =>
      template.hasPlayerUserId(id),
    );
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

  standingFourballById(templateId: string): GolfTourStandingFourball | null {
    return (
      this.standingFourballsValue.find(
        (template) => template.id === templateId,
      ) ?? null
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
    this.spawnInstancesFromTemplates(round.id);
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
    sitOutBySlot?: Map<number, boolean>,
  ): GolfTourFourball {
    this.assertHost(actorId);
    this.assertMutable();
    const fourball = this.requireFourball(fourballId);
    fourball.assignPlayers(players, sitOutBySlot);
    this.touch();
    return fourball;
  }

  setFourballSitOut(
    actorId: string,
    fourballId: string,
    sitOut: boolean,
  ): GolfTourFourball {
    this.assertHost(actorId);
    this.assertMutable();
    const fourball = this.requireFourball(fourballId);
    fourball.setSitOut(sitOut);
    this.touch();
    return fourball;
  }

  setFourballPlayerSitOuts(
    actorId: string,
    fourballId: string,
    updates: Map<number, boolean>,
  ): GolfTourFourball {
    this.assertHost(actorId);
    this.assertMutable();
    const fourball = this.requireFourball(fourballId);
    fourball.setPlayerSitOuts(updates);
    this.touch();
    return fourball;
  }

  addRosterMember(
    actorId: string,
    campId: string,
    props: { userId?: string | null; displayName: unknown; isGuest: unknown },
  ): GolfTourRosterMember {
    this.assertHost(actorId);
    this.assertMutable();
    const camp = this.requireCamp(campId);
    const member = GolfTourRosterMember.create({
      id: randomUUID(),
      campId: camp.id,
      userId: props.userId,
      displayName: props.displayName,
      isGuest: props.isGuest,
    });
    camp.addMember(member);
    this.touch();
    return member;
  }

  updateRosterMember(
    actorId: string,
    campId: string,
    memberId: string,
    details: {
      userId?: string | null;
      displayName?: unknown;
      isGuest?: unknown;
    },
  ): GolfTourRosterMember {
    this.assertHost(actorId);
    this.assertMutable();
    const camp = this.requireCamp(campId);
    if (
      details.displayName === undefined &&
      !("userId" in details) &&
      details.isGuest === undefined
    ) {
      throw new DomainError("At least one field is required");
    }
    const member = camp.updateMember(memberId, details);
    this.touch();
    return member;
  }

  removeRosterMember(
    actorId: string,
    campId: string,
    memberId: string,
  ): GolfTourRosterMember {
    this.assertHost(actorId);
    this.assertMutable();
    const camp = this.requireCamp(campId);
    const member = camp.removeMember(memberId);
    this.touch();
    return member;
  }

  addStandingFourball(
    actorId: string,
    props: {
      campId: string;
      name?: string | null;
      players?: GolfPlayer[];
      sortOrder?: number;
    },
  ): GolfTourStandingFourball {
    this.assertHost(actorId);
    this.assertMutable();
    this.requireCamp(props.campId);
    const sortOrder =
      props.sortOrder ??
      this.standingFourballsValue.reduce(
        (max, template) => Math.max(max, template.sortOrder),
        -1,
      ) + 1;
    const template = GolfTourStandingFourball.create({
      id: randomUUID(),
      campId: props.campId,
      name: props.name,
      sortOrder,
      players: props.players,
    });
    this.standingFourballsValue = [...this.standingFourballsValue, template];
    this.touch();
    return template;
  }

  updateStandingFourball(
    actorId: string,
    templateId: string,
    details: {
      campId?: string;
      name?: string | null;
      players?: GolfPlayer[];
    },
  ): GolfTourStandingFourball {
    this.assertHost(actorId);
    this.assertMutable();
    const template = this.requireStandingFourball(templateId);
    if (
      !details.campId &&
      !("name" in details) &&
      details.players === undefined
    ) {
      throw new DomainError("At least one field is required");
    }
    if (details.campId) this.requireCamp(details.campId);
    template.update(details);
    this.touch();
    return template;
  }

  removeStandingFourball(
    actorId: string,
    templateId: string,
  ): GolfTourStandingFourball {
    this.assertHost(actorId);
    this.assertMutable();
    const template = this.requireStandingFourball(templateId);
    for (const fourball of this.fourballsValue) {
      if (fourball.standingFourballId === template.id) {
        fourball.detachStandingTemplate();
      }
    }
    this.standingFourballsValue = this.standingFourballsValue.filter(
      (row) => row.id !== template.id,
    );
    this.touch();
    return template;
  }

  prepareRound(actorId: string, roundId: string): GolfTourFourball[] {
    this.assertHost(actorId);
    this.assertMutable();
    const created = this.spawnInstancesFromTemplates(roundId);
    this.touch();
    return created;
  }

  copyRoundInstances(
    actorId: string,
    targetRoundId: string,
    sourceRoundId: string,
  ): GolfTourFourball[] {
    this.assertHost(actorId);
    this.assertMutable();
    const target = this.requireRound(targetRoundId);
    const source = this.requireRound(sourceRoundId);
    if (target.id === source.id) {
      throw new DomainError("Cannot copy a round onto itself");
    }

    const createdOrUpdated: GolfTourFourball[] = [];
    const sources = this.fourballsValue.filter(
      (fourball) =>
        fourball.roundId === source.id && !fourball.status.isCancelled,
    );

    for (const sourceFourball of sources) {
      const clonedPlayers = sourceFourball.players.map((player) =>
        GolfPlayer.from(player.toSnapshot()),
      );
      const existing = this.findCopyTarget(target.id, sourceFourball);
      if (existing) {
        if (existing.status.isPending) {
          existing.assignPlayers(clonedPlayers);
        }
        createdOrUpdated.push(existing);
        continue;
      }

      const copy = GolfTourFourball.create({
        id: randomUUID(),
        roundId: target.id,
        campId: sourceFourball.campId,
        players: clonedPlayers,
        standingFourballId: sourceFourball.standingFourballId,
      });
      this.fourballsValue = [...this.fourballsValue, copy];
      createdOrUpdated.push(copy);
    }

    this.touch();
    return createdOrUpdated;
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
      (fourball) => !fourball.status.isCancelled && !fourball.sitOut,
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
      standingFourballs: this.standingFourballsValue.map((template) =>
        template.toSnapshot(),
      ),
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

  private requireStandingFourball(
    templateId: string,
  ): GolfTourStandingFourball {
    const template = this.standingFourballById(templateId.trim());
    if (!template) throw new GolfTourStandingFourballNotFoundError();
    return template;
  }

  private spawnInstancesFromTemplates(roundId: string): GolfTourFourball[] {
    this.requireRound(roundId);
    const created: GolfTourFourball[] = [];
    for (const template of this.standingFourballsValue) {
      const existing = this.fourballsValue.find(
        (fourball) =>
          fourball.roundId === roundId &&
          fourball.standingFourballId === template.id,
      );
      if (existing) continue;
      const fourball = GolfTourFourball.create({
        id: randomUUID(),
        roundId,
        campId: template.campId,
        players: template.clonedPlayers(),
        standingFourballId: template.id,
      });
      this.fourballsValue = [...this.fourballsValue, fourball];
      created.push(fourball);
    }
    return created;
  }

  private findCopyTarget(
    targetRoundId: string,
    sourceFourball: GolfTourFourball,
  ): GolfTourFourball | undefined {
    if (sourceFourball.standingFourballId) {
      return this.fourballsValue.find(
        (fourball) =>
          fourball.roundId === targetRoundId &&
          fourball.standingFourballId === sourceFourball.standingFourballId,
      );
    }
    const sourceKeys = playerKeys(sourceFourball);
    return this.fourballsValue.find((fourball) => {
      if (fourball.roundId !== targetRoundId) return false;
      if (fourball.standingFourballId) return false;
      if (fourball.campId !== sourceFourball.campId) return false;
      return playerKeys(fourball) === sourceKeys;
    });
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

function playerKeys(fourball: GolfTourFourball): string {
  return fourball.players
    .map((player) => {
      const snapshot = player.toSnapshot();
      const key =
        !snapshot.isGuest && snapshot.userId
          ? `user:${snapshot.userId}`
          : `guest:${snapshot.displayName.trim().toLowerCase()}`;
      return `${snapshot.slot}:${key}`;
    })
    .join("|");
}
