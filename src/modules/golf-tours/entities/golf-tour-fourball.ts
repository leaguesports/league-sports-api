import { DomainError } from "../../../lib/domain-error";
import {
  GolfPlayer,
  GolfPlayerInput,
  GolfPlayerSnapshot,
} from "../../golf-round/entities/golf-player";
import { GolfTourFourballStatus } from "./golf-tour-fourball-status";
import { GolfTourNotReadyError } from "./golf-tour-not-ready-error";

export type GolfTourFourballPlayerSnapshot = GolfPlayerSnapshot & {
  sitOut: boolean;
};

export type GolfTourFourballSnapshot = {
  id: string;
  roundId: string;
  campId: string;
  golfRoundId: string | null;
  status: "pending" | "live" | "locked" | "cancelled";
  players: GolfTourFourballPlayerSnapshot[];
  standingFourballId: string | null;
  sitOut: boolean;
};

export class GolfTourFourball {
  private constructor(
    readonly id: string,
    readonly roundId: string,
    private campIdValue: string,
    private golfRoundIdValue: string | null,
    private statusValue: GolfTourFourballStatus,
    private playersValue: GolfPlayer[],
    private standingFourballIdValue: string | null,
    private sitOutValue: boolean,
    private sitOutSlots: Set<number>,
  ) {}

  static create(props: {
    id: string;
    roundId: string;
    campId: string;
    players?: GolfPlayer[];
    standingFourballId?: string | null;
    sitOut?: boolean;
    sitOutSlots?: Iterable<number>;
  }): GolfTourFourball {
    return new GolfTourFourball(
      props.id,
      props.roundId,
      props.campId,
      null,
      GolfTourFourballStatus.PENDING,
      props.players ?? [],
      props.standingFourballId ?? null,
      props.sitOut === true,
      new Set(props.sitOutSlots ?? []),
    );
  }

  static rehydrate(props: {
    id: string;
    roundId: string;
    campId: string;
    golfRoundId: string | null;
    status: GolfTourFourballStatus;
    players: GolfPlayer[];
    standingFourballId?: string | null;
    sitOut?: boolean;
    sitOutSlots?: Iterable<number>;
  }): GolfTourFourball {
    return new GolfTourFourball(
      props.id,
      props.roundId,
      props.campId,
      props.golfRoundId,
      props.status,
      [...props.players],
      props.standingFourballId ?? null,
      props.sitOut === true,
      new Set(props.sitOutSlots ?? []),
    );
  }

  static fromSnapshot(snapshot: GolfTourFourballSnapshot): GolfTourFourball {
    return GolfTourFourball.rehydrate({
      id: snapshot.id,
      roundId: snapshot.roundId,
      campId: snapshot.campId,
      golfRoundId: snapshot.golfRoundId,
      status: GolfTourFourballStatus.from(snapshot.status),
      players: snapshot.players.map((player) => GolfPlayer.from(player)),
      standingFourballId: snapshot.standingFourballId ?? null,
      sitOut: snapshot.sitOut === true,
      sitOutSlots: snapshot.players
        .filter((player) => player.sitOut)
        .map((player) => player.slot),
    });
  }

  get campId(): string {
    return this.campIdValue;
  }

  get golfRoundId(): string | null {
    return this.golfRoundIdValue;
  }

  get status(): GolfTourFourballStatus {
    return this.statusValue;
  }

  get players(): readonly GolfPlayer[] {
    return this.playersValue;
  }

  get standingFourballId(): string | null {
    return this.standingFourballIdValue;
  }

  get sitOut(): boolean {
    return this.sitOutValue;
  }

  detachStandingTemplate(): void {
    this.standingFourballIdValue = null;
  }

  get path(): string | null {
    return this.golfRoundIdValue ? `/golf/${this.golfRoundIdValue}` : null;
  }

  hasPlayerUserId(userId: string): boolean {
    return this.playersValue.some((player) => player.hasUserId(userId));
  }

  playerSitsOut(slot: number): boolean {
    return this.sitOutValue || this.sitOutSlots.has(slot);
  }

  scoringPlayers(): GolfPlayer[] {
    return this.playersValue.filter((player) => !this.playerSitsOut(player.slot));
  }

  assignPlayers(
    players: GolfPlayer[],
    sitOutBySlot?: Map<number, boolean>,
  ): void {
    if (!this.statusValue.isPending) {
      throw new DomainError("Players can only be assigned while the fourball is pending");
    }
    this.playersValue = players;
    if (sitOutBySlot) {
      this.sitOutSlots = new Set(
        [...sitOutBySlot.entries()]
          .filter(([, sitOut]) => sitOut)
          .map(([slot]) => slot),
      );
    } else {
      this.sitOutSlots = new Set();
    }
  }

