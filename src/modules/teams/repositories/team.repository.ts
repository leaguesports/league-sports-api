import { TeamSportValue } from "../entities/team-sport";
import { Team } from "../entities/team";

export type TeamSearchParams = {
  sport: TeamSportValue;
  query?: string;
  excludeTeamIds?: string[];
  limit?: number;
};

export interface TeamRepository {
  findById(id: string): Promise<Team | null>;
  findByInviteToken(token: string): Promise<Team | null>;
  create(team: Team): Promise<Team>;
  persist(team: Team): Promise<Team>;
  delete(id: string): Promise<void>;
  listForUser(userId: string): Promise<Team[]>;
  listActiveForUsers(userIds: string[], sport: TeamSportValue): Promise<Team[]>;
  search(params: TeamSearchParams): Promise<Team[]>;
}
