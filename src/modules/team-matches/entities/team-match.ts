import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { TeamSport } from "../../teams/entities/team-sport";
import { OptionalStartsAt } from "./optional-starts-at";
import { OptionalVenueCmsId } from "./optional-venue-cms-id";
import { TeamMatchAlreadyAcceptedError } from "./team-match-already-accepted-error";
import { TeamMatchChallengeToken } from "./team-match-challenge-token";
import { TeamMatchLineup } from "./team-match-lineup";
import { TeamMatchNotReadyError } from "./team-match-not-ready-error";
import { TeamMatchScorecard } from "./team-match-scorecard";
import { TeamMatchStatus, TeamMatchStatusValue } from "./team-match-status";

export type TeamMatchSnapshot = {
  id: string;
  homeTeamId: string;
  awayTeamId: string | null;
  sport: "padel" | "golf" | "darts";
  status: TeamMatchStatusValue;
  venueCmsId: string | null;
  startsAt: string | null;
  challengeToken: string | null;
  createdBy: string;
  winnerTeamId: string | null;
  scorecard: ReturnType<TeamMatchScorecard["toSnapshot"]> | null;
  createdAt: string;
  updatedAt: string;
  lineups: ReturnType<TeamMatchLineup["toSnapshot"]>[];
};

export type CreateTeamMatchProps = {
  homeTeamId: string;
  awayTeamId?: string | null;
  sport: TeamSport;
  createdBy: string;
  venueCmsId?: OptionalVenueCmsId;
  startsAt?: OptionalStartsAt;
  generateChallengeLink?: boolean;
};

export class TeamMatch {
  private constructor(
    readonly id: string,
    readonly homeTeamId: string,
    private awayTeamIdValue: string | null,
    readonly sport: TeamSport,
    private statusValue: TeamMatchStatus,
    private venueCmsIdValue: OptionalVenueCmsId,
    private startsAtValue: OptionalStartsAt,
    private challengeTokenValue: TeamMatchChallengeToken | null,
    readonly createdBy: string,
    private winnerTeamIdValue: string | null,
    private scorecardValue: TeamMatchScorecard | null,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private lineupsValue: Map<string, TeamMatchLineup>,
  ) {}

  static create(props: CreateTeamMatchProps): TeamMatch {
    const homeTeamId = requiredTrimmed(props.homeTeamId, "homeTeamId");
    const createdBy = requiredTrimmed(props.createdBy, "userId");
    const awayTeamId = props.awayTeamId
      ? requiredTrimmed(props.awayTeamId, "awayTeamId")
      : null;

    if (awayTeamId && awayTeamId === homeTeamId) {
      throw new DomainError("Cannot challenge the same team");
    }

    const openLink = props.generateChallengeLink === true || awayTeamId === null;
    if (!openLink && !awayTeamId) {
      throw new DomainError("awayTeamId or generateChallengeLink is required");
    }

    const now = new Date();
    const lineups = new Map<string, TeamMatchLineup>([
      [homeTeamId, TeamMatchLineup.empty(homeTeamId)],
    ]);
    if (awayTeamId) {
      lineups.set(awayTeamId, TeamMatchLineup.empty(awayTeamId));
    }

    return new TeamMatch(
      randomUUID(),
      homeTeamId,
      awayTeamId,
      props.sport,
      TeamMatchStatus.PENDING,
      props.venueCmsId ?? OptionalVenueCmsId.from(null),
      props.startsAt ?? OptionalStartsAt.from(null),
      openLink ? TeamMatchChallengeToken.generate() : null,
      createdBy,
      null,
      null,
      now,
      now,
      lineups,
    );
  }

  static rehydrate(props: {
    id: string;
    homeTeamId: string;
    awayTeamId: string | null;
    sport: TeamSport;
    status: TeamMatchStatus;
    venueCmsId: OptionalVenueCmsId;
    startsAt: OptionalStartsAt;
    challengeToken: TeamMatchChallengeToken | null;
    createdBy: string;
    winnerTeamId: string | null;
    scorecard: TeamMatchScorecard | null;
    createdAt: Date;
    updatedAt: Date;
    lineups: TeamMatchLineup[];
  }): TeamMatch {
    const lineups = new Map<string, TeamMatchLineup>();
    for (const lineup of props.lineups) {
      lineups.set(lineup.teamId, lineup);
    }
    if (!lineups.has(props.homeTeamId)) {
      lineups.set(props.homeTeamId, TeamMatchLineup.empty(props.homeTeamId));
    }
    if (props.awayTeamId && !lineups.has(props.awayTeamId)) {
      lineups.set(props.awayTeamId, TeamMatchLineup.empty(props.awayTeamId));
    }
    return new TeamMatch(
      props.id,
      props.homeTeamId,
      props.awayTeamId,
      props.sport,
      props.status,
      props.venueCmsId,
      props.startsAt,
      props.challengeToken,
      props.createdBy,
      props.winnerTeamId,
      props.scorecard,
      props.createdAt,
      props.updatedAt,
      lineups,
    );
  }

