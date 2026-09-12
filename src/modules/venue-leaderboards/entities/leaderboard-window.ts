import { DomainError } from "../../../lib/domain-error";
import { currentJohannesburgYearMonth, isJohannesburgYearMonth } from "./johannesburg-calendar";
import { LeaderboardBoard } from "./leaderboard-board";

export const LEADERBOARD_WINDOWS = ["month", "all"] as const;

export type LeaderboardWindowId = (typeof LEADERBOARD_WINDOWS)[number];

export class LeaderboardWindow {
  private constructor(
    readonly value: LeaderboardWindowId,
    readonly key: string,
  ) {}

  static all(): LeaderboardWindow {
    return new LeaderboardWindow("all", "all");
  }

  static month(yearMonth = currentJohannesburgYearMonth()): LeaderboardWindow {
    if (!isJohannesburgYearMonth(yearMonth)) {
      throw new DomainError("windowKey must be YYYY-MM");
    }
    return new LeaderboardWindow("month", yearMonth);
  }

  static fromQuery(
    board: LeaderboardBoard,
    raw: unknown,
    now = new Date(),
  ): LeaderboardWindow {
    if (raw !== undefined && raw !== "month" && raw !== "all") {
      throw new DomainError("window must be month or all");
    }

    if (board.value === "records" || board.value === "streak") {
      return LeaderboardWindow.all();
    }

    if (board.value === "potm") {
      return LeaderboardWindow.month(currentJohannesburgYearMonth(now));
    }

    if (raw === "all") {
      return LeaderboardWindow.all();
    }

    return LeaderboardWindow.month(currentJohannesburgYearMonth(now));
  }

  equals(other: LeaderboardWindow): boolean {
    return this.value === other.value && this.key === other.key;
  }
}
