import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { TeamSport } from "../../teams/entities/team-sport";

export type TeamMatchScorecardSnapshot = {
  sport: "padel" | "golf" | "darts";
  id: string;
  path: string;
};

export class TeamMatchScorecard {
  private constructor(
    readonly sport: TeamSport,
    readonly id: string,
    readonly path: string,
  ) {}

  static from(props: {
    sport: TeamSport;
    id: string;
    path?: string;
  }): TeamMatchScorecard {
    const id = requiredTrimmed(props.id, "scorecard id");
    const path = props.path?.trim() || livePath(props.sport, id);
    return new TeamMatchScorecard(props.sport, id, path);
  }

  static rehydrate(snapshot: TeamMatchScorecardSnapshot): TeamMatchScorecard {
    return new TeamMatchScorecard(
      TeamSport.from(snapshot.sport),
      snapshot.id,
      snapshot.path,
    );
  }

  toSnapshot(): TeamMatchScorecardSnapshot {
    return {
      sport: this.sport.value,
      id: this.id,
      path: this.path,
    };
  }
}

export function livePath(sport: TeamSport, id: string): string {
  if (sport.value === "padel") return `/padel/${id}`;
  if (sport.value === "golf") return `/golf/${id}`;
  if (sport.value === "darts") return `/darts/${id}`;
  throw new DomainError("unsupported scorecard sport");
}
