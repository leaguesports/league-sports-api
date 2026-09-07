import { Team } from "../entities/team";

export interface TeamRepository {
  findById(id: string): Promise<Team | null>;
  findByInviteToken(token: string): Promise<Team | null>;
  create(team: Team): Promise<Team>;
  persist(team: Team): Promise<Team>;
  delete(id: string): Promise<void>;
  listForUser(userId: string): Promise<Team[]>;
}
