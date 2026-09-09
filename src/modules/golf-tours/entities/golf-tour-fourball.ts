import { DomainError } from "../../../lib/domain-error";
import {
  GolfPlayer,
  GolfPlayerInput,
  GolfPlayerSnapshot,
} from "../../golf-round/entities/golf-player";
import { GolfTourFourballStatus } from "./golf-tour-fourball-status";
import { GolfTourNotReadyError } from "./golf-tour-not-ready-error";

export type GolfTourFourballSnapshot = {
  id: string;
  roundId: string;
  campId: string;
  golfRoundId: string | null;
  status: "pending" | "live" | "locked" | "cancelled";
  players: GolfPlayerSnapshot[];
};

export class GolfTourFourball {
  private constructor(
    readonly id: string,
    readonly roundId: string,
    private campIdValue: string,
    private golfRoundIdValue: string | null,
    private statusValue: GolfTourFourballStatus,
    private playersValue: GolfPlayer[],
  ) {}

  static create(props: {
    id: string;
    roundId: string;
    campId: string;
    players?: GolfPlayer[];
  }): GolfTourFourball {
    return new GolfTourFourball(
      props.id,
      props.roundId,
      props.campId,
      null,
      GolfTourFourballStatus.PENDING,
      props.players ?? [],
    );
  }

  static rehydrate(props: {
    id: string;
    roundId: string;
    campId: string;
    golfRoundId: string | null;
    status: GolfTourFourballStatus;
    players: GolfPlayer[];
  }): GolfTourFourball {
    return new GolfTourFourball(
      props.id,
      props.roundId,
      props.campId,
      props.golfRoundId,
      props.status,
      [...props.players],
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

  get path(): string | null {
    return this.golfRoundIdValue ? `/golf/${this.golfRoundIdValue}` : null;
  }

  hasPlayerUserId(userId: string): boolean {
    return this.playersValue.some((player) => player.hasUserId(userId));
  }

  assignPlayers(players: GolfPlayer[]): void {
    if (!this.statusValue.isPending) {
      throw new DomainError("Players can only be assigned while the fourball is pending");
    }
    this.playersValue = players;
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
    if (this.playersValue.length < 1) {
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
      players: this.playersValue.map((player) => player.toSnapshot()),
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

export function golfRoundPath(golfRoundId: string): string {
  return `/golf/${golfRoundId}`;
}
