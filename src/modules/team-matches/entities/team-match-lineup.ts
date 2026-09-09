import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { TeamSport } from "../../teams/entities/team-sport";

export const LINEUP_RULES: Record<
  "padel" | "golf" | "darts",
  { min: number; max: number }
> = {
  padel: { min: 2, max: 2 },
  golf: { min: 1, max: 2 },
  darts: { min: 1, max: 1 },
};

export type TeamMatchLineupSnapshot = {
  teamId: string;
  userIds: string[];
};

export class TeamMatchLineup {
  private constructor(
    readonly teamId: string,
    readonly userIds: readonly string[],
  ) {}

  static from(teamId: string, userIds: unknown, sport: TeamSport): TeamMatchLineup {
    const id = requiredTrimmed(teamId, "teamId");
    const ids = parseUserIds(userIds);
    const rule = LINEUP_RULES[sport.value];
    if (ids.length < rule.min || ids.length > rule.max) {
      throw new DomainError(
        `${sport.value} lineup must include ${describeRule(rule)} player(s)`,
      );
    }
    return new TeamMatchLineup(id, ids);
  }

  static empty(teamId: string): TeamMatchLineup {
    return new TeamMatchLineup(requiredTrimmed(teamId, "teamId"), []);
  }

  static rehydrate(teamId: string, userIds: string[]): TeamMatchLineup {
    return new TeamMatchLineup(teamId, [...userIds]);
  }

  get isEmpty(): boolean {
    return this.userIds.length === 0;
  }

  includes(userId: string): boolean {
    return this.userIds.includes(userId);
  }

  isValidFor(sport: TeamSport): boolean {
    const rule = LINEUP_RULES[sport.value];
    return this.userIds.length >= rule.min && this.userIds.length <= rule.max;
  }

  toSnapshot(): TeamMatchLineupSnapshot {
    return { teamId: this.teamId, userIds: [...this.userIds] };
  }
}

function parseUserIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new DomainError("userIds is required");
  }
  const ids: string[] = [];
  for (const item of raw) {
    const id = requiredTrimmed(item, "userId");
    if (ids.includes(id)) {
      throw new DomainError("lineup userIds must be unique");
    }
    ids.push(id);
  }
  return ids;
}

function describeRule(rule: { min: number; max: number }): string {
  return rule.min === rule.max ? `${rule.min}` : `${rule.min}–${rule.max}`;
}
