import { City } from "./city";
import { LobbyOpenGame } from "./lobby-open-game";
import { LobbySport } from "./lobby-sport";
import { PartySize } from "./party-size";
import { TimeWindow } from "./time-window";

function makeOpenGame(overrides: { slotsNeeded?: number } = {}) {
  return LobbyOpenGame.create({
    hostUserId: "host-1",
    sport: LobbySport.PADEL,
    window: TimeWindow.from(
      "2026-09-08T16:00:00.000Z",
      "2026-09-08T18:00:00.000Z",
    ),
    city: City.from("Cape Town"),
    area: null,
    venueCmsId: "sanity-court-1",
    slotsNeeded: overrides.slotsNeeded ?? 4,
    hostPartySize: PartySize.from(1),
    skill: null,
    now: new Date("2026-09-08T12:00:00.000Z"),
  });
}

describe("LobbyOpenGame", () => {
  test("host occupies slots and join fills then blocks extras", () => {
    const game = makeOpenGame();
    expect(game.slotsFilled()).toBe(1);
    expect(game.remainingSlots()).toBe(3);
    expect(game.status.isOpen).toBe(true);

    game.join("joiner-1", PartySize.from(2));
    expect(game.slotsFilled()).toBe(3);
    expect(game.status.isOpen).toBe(true);

    game.join("joiner-2", PartySize.from(1));
    expect(game.slotsFilled()).toBe(4);
    expect(game.status.isFilled).toBe(true);

    expect(() => game.join("late", PartySize.from(1))).toThrow(
      "Open game is not open",
    );
  });

  test("host can kick a joiner and reopen a filled game", () => {
    const game = makeOpenGame();
    game.join("joiner-1", PartySize.from(3));
    expect(game.status.isFilled).toBe(true);

    expect(() => game.kick("joiner-1", "host-1")).toThrow(
      "Only the host can kick a player",
    );
    expect(() => game.kick("host-1", "host-1")).toThrow("Host cannot be kicked");

    game.kick("host-1", "joiner-1");
    expect(game.memberOf("joiner-1")).toBeNull();
    expect(game.status.isOpen).toBe(true);
    expect(game.remainingSlots()).toBe(3);
  });

  test("does not mark ready until slots are filled", () => {
    const game = makeOpenGame({ slotsNeeded: 4 });
    game.join("joiner-1", PartySize.from(1));
    expect(game.status.isFilled).toBe(false);
    expect(game.remainingSlots()).toBe(2);
  });
});
