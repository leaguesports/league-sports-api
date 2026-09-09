import { DomainError } from "../../../lib/domain-error";
import { TeamSport } from "../../teams/entities/team-sport";
import { OptionalStartsAt } from "./optional-starts-at";
import { OptionalVenueCmsId } from "./optional-venue-cms-id";
import { TeamMatch } from "./team-match";
import { TeamMatchAlreadyAcceptedError } from "./team-match-already-accepted-error";
import { TeamMatchChallengeToken } from "./team-match-challenge-token";
import { TeamMatchNotReadyError } from "./team-match-not-ready-error";
import { TeamMatchScorecard } from "./team-match-scorecard";
import { TeamMatchStatus } from "./team-match-status";

function targeted() {
  return TeamMatch.create({
    homeTeamId: "team-a",
    awayTeamId: "team-b",
    sport: TeamSport.PADEL,
    createdBy: "user-a",
    venueCmsId: OptionalVenueCmsId.from("sanity-court-1"),
  });
}

describe("team match value objects", () => {
  test("status is a closed enum", () => {
    expect(TeamMatchStatus.from("pending").isPending).toBe(true);
    expect(TeamMatchStatus.from("scheduled").isOpen).toBe(true);
    expect(() => TeamMatchStatus.from("open")).toThrow(DomainError);
  });

  test("challenge token is 32 hex chars", () => {
    const token = TeamMatchChallengeToken.generate();
    expect(token.value).toHaveLength(32);
    expect(TeamMatchChallengeToken.from(token.value).equals(token)).toBe(true);
    expect(() => TeamMatchChallengeToken.from("nope")).toThrow(DomainError);
  });
});

describe(TeamMatch, () => {
  test("targeted create is pending with both sides and no token", () => {
    const match = targeted();
    const snapshot = match.toSnapshot();
    expect(snapshot).toMatchObject({
      homeTeamId: "team-a",
      awayTeamId: "team-b",
      sport: "padel",
      status: "pending",
      venueCmsId: "sanity-court-1",
      challengeToken: null,
      createdBy: "user-a",
    });
    expect(match.homeLineup().isEmpty).toBe(true);
  });

  test("open challenge mints a token and leaves away empty", () => {
    const match = TeamMatch.create({
      homeTeamId: "team-a",
      sport: TeamSport.GOLF,
      createdBy: "user-a",
      generateChallengeLink: true,
    });
    expect(match.awayTeamId).toBeNull();
    expect(match.challengeToken?.value).toHaveLength(32);
    expect(match.status.isPending).toBe(true);
  });

  test("cannot challenge the same team", () => {
    expect(() =>
      TeamMatch.create({
        homeTeamId: "team-a",
        awayTeamId: "team-a",
        sport: TeamSport.DARTS,
        createdBy: "user-a",
      }),
    ).toThrow(DomainError);
  });

  test("accept moves to scheduled; decline and cancel are terminal", () => {
    const accepted = targeted();
    accepted.accept("team-b");
    expect(accepted.status.isScheduled).toBe(true);

    const declined = targeted();
    declined.decline();
    expect(declined.status.isDeclined).toBe(true);
    expect(() => declined.accept("team-b")).toThrow(DomainError);

    const cancelled = targeted();
    cancelled.cancel();
    expect(cancelled.status.isCancelled).toBe(true);
    expect(() => cancelled.setLineup("team-a", ["u1", "u2"])).toThrow(
      DomainError,
    );
  });

  test("cannot accept a different away team", () => {
    const match = targeted();
    expect(() => match.accept("team-c")).toThrow(TeamMatchAlreadyAcceptedError);
  });

  test("join via token attaches away and schedules", () => {
    const match = TeamMatch.create({
      homeTeamId: "team-a",
      sport: TeamSport.DARTS,
      createdBy: "user-a",
      generateChallengeLink: true,
    });
    match.joinWithToken(match.challengeToken!, "team-b");
    expect(match.awayTeamId).toBe("team-b");
    expect(match.status.isScheduled).toBe(true);
    expect(() => match.joinWithToken(match.challengeToken!, "team-c")).toThrow(
      TeamMatchAlreadyAcceptedError,
    );
  });

  test("lineup must match sport player count", () => {
    const match = targeted();
    expect(() => match.setLineup("team-a", ["u1"])).toThrow(DomainError);
    match.setLineup("team-a", ["u1", "u2"]);
    expect(match.homeLineup().userIds).toEqual(["u1", "u2"]);
    expect(() => match.setLineup("team-c", ["u3", "u4"])).toThrow(DomainError);
  });

  test("cannot start until accepted and both lineups are valid", () => {
    const match = targeted();
    match.setLineup("team-a", ["a1", "a2"]);
    expect(() => match.assertCanStart()).toThrow(TeamMatchNotReadyError);
    match.accept("team-b");
    expect(() => match.assertCanStart()).toThrow(TeamMatchNotReadyError);
    match.setLineup("team-b", ["b1", "b2"]);
    match.assertCanStart();

    const scorecard = TeamMatchScorecard.from({
      sport: TeamSport.PADEL,
      id: "match-1",
    });
    match.start(scorecard);
    expect(match.status.isLive).toBe(true);
    expect(match.scorecard?.path).toBe("/padel/match-1");

    match.complete("team-a");
    expect(match.status.isCompleted).toBe(true);
    expect(match.winnerTeamId).toBe("team-a");
    expect(() => match.cancel()).toThrow(DomainError);
  });

  test("padel and golf require a venue to start", () => {
    const golf = TeamMatch.create({
      homeTeamId: "team-a",
      awayTeamId: "team-b",
      sport: TeamSport.GOLF,
      createdBy: "user-a",
    });
    golf.accept("team-b");
    golf.setLineup("team-a", ["a1"]);
    golf.setLineup("team-b", ["b1"]);
    expect(() => golf.assertCanStart()).toThrow(TeamMatchNotReadyError);
    golf.schedule({ venueCmsId: OptionalVenueCmsId.from("course-1") });
    golf.assertCanStart();
  });

  test("schedule and snapshot round-trip", () => {
    const match = targeted();
    match.schedule({
      startsAt: OptionalStartsAt.from("2026-09-08T10:00:00.000Z"),
    });
    const copy = TeamMatch.fromSnapshot(match.toSnapshot());
    expect(copy.toSnapshot()).toEqual(match.toSnapshot());
  });
});
