import { OrganisedGame } from "../entities/organised-game";

export interface OrganisedGameRepository {
  findById(id: string): Promise<OrganisedGame | null>;
  findByInviteToken(token: string): Promise<OrganisedGame | null>;
  create(game: OrganisedGame): Promise<OrganisedGame>;
  persist(game: OrganisedGame): Promise<OrganisedGame>;
  listHostedBy(hostUserId: string): Promise<OrganisedGame[]>;
  listInvitedUser(userId: string): Promise<OrganisedGame[]>;
}