  static fromSnapshot(snapshot: TeamMatchSnapshot): TeamMatch {
    return TeamMatch.rehydrate({
      id: snapshot.id,
      homeTeamId: snapshot.homeTeamId,
      awayTeamId: snapshot.awayTeamId,
      sport: TeamSport.from(snapshot.sport),
      status: TeamMatchStatus.from(snapshot.status),
      venueCmsId: OptionalVenueCmsId.from(snapshot.venueCmsId),
      startsAt: OptionalStartsAt.from(snapshot.startsAt),
      challengeToken: snapshot.challengeToken
        ? TeamMatchChallengeToken.from(snapshot.challengeToken)
        : null,
      createdBy: snapshot.createdBy,
      winnerTeamId: snapshot.winnerTeamId,
      scorecard: snapshot.scorecard
        ? TeamMatchScorecard.rehydrate(snapshot.scorecard)
        : null,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
      lineups: snapshot.lineups.map((lineup) =>
        TeamMatchLineup.rehydrate(lineup.teamId, lineup.userIds),
      ),
    });
  }

  get awayTeamId(): string | null {
    return this.awayTeamIdValue;
  }

  get status(): TeamMatchStatus {
    return this.statusValue;
  }

  get venueCmsId(): string | null {
    return this.venueCmsIdValue.value;
  }

  get startsAt(): Date | null {
    return this.startsAtValue.value;
  }

  get challengeToken(): TeamMatchChallengeToken | null {
    return this.challengeTokenValue;
  }

  get winnerTeamId(): string | null {
    return this.winnerTeamIdValue;
  }

