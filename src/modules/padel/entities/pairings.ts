import { DomainError } from "../../../lib/domain-error";
import { MatchPlayer, MatchPlayerInput, MatchPlayerSnapshot } from "./match-player";
import { PlayerSlot } from "./player-slot";

export type PairingsInput = {
  teamA: [MatchPlayerInput, MatchPlayerInput];
  teamB: [MatchPlayerInput, MatchPlayerInput];
};

export type PairingsSnapshot = {
  teamA: [MatchPlayerSnapshot, MatchPlayerSnapshot];
  teamB: [MatchPlayerSnapshot, MatchPlayerSnapshot];
};

export class Pairings {
  private constructor(readonly players: readonly MatchPlayer[]) {}

  static from(input: PairingsInput): Pairings {
    if (!Array.isArray(input.teamA) || input.teamA.length !== 2) {
      throw new DomainError("pairings.teamA must include two players");
    }
    if (!Array.isArray(input.teamB) || input.teamB.length !== 2) {
      throw new DomainError("pairings.teamB must include two players");
    }

    const players = [
      MatchPlayer.from(PlayerSlot.A1, input.teamA[0]),
      MatchPlayer.from(PlayerSlot.A2, input.teamA[1]),
      MatchPlayer.from(PlayerSlot.B1, input.teamB[0]),
      MatchPlayer.from(PlayerSlot.B2, input.teamB[1]),
    ];

    return new Pairings(players);
  }

  static fromPlayers(players: MatchPlayer[]): Pairings {
    const bySlot = new Map(players.map((player) => [player.slot.value, player]));
    const ordered = PlayerSlot.all.map((slot) => {
      const player = bySlot.get(slot.value);
      if (!player) {
        throw new DomainError(`missing player for slot ${slot.value}`);
      }
      return player;
    });

    if (players.length !== 4) {
      throw new DomainError("a padel match requires four players");
    }

    return new Pairings(ordered);
  }

  playerOnTeam(userId: string): MatchPlayer | null {
    return (
      this.players.find((player) => player.userId === userId) ?? null
    );
  }

  opponentsOf(userId: string): MatchPlayerSnapshot[] {
    const player = this.playerOnTeam(userId);
    if (!player) {
      return [];
    }

    const otherTeam = player.slot.team.opponent();
    return this.players
      .filter((candidate) => candidate.slot.team.equals(otherTeam))
      .map((candidate) => candidate.toSnapshot());
  }

  toSnapshot(): PairingsSnapshot {
    const [a1, a2, b1, b2] = this.players.map((player) => player.toSnapshot());
    return {
      teamA: [a1, a2],
      teamB: [b1, b2],
    };
  }
}
