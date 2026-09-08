import { Tournament } from "../entities/tournament";

export interface TournamentRepository {
  findById(id: string): Promise<Tournament | null>;
  findByInviteToken(token: string): Promise<Tournament | null>;
  findByTeamMatchId(teamMatchId: string): Promise<Tournament | null>;
  create(tournament: Tournament): Promise<Tournament>;
  persist(tournament: Tournament): Promise<Tournament>;
  delete(id: string): Promise<void>;
  listForOrganizer(userId: string): Promise<Tournament[]>;
  listForTeamIds(teamIds: string[]): Promise<Tournament[]>;
}
