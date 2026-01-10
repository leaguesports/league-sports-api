import { generateBookingCode } from "./generateBookingCode";

describe(generateBookingCode, () => {
  test("should generate a booking code", () => {
    const code = generateBookingCode();
    expect(code).toBeDefined();
    expect(code.length).toBe(6);
    expect(code).toMatch(/^[0-9A-Z]+$/);
  });

  test("should generate a unique booking code", () => {
    const code1 = generateBookingCode();
    const code2 = generateBookingCode();
    expect(code1).not.toBe(code2);
  });
});
