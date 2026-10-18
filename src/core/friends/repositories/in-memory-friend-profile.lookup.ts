import {
  FriendProfile,
  FriendProfileLookup,
} from "./friendship.repository";

export class InMemoryFriendProfileLookup implements FriendProfileLookup {
  private readonly byUserId = new Map<string, FriendProfile>();
  private readonly byHandle = new Map<string, string>();

  seed(profile: FriendProfile): void {
    this.byUserId.set(profile.userId, { ...profile });
    this.byHandle.set(profile.handle.toLowerCase(), profile.userId);
  }

  async findByUserId(userId: string): Promise<FriendProfile | null> {
    const row = this.byUserId.get(userId);
    return row ? { ...row } : null;
  }

  async findByHandle(handle: string): Promise<FriendProfile | null> {
    const userId = this.byHandle.get(handle.trim().toLowerCase());
    if (!userId) return null;
    return this.findByUserId(userId);
  }

  async search(
    query: string,
    options: { limit?: number; excludeUserId?: string } = {},
  ): Promise<FriendProfile[]> {
    const needle = query.trim().replace(/^@/, "").toLowerCase();
    if (!needle) return [];

    const limit = Math.min(Math.max(options.limit ?? 10, 1), 20);
    const excludeUserId = options.excludeUserId?.trim() || "";

    const matches: FriendProfile[] = [];
    for (const profile of this.byUserId.values()) {
      if (excludeUserId && profile.userId === excludeUserId) continue;
      const handle = profile.handle.toLowerCase();
      const name = profile.displayName.toLowerCase();
      if (!handle.includes(needle) && !name.includes(needle)) continue;
      matches.push({ ...profile });
      if (matches.length >= limit) break;
    }
    return matches;
  }
}