  setSitOut(sitOut: boolean): void {
    if (this.statusValue.isCancelled) {
      throw new DomainError("A cancelled fourball cannot sit out");
    }
    this.sitOutValue = sitOut;
  }

  setPlayerSitOuts(updates: Map<number, boolean>): void {
    if (this.statusValue.isCancelled) {
      throw new DomainError("A cancelled fourball cannot sit out");
    }
    for (const [slot, sitOut] of updates) {
      if (!this.playersValue.some((player) => player.slot === slot)) {
        throw new DomainError(`No player in slot ${slot}`);
      }
      if (sitOut) this.sitOutSlots.add(slot);
      else this.sitOutSlots.delete(slot);
    }
  }

  moveToCamp(campId: string): void {
    if (!this.statusValue.isPending) {
      throw new DomainError("Camp can only be changed while the fourball is pending");
    }
    this.campIdValue = campId;
  }

  cancel(): void {
    if (!this.statusValue.isPending) {
      throw new DomainError("Only a pending fourball can be cancelled");
    }
    this.statusValue = GolfTourFourballStatus.CANCELLED;
  }

  start(golfRoundId: string): void {
    if (this.statusValue.isLive && this.golfRoundIdValue === golfRoundId) {
      return;
    }
    if (this.statusValue.isLocked && this.golfRoundIdValue === golfRoundId) {
      return;
    }
    if (!this.statusValue.isPending) {
      throw new DomainError("Only a pending fourball can be started");
    }
    if (this.sitOutValue) {
      throw new DomainError("A sit-out fourball cannot be started");
    }
    if (this.scoringPlayers().length < 1) {
      throw new GolfTourNotReadyError(
        "Assign at least one player before starting this fourball",
      );
    }
    const id = golfRoundId.trim();
    if (!id) {
      throw new DomainError("golfRoundId is required");
    }
    this.golfRoundIdValue = id;
    this.statusValue = GolfTourFourballStatus.LIVE;
  }

  lockFromScorecard(golfRoundId: string): void {
    if (this.golfRoundIdValue !== golfRoundId) return;
    if (this.statusValue.isLocked) return;
    if (!this.statusValue.isLive) return;
    this.statusValue = GolfTourFourballStatus.LOCKED;
  }

  toSnapshot(): GolfTourFourballSnapshot {
    return {
      id: this.id,
      roundId: this.roundId,
      campId: this.campIdValue,
      golfRoundId: this.golfRoundIdValue,
      status: this.statusValue.value,
      standingFourballId: this.standingFourballIdValue,
      sitOut: this.sitOutValue,
      players: this.playersValue.map((player) => ({
        ...player.toSnapshot(),
        sitOut: this.sitOutSlots.has(player.slot),
      })),
    };
  }
}

export function parseFourballPlayers(raw: unknown): GolfPlayer[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new DomainError("players must be an array");
  }
  if (raw.length === 0) return [];
  return GolfPlayer.fromPlayers(raw as GolfPlayerInput[]);
}

export type ParsedFourballSeats = {
  players: GolfPlayer[];
  sitOutBySlot: Map<number, boolean>;
};

export function parseFourballSeats(raw: unknown): ParsedFourballSeats {
  const players = parseFourballPlayers(raw);
  const sitOutBySlot = new Map<number, boolean>();
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (
        row &&
        typeof row === "object" &&
        "slot" in row &&
        "sitOut" in row
      ) {
        const slot = (row as { slot: number }).slot;
        sitOutBySlot.set(slot, (row as { sitOut: unknown }).sitOut === true);
      }
    }
  }
  return { players, sitOutBySlot };
}

export function parsePlayerSitOuts(raw: unknown): Map<number, boolean> {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new DomainError("playerSitOuts must be a non-empty array");
  }
  const updates = new Map<number, boolean>();
  for (const row of raw) {
    if (!row || typeof row !== "object" || !("slot" in row)) {
      throw new DomainError("playerSitOuts.slot must be 1, 2, 3, or 4");
    }
    const slot = (row as { slot: unknown }).slot;
    if (slot !== 1 && slot !== 2 && slot !== 3 && slot !== 4) {
      throw new DomainError("playerSitOuts.slot must be 1, 2, 3, or 4");
    }
    updates.set(slot, (row as { sitOut?: unknown }).sitOut === true);
  }
  return updates;
}

export function golfRoundPath(golfRoundId: string): string {
  return `/golf/${golfRoundId}`;
}
