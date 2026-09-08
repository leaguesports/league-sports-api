import { City } from "./city";
import { LobbyProposal } from "./lobby-proposal";
import { LobbySport } from "./lobby-sport";
import { PartySize } from "./party-size";
import { TimeWindow } from "./time-window";

function makeProposal() {
  return LobbyProposal.create({
    sport: LobbySport.DARTS,
    city: City.from("Cape Town"),
    area: null,
    window: TimeWindow.from(
      "2026-09-08T16:00:00.000Z",
      "2026-09-08T18:00:00.000Z",
    ),
    venueCmsId: null,
    skill: null,
    members: [
      { userId: "user-a", partySize: PartySize.from(1), lookingId: "look-a" },
      { userId: "user-b", partySize: PartySize.from(1), lookingId: "look-b" },
    ],
  });
}

describe("LobbyProposal", () => {
  test("unanimous accept is ready to convert", () => {
    const proposal = makeProposal();
    expect(proposal.isReadyToConvert()).toBe(false);
    proposal.accept("user-a");
    expect(proposal.isReadyToConvert()).toBe(false);
    expect(proposal.status.isPending).toBe(true);
    proposal.accept("user-b");
    expect(proposal.status.isAccepted).toBe(true);
    expect(proposal.acceptedSlots()).toBe(2);
  });

  test("pass cancels when remaining parties cannot fill", () => {
    const proposal = makeProposal();
    proposal.pass("user-b");
    expect(proposal.status.value).toBe("cancelled");
    expect(proposal.isReadyToConvert()).toBe(false);
  });

  test("non-members cannot respond", () => {
    const proposal = makeProposal();
    expect(() => proposal.accept("stranger")).toThrow(
      "Only a proposal member can respond",
    );
  });
});
