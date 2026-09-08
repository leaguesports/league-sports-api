import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { Area } from "./area";
import { City } from "./city";
import { LobbyCapacityError } from "./lobby-capacity-error";
import { LobbyForbiddenError } from "./lobby-forbidden-error";
import { LobbyNotOpenError } from "./lobby-not-open-error";
import { LobbyOpenGameMember } from "./lobby-open-game-member";
import { LobbyOpenGameStatus } from "./lobby-open-game-status";
import { LobbySkill } from "./lobby-skill";
import { LobbySport } from "./lobby-sport";
import { PartySize } from "./party-size";
import { TimeWindow } from "./time-window";

export type LobbyOpenGameSnapshot = {
  id: string;
  hostUserId: string;
  sport: "padel" | "darts" | "golf";
  windowStart: string;
  windowEnd: string;
  city: string;
  area: string | null;
  venueCmsId: string | null;
  slotsNeeded: number;
  slotsFilled: number;
  skill: "casual" | "intermediate" | "competitive" | null;
  status: "open" | "filled" | "cancelled" | "expired";
  organiseGameId: string | null;
  createdAt: string;
  updatedAt: string;
  members: ReturnType<LobbyOpenGameMember["toSnapshot"]>[];
};

export type CreateLobbyOpenGameProps = {
  hostUserId: string;
  sport: LobbySport;
  window: TimeWindow;
  city: City;
  area: Area | null;
  venueCmsId: string | null;
  slotsNeeded?: number;
  hostPartySize: PartySize;
  skill: LobbySkill | null;
  now?: Date;
};

export class LobbyOpenGame {
  private constructor(
    readonly id: string,
    readonly hostUserId: string,
    readonly sport: LobbySport,
    readonly window: TimeWindow,
    readonly city: City,
    readonly area: Area | null,
    readonly venueCmsId: string | null,
    readonly slotsNeeded: number,
    readonly skill: LobbySkill | null,
    private statusValue: LobbyOpenGameStatus,
    private organiseGameIdValue: string | null,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private membersValue: LobbyOpenGameMember[],
  ) {}

  static create(props: CreateLobbyOpenGameProps): LobbyOpenGame {
    const hostUserId = requiredTrimmed(props.hostUserId, "userId");
    const now = props.now ?? new Date();
    if (props.window.end.getTime() <= now.getTime()) {
      throw new DomainError("windowEnd must be in the future");
    }
    const slotsNeeded = parseSlotsNeeded(props.slotsNeeded, props.sport);
    if (props.hostPartySize.value > slotsNeeded) {
      throw new DomainError("partySize cannot exceed slotsNeeded");
    }

    const host = LobbyOpenGameMember.create(
      hostUserId,
      props.hostPartySize,
      now,
    );

    return new LobbyOpenGame(
      randomUUID(),
      hostUserId,
      props.sport,
      props.window,
      props.city,
      props.area,
      props.venueCmsId,
      slotsNeeded,
      props.skill,
      LobbyOpenGameStatus.OPEN,
      null,
      now,
      now,
      [host],
    );
  }

  static rehydrate(props: {
    id: string;
    hostUserId: string;
    sport: LobbySport;
    window: TimeWindow;
    city: City;
    area: Area | null;
    venueCmsId: string | null;
    slotsNeeded: number;
    skill: LobbySkill | null;
    status: LobbyOpenGameStatus;
    organiseGameId: string | null;
    createdAt: Date;
    updatedAt: Date;
    members: LobbyOpenGameMember[];
  }): LobbyOpenGame {
    return new LobbyOpenGame(
      props.id,
      props.hostUserId,
      props.sport,
      props.window,
      props.city,
      props.area,
      props.venueCmsId,
      props.slotsNeeded,
      props.skill,
      props.status,
      props.organiseGameId,
      props.createdAt,
      props.updatedAt,
      [...props.members],
    );
  }

  static fromSnapshot(snapshot: LobbyOpenGameSnapshot): LobbyOpenGame {
    return LobbyOpenGame.rehydrate({
      id: snapshot.id,
      hostUserId: snapshot.hostUserId,
      sport: LobbySport.from(snapshot.sport),
      window: TimeWindow.from(snapshot.windowStart, snapshot.windowEnd),
      city: City.from(snapshot.city),
      area: Area.from(snapshot.area),
      venueCmsId: snapshot.venueCmsId,
      slotsNeeded: snapshot.slotsNeeded,
      skill: LobbySkill.from(snapshot.skill),
      status: LobbyOpenGameStatus.from(snapshot.status),
      organiseGameId: snapshot.organiseGameId,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
      members: snapshot.members.map((member) =>
        LobbyOpenGameMember.rehydrate({
          id: member.id,
          userId: member.userId,
          partySize: PartySize.from(member.partySize),
          createdAt: new Date(member.createdAt),
        }),
      ),
    });
  }

