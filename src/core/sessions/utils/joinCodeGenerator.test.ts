import { randomInt } from "crypto";

import { JoinCodeGenerator } from "./joinCodeGenerator";

jest.mock("crypto", () => {
  const actual = jest.requireActual<typeof import("crypto")>("crypto");
  return {
    ...actual,
    randomInt: jest.fn(() => 0),
  };
});

const mockedRandomInt = randomInt as jest.MockedFunction<typeof randomInt>;

describe("JoinCodeGenerator", () => {
  beforeEach(() => {
    mockedRandomInt.mockReset();
    mockedRandomInt.mockImplementation(() => 0);
  });

  test("draws each character from crypto.randomInt", () => {
    const mathRandom = jest.spyOn(Math, "random");

    expect(new JoinCodeGenerator().generate()).toBe("AAAAAA");
    expect(mockedRandomInt).toHaveBeenCalledTimes(6);
    expect(mockedRandomInt).toHaveBeenCalledWith(36);
    expect(mathRandom).not.toHaveBeenCalled();

    mockedRandomInt.mockImplementation(() => 35);
    expect(new JoinCodeGenerator().generate()).toBe("999999");

    mathRandom.mockRestore();
  });
});
