import { getSlotIndex } from "../util/getSlotIndex";

describe(getSlotIndex, () => {
  test("should return the correct slot index for a given time", () => {
    expect(getSlotIndex(0, 0)).toBe(0);
    expect(getSlotIndex(0, 5)).toBe(1);
    expect(getSlotIndex(1, 0)).toBe(12);

    expect(getSlotIndex(10, 0)).toBe(120);
    expect(getSlotIndex(10, 30)).toBe(126);
  });

  test("should throw an error if the minutes are not a multiple of 5", () => {
    expect(() => getSlotIndex(0, 1)).toThrow("Minutes must be a multiple of 5");
  });
});
