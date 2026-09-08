import { TeamMatch } from "../../team-matches/entities/team-match";
import { TournamentPersistenceError } from "../entities/tournament-persistence-error";
import { TournamentRepository } from "../repositories/tournament.repository";

export class AdvanceTournamentOnTeamMatchComplete {
  constructor(private readonly tournaments: TournamentRepository) {}

  async execute(match: TeamMatch): Promise<void> {
    try {
      if (!match.status.isCompleted || !match.winnerTeamId) return;
      const tournament = await this.tournaments.findByTeamMatchId(match.id);
      if (!tournament) return;
      tournament.advanceFromMatch(match.id, match.winnerTeamId);
      await this.tournaments.persist(tournament);
    } catch (error) {
      if (error instanceof TournamentPersistenceError) return;
      console.error("Failed to advance tournament from team match", error);
    }
  }
}