  get status(): LobbyOpenGameStatus {
    return this.statusValue;
  }

  get organiseGameId(): string | null {
    return this.organiseGameIdValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get members(): readonly LobbyOpenGameMember[] {
    return this.membersValue;
  }

  slotsFilled(): number {
    return this.membersValue.reduce(
      (sum, member) => sum + member.partySize.value,
      0,
    );
  }

  remainingSlots(): number {
    return this.slotsNeeded - this.slotsFilled();
  }

  isHost(userId: string): boolean {
    return this.hostUserId === userId.trim();
  }

  memberOf(userId: string): LobbyOpenGameMember | null {
    const id = userId.trim();
    return this.membersValue.find((member) => member.userId === id) ?? null;
  }

  isExpired(now = new Date()): boolean {
    return this.window.end.getTime() <= now.getTime();
  }

  expireIfNeeded(now = new Date()): void {
    if (this.statusValue.isOpen && this.isExpired(now)) {
      this.statusValue = LobbyOpenGameStatus.EXPIRED;
      this.touch(now);
    }
  }

  join(userId: string, partySize: PartySize, now = new Date()): void {
    const id = requiredTrimmed(userId, "userId");
    this.expireIfNeeded(now);
    if (!this.statusValue.isOpen) {
      throw new LobbyNotOpenError();
    }
    if (this.memberOf(id)) {
      throw new DomainError("Already joined this open game");
    }
    if (partySize.value > this.remainingSlots()) {
      throw new LobbyCapacityError();
    }

    this.membersValue = [
      ...this.membersValue,
      LobbyOpenGameMember.create(id, partySize, now),
    ];
    if (this.remainingSlots() === 0) {
      this.statusValue = LobbyOpenGameStatus.FILLED;
    }
    this.touch(now);
  }

  kick(actorId: string, targetUserId: string, now = new Date()): void {
    if (!this.isHost(actorId)) {
      throw new LobbyForbiddenError("Only the host can kick a player");
    }
    if (this.organiseGameIdValue) {
      throw new LobbyForbiddenError("Cannot kick after Organise conversion");
    }
    this.expireIfNeeded(now);
    if (!this.statusValue.isOpen && !this.statusValue.isFilled) {
      throw new LobbyNotOpenError();
    }

    const target = requiredTrimmed(targetUserId, "userId");
    if (this.isHost(target)) {
      throw new DomainError("Host cannot be kicked");
    }
    if (!this.memberOf(target)) {
      throw new DomainError("Player is not in this open game");
    }

    this.membersValue = this.membersValue.filter(
      (member) => member.userId !== target,
    );
    if (this.statusValue.isFilled && this.remainingSlots() > 0) {
      this.statusValue = LobbyOpenGameStatus.OPEN;
    }
    this.touch(now);
  }

  cancel(actorId: string, now = new Date()): void {
    if (!this.isHost(actorId)) {
      throw new LobbyForbiddenError("Only the host can cancel");
    }
    if (!this.statusValue.isOpen) {
      throw new LobbyNotOpenError();
    }
    this.statusValue = LobbyOpenGameStatus.CANCELLED;
    this.touch(now);
  }

  linkOrganisedGame(organiseGameId: string, now = new Date()): void {
    this.organiseGameIdValue = requiredTrimmed(organiseGameId, "organiseGameId");
    if (this.remainingSlots() === 0) {
      this.statusValue = LobbyOpenGameStatus.FILLED;
    }
    this.touch(now);
  }

  toSnapshot(): LobbyOpenGameSnapshot {
    return {
      id: this.id,
      hostUserId: this.hostUserId,
      sport: this.sport.value,
      windowStart: this.window.start.toISOString(),
      windowEnd: this.window.end.toISOString(),
      city: this.city.value,
      area: this.area?.value ?? null,
      venueCmsId: this.venueCmsId,
      slotsNeeded: this.slotsNeeded,
      slotsFilled: this.slotsFilled(),
      skill: this.skill?.value ?? null,
      status: this.statusValue.value,
      organiseGameId: this.organiseGameIdValue,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAtValue.toISOString(),
      members: this.membersValue.map((member) => member.toSnapshot()),
    };
  }

  private touch(now: Date): void {
    this.updatedAtValue = now;
  }
}

function parseSlotsNeeded(raw: unknown, sport: LobbySport): number {
  if (raw == null) return sport.defaultSlotsNeeded();
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    throw new DomainError(
      `slotsNeeded must be an integer between ${sport.minSlots()} and ${sport.maxSlots()}`,
    );
  }
  if (raw < sport.minSlots() || raw > sport.maxSlots()) {
    throw new DomainError(
      `slotsNeeded must be an integer between ${sport.minSlots()} and ${sport.maxSlots()}`,
    );
  }
  return raw;
}
