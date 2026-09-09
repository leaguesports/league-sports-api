import { DomainError } from "../../../lib/domain-error";
import { TeamSport } from "../../teams/entities/team-sport";
import { seedPositions } from "./bracket";
import { Tournament } from "./tournament";
import { TournamentForbiddenError } from "./tournament-forbidden-error";
import { TournamentFullError } from "./tournament-full-error";
import { TournamentInviteToken } from "./tournament-invite-token";
import { TournamentName } from "./tournament-name";
import { TournamentNotReadyError } from "./tournament-not-ready-error";
import { TournamentSize } from "./tournament-size";
import { TournamentStatus } from "./tournament-status";

function draft(size: 4 | 8 | 16 = 4) {
  return Tournament.create({
    name: TournamentName.from("Sunday Cup"),
    sport: TeamSport.PADEL,
    size: TournamentSize.from(size),
    organizerUserId: "user-org",
  });
}

function fillAccepted(tournament: Tournament, count: number) {
  for (let i = 1; i <= count; i++) {
    tournament.registerAccepted(`team-${i}`, `captain-${i}`);
  }
}

describe("tournament value objects", () => {
  test("size is 4, 8, or 16", () => {
    expect(TournamentSize.from(4).totalSlots).toBe(3);
    expect(TournamentSize.from("8").firstRoundSlots).toBe(4);
    expect(TournamentSize.from(16).rounds).toBe(4);
    expect(() => TournamentSize.from(6)).toThrow(DomainError);
  });

  test("status is a closed enum", () => {
    expect(TournamentStatus.from("draft").isDraft).toBe(true);
    expect(() => TournamentStatus.from("open")).toThrow(DomainError);
  });

  test("invite token is 32 hex chars", () => {
    const token = TournamentInviteToken.generate();
    expect(token.value).toHaveLength(32);
    expect(TournamentInviteToken.from(token.value).equals(token)).toBe(true);
    expect(() => TournamentInviteToken.from("nope")).toThrow(DomainError);
  });

  test("standard seed order places 1 vs size in the first slot", () => {
    expect(seedPositions(TournamentSize.FOUR)).toEqual([1, 4, 2, 3]);
    expect(seedPositions(TournamentSize.EIGHT)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe(Tournament, () => {
  test("create is a draft owned by the organizer", () => {
    const tournament = draft();
    const snapshot = tournament.toSnapshot();
    expect(snapshot).toMatchObject({
      name: "Sunday Cup",
      sport: "padel",
      size: 4,
      status: "draft",
      organizerUserId: "user-org",
      winnerTeamId: null,
    });
    expect(snapshot.inviteToken).toHaveLength(32);
    expect(snapshot.registrations).toEqual([]);
    expect(snapshot.slots).toEqual([]);
  });

  test("only the organizer can edit a draft or open registration", () => {
    const tournament = draft();
    expect(() =>
      tournament.updateDetails("user-z", { name: TournamentName.from("Nope") }),
    ).toThrow(TournamentForbiddenError);
    expect(() => tournament.openRegistration("user-z")).toThrow(
      TournamentForbiddenError,
    );

    tournament.updateDetails("user-org", { name: TournamentName.from("Renamed") });
    tournament.openRegistration("user-org");
    expect(tournament.status.isRegistration).toBe(true);
    expect(() =>
      tournament.updateDetails("user-org", { name: TournamentName.from("Later") }),
    ).toThrow(DomainError);
  });

  test("cannot generate a draw until the field is full", () => {
    const tournament = draft();
    tournament.openRegistration("user-org");
    fillAccepted(tournament, 3);
    expect(() => tournament.generateDraw("user-org")).toThrow(
      TournamentNotReadyError,
    );

    tournament.registerAccepted("team-4", "captain-4");
    tournament.generateDraw("user-org", (items) => items);
    expect(tournament.status.isActive).toBe(true);
    expect(tournament.slots).toHaveLength(3);
    expect(tournament.slots.filter((slot) => slot.round === 1)).toHaveLength(2);
    for (const slot of tournament.slots.filter((slot) => slot.round === 1)) {
      expect(slot.isReady).toBe(true);
      expect(slot.homeTeamId).not.toBe(slot.awayTeamId);
    }
  });

  test("cannot register after the draw and cannot overfill", () => {
    const tournament = draft();
    tournament.openRegistration("user-org");
    fillAccepted(tournament, 4);
    expect(() => tournament.registerAccepted("team-5", "captain-5")).toThrow(
      TournamentFullError,
    );
    tournament.generateDraw("user-org", (items) => items);
    expect(() => tournament.registerAccepted("team-5", "captain-5")).toThrow(
      DomainError,
    );
    expect(() => tournament.withdrawRegistration("team-1")).toThrow(DomainError);
  });

  test("withdraw before the draw frees a spot", () => {
    const tournament = draft();
    tournament.openRegistration("user-org");
    fillAccepted(tournament, 4);
    tournament.withdrawRegistration("team-4");
    expect(tournament.acceptedCount).toBe(3);
    tournament.registerAccepted("team-5", "captain-5");
    expect(tournament.acceptedCount).toBe(4);
  });

  test("starting a fixture creates a link; complete advances; final sets winner", () => {
    const tournament = draft();
    tournament.openRegistration("user-org");
    fillAccepted(tournament, 4);
    tournament.generateDraw("user-org", (items) => items);

    const firstRound = tournament.slots.filter((slot) => slot.round === 1);
    const final = tournament.slots.find((slot) => slot.round === 2);
    expect(final).toBeDefined();

    tournament.attachFixture(firstRound[0].id, "match-1");
    tournament.attachFixture(firstRound[1].id, "match-2");
    expect(() => tournament.attachFixture(firstRound[0].id, "match-other")).toThrow(
      DomainError,
    );

    tournament.advanceFromMatch("match-1", firstRound[0].homeTeamId!);
    tournament.advanceFromMatch("match-2", firstRound[1].homeTeamId!);
    expect(final!.isReady).toBe(true);
    expect(final!.homeTeamId).toBe(firstRound[0].homeTeamId);
    expect(final!.awayTeamId).toBe(firstRound[1].homeTeamId);

    tournament.attachFixture(final!.id, "match-final");
    tournament.advanceFromMatch("match-final", final!.homeTeamId!);
    expect(tournament.status.isCompleted).toBe(true);
    expect(tournament.winnerTeamId).toBe(final!.homeTeamId);
  });

  test("cannot delete after registration opens", () => {
    const tournament = draft();
    tournament.assertCanDelete("user-org");
    tournament.openRegistration("user-org");
    expect(() => tournament.assertCanDelete("user-org")).toThrow(DomainError);
  });

  test("round-trips through a snapshot", () => {
    const tournament = draft();
    tournament.openRegistration("user-org");
    fillAccepted(tournament, 4);
    tournament.generateDraw("user-org", (items) => items);
    const copy = Tournament.fromSnapshot(tournament.toSnapshot());
    expect(copy.toSnapshot()).toEqual(tournament.toSnapshot());
  });
});
