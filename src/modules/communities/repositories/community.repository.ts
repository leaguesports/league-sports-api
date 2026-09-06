import { Community } from "../entities/community";

export interface CommunityRepository {
  findById(id: string): Promise<Community | null>;
  create(community: Community): Promise<Community>;
  persist(community: Community): Promise<Community>;
  list(options?: { limit?: number }): Promise<Community[]>;
  listForUser(userId: string): Promise<Community[]>;
}
