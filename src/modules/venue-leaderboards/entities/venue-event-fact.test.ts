import { CmsId } from "../../venue/entities/cms-id";
import { Match } from "../../match/entities/match";
import { StartsAt } from "../../match/entities/starts-at";
import { Ruleset } from "../../match/entities/ruleset";
import { VenueEventFact } from "./venue-event-fact";

describe("VenueEventFact.fromPadelMatch", () => {
  test("skips guests and attributes wins to the winning pair", () => {
    const match = Match.captureFinished({
      venueCmsId: CmsId.from("sanity-court-1"),
      startsAt: StartsAt.from("2026-09-12T10:00:00.000Z"),
      ruleset: Ruleset.from("golden_point"),
      pairings: {
        teamA: [
          { displayName: "Alex", isGuest: false, userId: "user-alex" },
          { displayName: "Sam", isGuest: true, userId: null },
        ],
        teamB: [
          { displayName: "Jordan", isGuest: false, userId: "user-jordan" },
          { displayName: "Riley", isGuest: false, userId: "user-riley" },
        ],
      },
      score: { sets: [{ gamesA: 6, gamesB: 4, winner: "A" }] },
      winner: "A",
      lockedByUserId: "user-alex",
    });

    const facts = VenueEventFact.fromPadelMatch(match);
    expect(facts.map((fact) => fact.userId).sort()).toEqual([
      "user-alex",
      "user-jordan",
      "user-riley",
    ]);
    expect(facts.find((fact) => fact.userId === "user-alex")?.won).toBe(true);
    expect(facts.find((fact) => fact.userId === "user-jordan")?.won).toBe(false);
  });
});
