import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

export type TournamentSlotSide = "home" | "away";

export type TournamentSlotSnapshot = {
  id: string;
  round: number;
  position: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeSeed: number | null;
  awaySeed: number | null;
  teamMatchId: string | null;
  winnerTeamId: string | null;
  nextSlotId: string | null;
  nextSide: TournamentSlotSide | null;
};

export class TournamentSlot {
  private constructor(
    readonly id: string,
    readonly round: number,
    readonly position: number,
    private homeTeamIdValue: string | null,
    private awayTeamIdValue: string | null,
    private homeSeedValue: number | null,
    private awaySeedValue: number | null,
    private teamMatchIdValue: string | null,
    private winnerTeamIdValue: string | null,
    private nextSlotIdValue: string | null,
    private nextSideValue: TournamentSlotSide | null,
  ) {}

  static create(props: { round: number; position: number }): TournamentSlot {
    return new TournamentSlot(
      randomUUID(),
      props.round,
      props.position,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    );
  }

  static rehydrate(props: TournamentSlotSnapshot): TournamentSlot {
    return new TournamentSlot(
      props.id,
      props.round,
      props.position,
      props.homeTeamId,
      props.awayTeamId,
      props.homeSeed,
      props.awaySeed,
      props.teamMatchId,
      props.winnerTeamId,
      props.nextSlotId,
      props.nextSide,
    );
  }

  static fromSnapshot(snapshot: TournamentSlotSnapshot): TournamentSlot {
    return TournamentSlot.rehydrate(snapshot);
  }

  get homeTeamId(): string | null {
    return this.homeTeamIdValue;
  }

  get awayTeamId(): string | null {
    return this.awayTeamIdValue;
  }

  get homeSeed(): number | null {
    return this.homeSeedValue;
  }

  get awaySeed(): number | null {
    return this.awaySeedValue;
  }

  get teamMatchId(): string | null {
    return this.teamMatchIdValue;
  }

  get winnerTeamId(): string | null {
    return this.winnerTeamIdValue;
  }

  get nextSlotId(): string | null {
    return this.nextSlotIdValue;
  }

  get nextSide(): TournamentSlotSide | null {
    return this.nextSideValue;
  }

  get isReady(): boolean {
    return this.homeTeamIdValue !== null && this.awayTeamIdValue !== null;
  }

  get isFinal(): boolean {
    return this.nextSlotIdValue === null;
  }

  involvesTeam(teamId: string): boolean {
    return (
      this.homeTeamIdValue === teamId || this.awayTeamIdValue === teamId
    );
  }

  setNext(nextSlotId: string, nextSide: TournamentSlotSide): void {
    this.nextSlotIdValue = nextSlotId;
    this.nextSideValue = nextSide;
  }

  placeTeams(
    homeTeamId: string,
    awayTeamId: string,
    homeSeed: number,
    awaySeed: number,
  ): void {
    this.homeTeamIdValue = homeTeamId;
    this.awayTeamIdValue = awayTeamId;
    this.homeSeedValue = homeSeed;
    this.awaySeedValue = awaySeed;
  }

  placeSide(side: TournamentSlotSide, teamId: string): void {
    const id = requiredTrimmed(teamId, "teamId");
    if (side === "home") {
      if (this.homeTeamIdValue && this.homeTeamIdValue !== id) {
        throw new DomainError("Home side is already occupied");
      }
      this.homeTeamIdValue = id;
      return;
    }
    if (this.awayTeamIdValue && this.awayTeamIdValue !== id) {
      throw new DomainError("Away side is already occupied");
    }
    this.awayTeamIdValue = id;
  }

  attachMatch(teamMatchId: string): void {
    const id = requiredTrimmed(teamMatchId, "teamMatchId");
    if (this.teamMatchIdValue && this.teamMatchIdValue !== id) {
      throw new DomainError("Fixture already has a team match");
    }
    if (!this.isReady) {
      throw new DomainError("Both teams must be set before starting a fixture");
    }
    this.teamMatchIdValue = id;
  }

  setWinner(winnerTeamId: string): void {
    const id = requiredTrimmed(winnerTeamId, "winnerTeamId");
    if (!this.involvesTeam(id)) {
      throw new DomainError("winnerTeamId must be home or away");
    }
    if (this.winnerTeamIdValue && this.winnerTeamIdValue !== id) {
      throw new DomainError("Fixture already has a different winner");
    }
    this.winnerTeamIdValue = id;
  }

  toSnapshot(): TournamentSlotSnapshot {
    return {
      id: this.id,
      round: this.round,
      position: this.position,
      homeTeamId: this.homeTeamIdValue,
      awayTeamId: this.awayTeamIdValue,
      homeSeed: this.homeSeedValue,
      awaySeed: this.awaySeedValue,
      teamMatchId: this.teamMatchIdValue,
      winnerTeamId: this.winnerTeamIdValue,
      nextSlotId: this.nextSlotIdValue,
      nextSide: this.nextSideValue,
    };
  }
}
