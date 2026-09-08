import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { Area } from "./area";
import { City } from "./city";
import { LobbySkill } from "./lobby-skill";
import { LobbySport } from "./lobby-sport";
import { PartySize } from "./party-size";
import { TimeWindow } from "./time-window";

export const LOOKING_TTL_MS = 24 * 60 * 60 * 1000;

export type LobbyLookingSnapshot = {
  id: string;
  userId: string;
  sport: "padel" | "darts" | "golf";
  windowStart: string;
  windowEnd: string;
  city: string;
  area: string | null;
  venueCmsId: string | null;
  partySize: number;
  skill: "casual" | "intermediate" | "competitive" | null;
  expiresAt: string;
  createdAt: string;
};

export type CreateLobbyLookingProps = {
  userId: string;
  sport: LobbySport;
  window: TimeWindow;
  city: City;
  area: Area | null;
  venueCmsId: string | null;
  partySize: PartySize;
  skill: LobbySkill | null;
  now?: Date;
};

export class LobbyLooking {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly sport: LobbySport,
    readonly window: TimeWindow,
    readonly city: City,
    readonly area: Area | null,
    readonly venueCmsId: string | null,
    readonly partySize: PartySize,
    readonly skill: LobbySkill | null,
    readonly expiresAt: Date,
    readonly createdAt: Date,
  ) {}

  static create(props: CreateLobbyLookingProps): LobbyLooking {
    const userId = requiredTrimmed(props.userId, "userId");
    const now = props.now ?? new Date();
    if (props.window.end.getTime() <= now.getTime()) {
      throw new DomainError("windowEnd must be in the future");
    }
    const ttlCap = new Date(now.getTime() + LOOKING_TTL_MS);
    const expiresAt =
      props.window.end.getTime() < ttlCap.getTime() ? props.window.end : ttlCap;

    return new LobbyLooking(
      randomUUID(),
      userId,
      props.sport,
      props.window,
      props.city,
      props.area,
      props.venueCmsId,
      props.partySize,
      props.skill,
      expiresAt,
      now,
    );
  }

  static rehydrate(props: {
    id: string;
    userId: string;
    sport: LobbySport;
    window: TimeWindow;
    city: City;
    area: Area | null;
    venueCmsId: string | null;
    partySize: PartySize;
    skill: LobbySkill | null;
    expiresAt: Date;
    createdAt: Date;
  }): LobbyLooking {
    return new LobbyLooking(
      props.id,
      props.userId,
      props.sport,
      props.window,
      props.city,
      props.area,
      props.venueCmsId,
      props.partySize,
      props.skill,
      props.expiresAt,
      props.createdAt,
    );
  }

  static fromSnapshot(snapshot: LobbyLookingSnapshot): LobbyLooking {
    return LobbyLooking.rehydrate({
      id: snapshot.id,
      userId: snapshot.userId,
      sport: LobbySport.from(snapshot.sport),
      window: TimeWindow.from(snapshot.windowStart, snapshot.windowEnd),
      city: City.from(snapshot.city),
      area: Area.from(snapshot.area),
      venueCmsId: snapshot.venueCmsId,
      partySize: PartySize.from(snapshot.partySize),
      skill: LobbySkill.from(snapshot.skill),
      expiresAt: new Date(snapshot.expiresAt),
      createdAt: new Date(snapshot.createdAt),
    });
  }

  isExpired(now = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  isActive(now = new Date()): boolean {
    return !this.isExpired(now);
  }

  toSnapshot(): LobbyLookingSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      sport: this.sport.value,
      windowStart: this.window.start.toISOString(),
      windowEnd: this.window.end.toISOString(),
      city: this.city.value,
      area: this.area?.value ?? null,
      venueCmsId: this.venueCmsId,
      partySize: this.partySize.value,
      skill: this.skill?.value ?? null,
      expiresAt: this.expiresAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
    };
  }
}
