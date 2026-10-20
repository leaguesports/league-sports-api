import {
  FriendshipRecord,
  FriendshipRepository,
} from "./friendship.repository";

export class InMemoryFriendshipRepository implements FriendshipRepository {
  private readonly rows = new Map<string, FriendshipRecord>();

  async findBetween(
    userIdA: string,
    userIdB: string,
  ): Promise<FriendshipRecord | null> {
    for (const row of this.rows.values()) {
      if (
        (row.requesterId === userIdA && row.addresseeId === userIdB) ||
        (row.requesterId === userIdB && row.addresseeId === userIdA)
      ) {
        return { ...row };
      }
    }
    return null;
  }

  async createPending(
    requesterId: string,
    addresseeId: string,
  ): Promise<FriendshipRecord> {
    const existing = await this.findBetween(requesterId, addresseeId);
    if (existing) {
      return { ...existing };
    }

    const now = new Date();
    const row: FriendshipRecord = {
      id: `friendship_${this.rows.size + 1}`,
      requesterId,
      addresseeId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return { ...row };
  }

  async accept(id: string): Promise<FriendshipRecord | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    const next: FriendshipRecord = {
      ...row,
      status: "accepted",
      updatedAt: new Date(),
    };
    this.rows.set(id, next);
    return { ...next };
  }

  async deleteBetween(userIdA: string, userIdB: string): Promise<boolean> {
    for (const [id, row] of this.rows) {
      if (
        (row.requesterId === userIdA && row.addresseeId === userIdB) ||
        (row.requesterId === userIdB && row.addresseeId === userIdA)
      ) {
        this.rows.delete(id);
        return true;
      }
    }
    return false;
  }

  async listForUser(userId: string): Promise<FriendshipRecord[]> {
    return [...this.rows.values()]
      .filter(
        (row) => row.requesterId === userId || row.addresseeId === userId,
      )
      .map((row) => ({ ...row }))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
}
