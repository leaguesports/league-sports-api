import {
  ClubMemberRecord,
  ClubMemberRole,
  ClubRecord,
  ClubRepository,
  ClubSummary,
  ClubSummaryForUser,
  ClubWithMembers,
  CreateClubInput,
} from "./club.repository";

export class InMemoryClubRepository implements ClubRepository {
  private readonly clubs = new Map<string, ClubRecord>();
  private readonly members = new Map<string, ClubMemberRecord>();
  private seq = 0;
  private clock = Date.now();

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  private now(): Date {
    this.clock += 1;
    return new Date(this.clock);
  }

  private cloneClub(row: ClubRecord): ClubRecord {
    return { ...row };
  }

  private cloneMember(row: ClubMemberRecord): ClubMemberRecord {
    return { ...row };
  }

  private membersForClub(clubId: string): ClubMemberRecord[] {
    return [...this.members.values()]
      .filter((row) => row.clubId === clubId)
      .map((row) => this.cloneMember(row))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async create(input: CreateClubInput): Promise<ClubWithMembers> {
    const now = this.now();
    const club: ClubRecord = {
      id: this.nextId("club"),
      name: input.name,
      city: input.city,
      sport: input.sport,
      createdAt: now,
      updatedAt: now,
    };
    this.clubs.set(club.id, club);

    const owner: ClubMemberRecord = {
      id: this.nextId("club_member"),
      clubId: club.id,
      userId: input.ownerUserId,
      role: "owner",
      createdAt: now,
    };
    this.members.set(owner.id, owner);

    return {
      ...this.cloneClub(club),
      members: [this.cloneMember(owner)],
    };
  }

  async findById(id: string): Promise<ClubWithMembers | null> {
    const club = this.clubs.get(id);
    if (!club) return null;
    return {
      ...this.cloneClub(club),
      members: this.membersForClub(id),
    };
  }

  async list(options: { limit?: number } = {}): Promise<ClubSummary[]> {
    const limit = options.limit ?? 50;
    return [...this.clubs.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((club) => ({
        ...this.cloneClub(club),
        memberCount: this.membersForClub(club.id).length,
      }));
  }

  async listForUser(userId: string): Promise<ClubSummaryForUser[]> {
    const mine = [...this.members.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const out: ClubSummaryForUser[] = [];
    for (const membership of mine) {
      const club = this.clubs.get(membership.clubId);
      if (!club) continue;
      out.push({
        ...this.cloneClub(club),
        memberCount: this.membersForClub(club.id).length,
        role: membership.role,
        joinedAt: membership.createdAt,
      });
    }
    return out;
  }

  async findMembership(
    clubId: string,
    userId: string,
  ): Promise<ClubMemberRecord | null> {
    for (const row of this.members.values()) {
      if (row.clubId === clubId && row.userId === userId) {
        return this.cloneMember(row);
      }
    }
    return null;
  }

  async addMember(
    clubId: string,
    userId: string,
    role: ClubMemberRole = "member",
  ): Promise<ClubMemberRecord> {
    const existing = await this.findMembership(clubId, userId);
    if (existing) return existing;

    const row: ClubMemberRecord = {
      id: this.nextId("club_member"),
      clubId,
      userId,
      role,
      createdAt: this.now(),
    };
    this.members.set(row.id, row);
    return this.cloneMember(row);
  }

  async removeMember(clubId: string, userId: string): Promise<boolean> {
    for (const [id, row] of this.members) {
      if (row.clubId === clubId && row.userId === userId) {
        this.members.delete(id);
        return true;
      }
    }
    return false;
  }

  async countOwners(clubId: string): Promise<number> {
    let count = 0;
    for (const row of this.members.values()) {
      if (row.clubId === clubId && row.role === "owner") count += 1;
    }
    return count;
  }
}
