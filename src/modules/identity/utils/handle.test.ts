import { handleCandidate, slugifyHandle } from "./handle";

describe("slugifyHandle", () => {
  test("lowercases and strips non-alphanumeric", () => {
    expect(slugifyHandle("Alex Johnson")).toBe("alexjohnson");
    expect(slugifyHandle("riley.padel")).toBe("rileypadel");
  });

  test("falls back when empty", () => {
    expect(slugifyHandle("!!!")).toBe("player");
    expect(slugifyHandle("")).toBe("player");
  });
});

describe("handleCandidate", () => {
  test("appends attempt suffix without exceeding length budget", () => {
    expect(handleCandidate("alex", 1)).toBe("alex");
    expect(handleCandidate("alex", 2)).toBe("alex2");
    expect(handleCandidate("a".repeat(20), 12)).toHaveLength(20);
  });
});
