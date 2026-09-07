import { DomainError } from "../../../lib/domain-error";
import { CmsId } from "../../venue/entities/cms-id";
import { InviteToken } from "./invite-token";
import { OrganisedGame } from "./organised-game";
import { OrganisedGameCapacity } from "./organised-game-capacity";
import { OrganisedGameCapacityError } from "./organised-game-capacity-error";
import { OrganisedGameForbiddenError } from "./organised-game-forbidden-error";
import { OrganisedGameNotOpenError } from "./organised-game-not-open-error";
import { OrganisedGameNotes } from "./organised-game-notes";
import { OrganisedGameRsvp } from "./organised-game-rsvp";
import { OrganisedGameSport } from "./organised-game-sport";
import { OrganisedGameStartWindowError } from "./organised-game-start-window-error";
import { OrganisedGameStatus } from "./organised-game-status";
import { StartsAt } from "./starts-at";

function createOpenGame(overrides: { startsAt?: string } = {}) {
  return OrganisedGame.create({
    hostUserId: "host-1",
    sport: OrganisedGameSport.from("padel"),
    venueCmsId: CmsId.from("sanity-court-1"),
    startsAt: StartsAt.from(overrides.startsAt ?? "2026-09-07T18:00:00.000Z"),
    notes: OrganisedGameNotes.from("Sunday hit"),
    capacity: OrganisedGameCapacity.from(4, 4),
  });
}

describe("organised game value objects", () => {
  test("sport is padel or golf", () => {
    expect(OrganisedGameSport.from("Padel").value).toBe("padel");
    expect(OrganisedGameSport.from("golf").livePath("abc")).toBe("/golf/abc");
    expect(() => OrganisedGameSport.from("darts")).toThrow(DomainError);
  });

  test("status and rsvp are closed sets", () => {
    expect(OrganisedGameStatus.from("open").isOpen).toBe(true);
    expect(() => OrganisedGameStatus.from("live")).toThrow(DomainError);
    expect(OrganisedGameRsvp.fromDecision("accepted").isAccepted).toBe(true);
    expect(() => OrganisedGameRsvp.fromDecision("pending")).toThrow(
      DomainError,
    );
  });

  test("notes trim, omit blanks, and cap length", () => {
    expect(OrganisedGameNotes.from("  hi  ")?.value).toBe("hi");
    expect(OrganisedGameNotes.from("  ")).toBeNull();
    expect(() => OrganisedGameNotes.from("x".repeat(281))).toThrow(DomainError);
  });

  test("capacity is 2–8", () => {
    expect(OrganisedGameCapacity.from(undefined, 4).value).toBe(4);
    expect(() => OrganisedGameCapacity.from(1, 4)).toThrow(DomainError);
    expect(() => OrganisedGameCapacity.from(9, 4)).toThrow(DomainError);
  });
});

describe(OrganisedGame, () => {
  test("create mints an unguessable invite token and starts open", () => {
    const game = createOpenGame();
    const snapshot = game.toSnapshot();

    expect(game.id).toBeTruthy();
    expect(snapshot).toMatchObject({
      hostUserId: "host-1",
      sport: "padel",
      status: "open",
      venueCmsId: "sanity-court-1",
      notes: "Sunday hit",
      capacity: 4,
      live: null,
    });
    expect(snapshot.inviteToken).toHaveLength(32);
    expect(game.invites).toHaveLength(0);
    expect(game.occupiedCount()).toBe(1);
  });

  test("invite is idempotent, rejects host, and respects capacity", () => {
    const game = createOpenGame();
    game.addInvitee("friend-a");
    game.addInvitee("  friend-a  ");
    expect(game.invites).toHaveLength(1);

    expect(() => game.addInvitee("host-1")).toThrow(DomainError);

    game.addInvitee("friend-b");
    game.addInvitee("friend-c");
    expect(game.isAtCapacity()).toBe(true);
    expect(() => game.addInvitee("friend-d")).toThrow(
      OrganisedGameCapacityError,
    );

    game.rsvp("friend-c", OrganisedGameRsvp.fromDecision("declined"));
    expect(game.isAtCapacity()).toBe(false);
    game.addInvitee("friend-d");
    expect(game.inviteOf("friend-d")?.rsvp.isPending).toBe(true);
  });

  test("only an invitee can RSVP; host without an invite cannot", () => {
    const game = createOpenGame();
    expect(() =>
      game.rsvp("host-1", OrganisedGameRsvp.fromDecision("accepted")),
    ).toThrow(OrganisedGameForbiddenError);

    game.addInvitee("friend-a");
    game.rsvp("friend-a", OrganisedGameRsvp.fromDecision("accepted"));
    expect(game.inviteOf("friend-a")?.rsvp.isAccepted).toBe(true);
    expect(game.inviteOf("friend-a")?.respondedAt).toBeTruthy();
  });

  test("start is host-windowed and idempotent once live", () => {
    const startsAt = new Date("2026-09-07T18:00:00.000Z");
    const game = createOpenGame({ startsAt: startsAt.toISOString() });

    expect(() =>
      game.start(
        { id: "match-1", path: "/padel/match-1" },
        new Date(startsAt.getTime() - 13 * 60 * 60 * 1000),
      ),
    ).toThrow(OrganisedGameStartWindowError);

    game.start(
      { id: "match-1", path: "/padel/match-1" },
      new Date(startsAt.getTime() - 60 * 60 * 1000),
    );
    expect(game.status.isStarted).toBe(true);
    expect(game.live).toEqual({ id: "match-1", path: "/padel/match-1" });

    game.start(
      { id: "match-2", path: "/padel/match-2" },
      new Date(startsAt.getTime()),
    );
    expect(game.live?.id).toBe("match-1");
  });

  test("cancel and start require open status", () => {
    const game = createOpenGame();
    game.cancel();
    expect(game.status.isCancelled).toBe(true);
    expect(() => game.addInvitee("friend-a")).toThrow(OrganisedGameNotOpenError);
    expect(() => game.cancel()).toThrow(OrganisedGameNotOpenError);
  });

  test("fromSnapshot round-trips", () => {
    const game = createOpenGame();
    game.addInvitee("friend-a");
    const copy = OrganisedGame.fromSnapshot(game.toSnapshot());
    expect(copy.toSnapshot()).toEqual(game.toSnapshot());
  });
});
