import { SessionValidationError } from "../session-plugin";
import { decideMatch, setWinner } from "./scoring";

describe("padel setWinner", () => {
  test("accepts 6 win-by-2, 7-5, and 7-6", () => {
    expect(setWinner({ a: 6, b: 0 })).toBe("A");
    expect(setWinner({ a: 6, b: 4 })).toBe("A");
    expect(setWinner({ a: 3, b: 6 })).toBe("B");
    expect(setWinner({ a: 7, b: 5 })).toBe("A");
    expect(setWinner({ a: 5, b: 7 })).toBe("B");
    expect(setWinner({ a: 7, b: 6 })).toBe("A");
    expect(setWinner({ a: 6, b: 7 })).toBe("B");
  });

  test("returns null for unfinished or invalid finished patterns", () => {
    expect(setWinner({ a: 0, b: 0 })).toBeNull();
    expect(setWinner({ a: 5, b: 4 })).toBeNull();
    expect(setWinner({ a: 6, b: 5 })).toBeNull();
    expect(setWinner({ a: 6, b: 6 })).toBeNull();
    expect(setWinner({ a: 7, b: 4 })).toBeNull();
    expect(setWinner({ a: 7, b: 3 })).toBeNull();
    expect(setWinner({ a: 7, b: 7 })).toBeNull();
  });
});

describe("padel decideMatch", () => {
  test("best_of_3 needs two sets and accepts a straight or split win", () => {
    expect(decideMatch("best_of_3", [{ a: 6, b: 4 }, { a: 6, b: 3 }])).toEqual({
      winner: "A",
      setsWon: { A: 2, B: 0 },
    });
    expect(
      decideMatch("best_of_3", [
        { a: 6, b: 4 },
        { a: 3, b: 6 },
        { a: 7, b: 5 },
      ]),
    ).toEqual({
      winner: "A",
      setsWon: { A: 2, B: 1 },
    });
    expect(
      decideMatch("best_of_3", [
        { a: 4, b: 6 },
        { a: 6, b: 7 },
      ]),
    ).toEqual({
      winner: "B",
      setsWon: { A: 0, B: 2 },
    });
  });

  test("best_of_5 needs three sets", () => {
    expect(
      decideMatch("best_of_5", [
        { a: 6, b: 4 },
        { a: 6, b: 3 },
        { a: 6, b: 2 },
      ]),
    ).toEqual({
      winner: "A",
      setsWon: { A: 3, B: 0 },
    });
    expect(
      decideMatch("best_of_5", [
        { a: 6, b: 4 },
        { a: 3, b: 6 },
        { a: 7, b: 5 },
        { a: 4, b: 6 },
        { a: 7, b: 6 },
      ]),
    ).toEqual({
      winner: "A",
      setsWon: { A: 3, B: 2 },
    });
  });

  test("rejects unfinished sets and matches that never reach the required wins", () => {
    expect(() => decideMatch("best_of_3", [{ a: 6, b: 5 }])).toThrow(SessionValidationError);
    expect(() => decideMatch("best_of_3", [{ a: 6, b: 4 }])).toThrow(/Match is unfinished/);
    expect(() =>
      decideMatch("best_of_5", [
        { a: 6, b: 4 },
        { a: 6, b: 3 },
      ]),
    ).toThrow(/Match is unfinished/);
    expect(() => decideMatch("best_of_3", [])).toThrow(/Match is unfinished/);
  });

  test("rejects dangling sets after the match is already decided", () => {
    expect(() =>
      decideMatch("best_of_3", [
        { a: 6, b: 4 },
        { a: 6, b: 3 },
        { a: 6, b: 0 },
      ]),
    ).toThrow(/Extra sets after the match was decided/);

    expect(() =>
      decideMatch("best_of_5", [
        { a: 6, b: 4 },
        { a: 6, b: 3 },
        { a: 6, b: 2 },
        { a: 1, b: 6 },
      ]),
    ).toThrow(SessionValidationError);
  });
});
