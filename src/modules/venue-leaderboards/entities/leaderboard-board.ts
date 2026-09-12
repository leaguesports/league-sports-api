import { DomainError } from "../../../lib/domain-error";

export const LEADERBOARD_BOARDS = ["records", "potm", "grinder", "streak"] as const;

export type LeaderboardBoardId = (typeof LEADERBOARD_BOARDS)[number];

export class LeaderboardBoard {
  static readonly records = new LeaderboardBoard("records");
  static readonly potm = new LeaderboardBoard("potm");
  static readonly grinder = new LeaderboardBoard("grinder");
  static readonly streak = new LeaderboardBoard("streak");

  private constructor(readonly value: LeaderboardBoardId) {}

  static from(raw: unknown): LeaderboardBoard {
    if (raw === "records") return LeaderboardBoard.records;
    if (raw === "potm") return LeaderboardBoard.potm;
    if (raw === "grinder") return LeaderboardBoard.grinder;
    if (raw === "streak") return LeaderboardBoard.streak;
    throw new DomainError("board must be records, potm, grinder, or streak");
  }

  get defaultWindow(): "month" | "all" {
    return this.value === "potm" || this.value === "grinder" ? "month" : "all";
  }

  usesWindowQuery(): boolean {
    return this.value === "grinder";
  }

  equals(other: LeaderboardBoard): boolean {
    return this.value === other.value;
  }
}
