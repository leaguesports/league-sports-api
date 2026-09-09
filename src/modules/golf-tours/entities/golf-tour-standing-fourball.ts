import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import {
  GolfPlayer,
  GolfPlayerSnapshot,
} from "../../golf-round/entities/golf-player";
import { parseFourballPlayers } from "./golf-tour-fourball";

const NAME_MAX_LENGTH = 40;

export type GolfTourStandingFourballSnapshot = {
  id: string;
  campId: string;
  name: string | null;
  sortOrder: number;
  players: GolfPlayerSnapshot[];
};

export class GolfTourStandingFourball {
  private constructor(
    readonly id: string,
    private campIdValue: string,
    private nameValue: string | null,
    readonly sortOrder: number,
    private playersValue: GolfPlayer[],
  ) {}

  static create(props: {
    id: string;
    campId: string;
    name?: string | null;
    sortOrder: number;
    players?: GolfPlayer[];
  }): GolfTourStandingFourball {
    return new GolfTourStandingFourball(
      props.id,
      props.campId,
      parseStandingName(props.name),
      props.sortOrder,
      props.players ?? [],
    );
  }

  static rehydrate(props: {
    id: string;
    campId: string;
    name: string | null;
    sortOrder: number;
    players: GolfPlayer[];
  }): GolfTourStandingFourball {
    return new GolfTourStandingFourball(
      props.id,
      props.campId,
      props.name,
      props.sortOrder,
      [...props.players],
    );
  }

  static fromSnapshot(
    snapshot: GolfTourStandingFourballSnapshot,
  ): GolfTourStandingFourball {
    return GolfTourStandingFourball.rehydrate({
      id: snapshot.id,
      campId: snapshot.campId,
      name: snapshot.name,
      sortOrder: snapshot.sortOrder,
      players: snapshot.players.map((player) => GolfPlayer.from(player)),
    });
  }

  get campId(): string {
    return this.campIdValue;
  }

  get name(): string | null {
    return this.nameValue;
  }

  get players(): readonly GolfPlayer[] {
    return this.playersValue;
  }

  hasPlayerUserId(userId: string): boolean {
    return this.playersValue.some((player) => player.hasUserId(userId));
  }

  update(details: {
    campId?: string;
    name?: string | null;
    players?: GolfPlayer[];
  }): void {
    if (details.campId) this.campIdValue = details.campId;
    if ("name" in details) this.nameValue = parseStandingName(details.name);
    if (details.players) this.playersValue = details.players;
  }

  clonedPlayers(): GolfPlayer[] {
    return this.playersValue.map((player) => GolfPlayer.from(player.toSnapshot()));
  }

  toSnapshot(): GolfTourStandingFourballSnapshot {
    return {
      id: this.id,
      campId: this.campIdValue,
      name: this.nameValue,
      sortOrder: this.sortOrder,
      players: this.playersValue.map((player) => player.toSnapshot()),
    };
  }
}

export function parseStandingName(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const value = requiredTrimmed(raw, "name");
  if (value.length > NAME_MAX_LENGTH) {
    throw new DomainError(`name must be at most ${NAME_MAX_LENGTH} characters`);
  }
  return value;
}

export function parseStandingPlayers(raw: unknown): GolfPlayer[] {
  if (raw == null) return [];
  return parseFourballPlayers(raw);
}