  get scorecard(): TeamMatchScorecard | null {
    return this.scorecardValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get teamIds(): string[] {
    return this.awayTeamIdValue
      ? [this.homeTeamId, this.awayTeamIdValue]
      : [this.homeTeamId];
  }

  lineupOf(teamId: string): TeamMatchLineup {
    return (
      this.lineupsValue.get(teamId) ?? TeamMatchLineup.empty(teamId)
    );
  }

  homeLineup(): TeamMatchLineup {
    return this.lineupOf(this.homeTeamId);
  }

  awayLineup(): TeamMatchLineup | null {
    if (!this.awayTeamIdValue) return null;
    return this.lineupOf(this.awayTeamIdValue);
  }

  isHome(teamId: string): boolean {
    return teamId === this.homeTeamId;
  }

  isAway(teamId: string): boolean {
    return this.awayTeamIdValue !== null && teamId === this.awayTeamIdValue;
  }

  involvesTeam(teamId: string): boolean {
    return this.isHome(teamId) || this.isAway(teamId);
  }

  isLineupMember(userId: string): boolean {
    for (const lineup of this.lineupsValue.values()) {
      if (lineup.includes(userId)) return true;
    }
    return false;
  }

  schedule(details: {
    startsAt?: OptionalStartsAt;
    venueCmsId?: OptionalVenueCmsId;
  }): void {
    this.assertBeforeStart();
    if (!details.startsAt && !details.venueCmsId) {
      throw new DomainError("At least one field is required");
    }
    if (details.startsAt) this.startsAtValue = details.startsAt;
    if (details.venueCmsId) this.venueCmsIdValue = details.venueCmsId;
    this.touch();
  }

  setLineup(teamId: string, userIds: unknown): void {
    this.assertBeforeStart();
    const id = requiredTrimmed(teamId, "teamId");
    if (!this.involvesTeam(id)) {
      throw new DomainError("Team is not part of this match");
    }
    this.lineupsValue.set(id, TeamMatchLineup.from(id, userIds, this.sport));
    this.touch();
  }

  accept(awayTeamId: string): void {
    const id = requiredTrimmed(awayTeamId, "awayTeamId");
    if (this.statusValue.isDeclined) {
      throw new DomainError("Challenge was declined");
    }
    if (this.statusValue.isCancelled) {
      throw new DomainError("Challenge was cancelled");
    }
    if (this.statusValue.hasStarted) {
      throw new TeamMatchAlreadyAcceptedError();
    }
    if (this.awayTeamIdValue && this.awayTeamIdValue !== id) {
      throw new TeamMatchAlreadyAcceptedError();
    }
    if (id === this.homeTeamId) {
      throw new DomainError("Cannot accept your own challenge");
    }
    if (this.statusValue.isScheduled && this.awayTeamIdValue === id) {
      return;
    }
    this.awayTeamIdValue = id;
    if (!this.lineupsValue.has(id)) {
      this.lineupsValue.set(id, TeamMatchLineup.empty(id));
    }
    this.statusValue = TeamMatchStatus.SCHEDULED;
    this.touch();
  }

  joinWithToken(token: TeamMatchChallengeToken, awayTeamId: string): void {
    if (
      !this.challengeTokenValue ||
      !this.challengeTokenValue.equals(token)
    ) {
      throw new DomainError("token is invalid");
    }
    if (this.awayTeamIdValue) {
      throw new TeamMatchAlreadyAcceptedError();
    }
    this.accept(awayTeamId);
  }

  decline(): void {
    if (!this.statusValue.isPending) {
      throw new DomainError("Only a pending challenge can be declined");
    }
    if (!this.awayTeamIdValue) {
      throw new DomainError("Open challenges cannot be declined");
    }
    this.statusValue = TeamMatchStatus.DECLINED;
    this.touch();
  }

  cancel(): void {
    if (this.statusValue.hasStarted || this.statusValue.isTerminal) {
      throw new DomainError("Cannot cancel after the match has started");
    }
    this.statusValue = TeamMatchStatus.CANCELLED;
    this.touch();
  }

  assertCanStart(): void {
    if (this.statusValue.isLive && this.scorecardValue) {
      return;
    }
    if (!this.statusValue.isScheduled && !this.statusValue.isPending) {
      throw new TeamMatchNotReadyError("Match cannot be started in this status");
    }
    if (!this.awayTeamIdValue) {
      throw new TeamMatchNotReadyError("Opponent has not joined yet");
    }
    if (this.statusValue.isPending) {
      throw new TeamMatchNotReadyError("Challenge has not been accepted");
    }
    const home = this.homeLineup();
    const away = this.awayLineup();
    if (!home.isValidFor(this.sport) || !away?.isValidFor(this.sport)) {
      throw new TeamMatchNotReadyError(
        `Both teams need a valid ${this.sport.value} lineup`,
      );
    }
    if (this.sport.value === "golf" && home.userIds.length !== away.userIds.length) {
      throw new TeamMatchNotReadyError("Golf lineups must be the same size");
    }
    if (this.sport.value !== "darts" && !this.venueCmsIdValue.value) {
      throw new TeamMatchNotReadyError("venueCmsId is required to start");
    }
  }

  start(scorecard: TeamMatchScorecard): void {
    if (this.statusValue.isLive && this.scorecardValue) {
      return;
    }
    this.assertCanStart();
    if (!scorecard.sport.equals(this.sport)) {
      throw new DomainError("Scorecard sport must match the team match");
    }
    this.scorecardValue = scorecard;
    this.statusValue = TeamMatchStatus.LIVE;
    if (!this.startsAtValue.isSet) {
      this.startsAtValue = OptionalStartsAt.from(new Date());
    }
    this.touch();
  }

  complete(winnerTeamId: string | null): void {
    if (this.statusValue.isCompleted) {
      if (this.winnerTeamIdValue === winnerTeamId) return;
      throw new DomainError("Match is already completed");
    }
    if (!this.statusValue.isLive) {
      throw new DomainError("Only a live match can be completed");
    }
    if (winnerTeamId !== null) {
      const id = requiredTrimmed(winnerTeamId, "winnerTeamId");
      if (!this.involvesTeam(id)) {
        throw new DomainError("winnerTeamId must be home or away");
      }
      this.winnerTeamIdValue = id;
    } else {
      this.winnerTeamIdValue = null;
    }
    this.statusValue = TeamMatchStatus.COMPLETED;
    this.touch();
  }

  toSnapshot(): TeamMatchSnapshot {
    const lineups = [...this.lineupsValue.values()].map((lineup) =>
      lineup.toSnapshot(),
    );
    return {
      id: this.id,
      homeTeamId: this.homeTeamId,
      awayTeamId: this.awayTeamIdValue,
      sport: this.sport.value,
      status: this.statusValue.value,
      venueCmsId: this.venueCmsIdValue.value,
      startsAt: this.startsAtValue.toIsoString(),
      challengeToken: this.challengeTokenValue?.value ?? null,
      createdBy: this.createdBy,
      winnerTeamId: this.winnerTeamIdValue,
      scorecard: this.scorecardValue?.toSnapshot() ?? null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAtValue.toISOString(),
      lineups,
    };
  }

  private assertBeforeStart(): void {
    if (this.statusValue.hasStarted || this.statusValue.isTerminal) {
      throw new DomainError("Cannot change a match after it has started");
    }
  }

  private touch(now = new Date()): void {
    this.updatedAtValue = now;
  }
}
