import { DomainError } from "../../../lib/domain-error";
import { GolfPlayer } from "../../golf-round/entities/golf-player";
import { CmsId } from "../../venue/entities/cms-id";
import { GolfTour } from "./golf-tour";
import { GolfTourCampName } from "./golf-tour-camp-name";
import { GolfTourForbiddenError } from "./golf-tour-forbidden-error";
import { GolfTourFormat } from "./golf-tour-format";
import { GolfTourName } from "./golf-tour-name";
import { GolfTourNotReadyError } from "./golf-tour-not-ready-error";
import { GolfTourStatus } from "./golf-tour-status";
import { TourDate } from "./tour-date";
import { parseFourballPlayers } from "./golf-tour-fourball";

function draft() {
  return GolfTour.create({
    name: GolfTourName.from("Friends Cup"),
    startDate: TourDate.from("2026-09-12", "startDate"),
    endDate: TourDate.from("2026-09-14", "endDate"),
    hostUserId: "user-host",
  });
}

describe("golf tour value objects", () => {
  test("status is a closed enum", () => {
    expect(GolfTourStatus.from("draft").isDraft).toBe(true);
    expect(() => GolfTourStatus.from("registration")).toThrow(DomainError);
  });

  test("format is stroke only in v1", () => {
    expect(GolfTourFormat.from(undefined).isStroke).toBe(true);
    expect(GolfTourFormat.from("STROKE").value).toBe("stroke");
    expect(() => GolfTourFormat.from("scramble")).toThrow(
      /scramble is not supported in v1/,
    );
  });

  test("tour dates reject inverted ranges via the aggregate", () => {
    expect(() =>
      GolfTour.create({
        name: GolfTourName.from("Nope"),
        startDate: TourDate.from("2026-09-14", "startDate"),
        endDate: TourDate.from("2026-09-12", "endDate"),
        hostUserId: "user-host",
      }),
    ).toThrow(DomainError);
  });
});

describe(GolfTour, () => {
  test("create is a draft with two default camps", () => {
    const tour = draft();
    const snapshot = tour.toSnapshot();
    expect(snapshot).toMatchObject({
      name: "Friends Cup",
      startDate: "2026-09-12",
      endDate: "2026-09-14",
      status: "draft",
      hostUserId: "user-host",
    });
    expect(snapshot.camps).toHaveLength(2);
    expect(snapshot.camps.map((camp) => camp.name)).toEqual([
      "Camp A",
      "Camp B",
    ]);
    expect(snapshot.rounds).toEqual([]);
    expect(snapshot.fourballs).toEqual([]);
  });

  test("only the host can edit, add camps, or complete", () => {
    const tour = draft();
    expect(() =>
      tour.updateDetails("user-z", { name: GolfTourName.from("Nope") }),
    ).toThrow(GolfTourForbiddenError);
    expect(() =>
      tour.addCamp("user-z", { name: GolfTourCampName.from("Camp C") }),
    ).toThrow(GolfTourForbiddenError);
    expect(() => tour.complete("user-z")).toThrow(GolfTourForbiddenError);

    tour.updateDetails("user-host", { name: GolfTourName.from("Renamed") });
    expect(tour.name.value).toBe("Renamed");
    tour.addCamp("user-host", { name: GolfTourCampName.from("Camp C") });
    expect(tour.camps).toHaveLength(3);
  });

  test("rounds must fall within the tour dates", () => {
    const tour = draft();
    expect(() =>
      tour.addRound("user-host", {
        date: TourDate.from("2026-09-20", "date"),
        venueCmsId: CmsId.from("course-1"),
      }),
    ).toThrow(DomainError);

    const round = tour.addRound("user-host", {
      date: TourDate.from("2026-09-13", "date"),
      venueCmsId: CmsId.from("course-1"),
      label: "Saturday AM",
    });
    expect(round.toSnapshot()).toMatchObject({
      date: "2026-09-13",
      venueCmsId: "course-1",
      label: "Saturday AM",
      format: "stroke",
    });
  });

  test("fourball start requires players and activates the tour", () => {
    const tour = draft();
    const round = tour.addRound("user-host", {
      date: TourDate.from("2026-09-12", "date"),
      venueCmsId: CmsId.from("course-1"),
    });
    const fourball = tour.addFourball("user-host", {
      roundId: round.id,
      campId: tour.camps[0]!.id,
    });
    expect(() => tour.startFourball(fourball.id, "golf-1")).toThrow(
      GolfTourNotReadyError,
    );

    tour.assignFourballPlayers("user-host", fourball.id, [
      GolfPlayer.from({
        slot: 1,
        displayName: "Alex",
        isGuest: false,
        userId: "user-alex",
      }),
    ]);
    tour.startFourball(fourball.id, "golf-1");
    expect(tour.status.isActive).toBe(true);
    expect(tour.fourballById(fourball.id)?.status.isLive).toBe(true);
    expect(tour.fourballById(fourball.id)?.golfRoundId).toBe("golf-1");
    expect(tour.fourballById(fourball.id)?.path).toBe("/golf/golf-1");
  });

  test("locking the last playable fourball auto-completes the tour", () => {
    const tour = draft();
    const round = tour.addRound("user-host", {
      date: TourDate.from("2026-09-12", "date"),
      venueCmsId: CmsId.from("course-1"),
    });
    const fourball = tour.addFourball("user-host", {
      roundId: round.id,
      campId: tour.camps[0]!.id,
      players: parseFourballPlayers([
        { slot: 1, displayName: "Alex", isGuest: false, userId: "user-alex" },
      ]),
    });
    tour.startFourball(fourball.id, "golf-1");
    tour.lockFourballFromScorecard("golf-1");
    expect(tour.fourballById(fourball.id)?.status.isLocked).toBe(true);
    expect(tour.status.isCompleted).toBe(true);
  });

  test("host can complete while fourballs are still pending", () => {
    const tour = draft();
    tour.complete("user-host");
    expect(tour.status.isCompleted).toBe(true);
    expect(() =>
      tour.addCamp("user-host", { name: GolfTourCampName.from("Late") }),
    ).toThrow(DomainError);
  });

  test("seated players can read the tour; outsiders cannot", () => {
    const tour = draft();
    const round = tour.addRound("user-host", {
      date: TourDate.from("2026-09-12", "date"),
      venueCmsId: CmsId.from("course-1"),
    });
    tour.addFourball("user-host", {
      roundId: round.id,
      campId: tour.camps[0]!.id,
      players: parseFourballPlayers([
        { slot: 1, displayName: "Alex", isGuest: false, userId: "user-alex" },
        { slot: 2, displayName: "Pat", isGuest: true, userId: null },
      ]),
    });
    expect(tour.canRead("user-host")).toBe(true);
    expect(tour.canRead("user-alex")).toBe(true);
    expect(tour.canRead("user-stranger")).toBe(false);
  });
});
