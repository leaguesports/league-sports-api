import { sendSessionError } from "./send-session-error";

function responseDouble() {
  const state: { statusCode?: number; body?: unknown } = {};
  const response = {
    status(code: number) {
      state.statusCode = code;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
  };
  return { response, state };
}

describe("sendSessionError", () => {
  test("returns 400 when the venue foreign key is missing", () => {
    const { response, state } = responseDouble();
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});

    sendSessionError(
      response as never,
      Object.assign(new Error("Foreign key constraint failed"), {
        code: "P2003",
        meta: { field_name: "Session_venueId_fkey" },
      }),
    );

    expect(state.statusCode).toBe(400);
    expect(state.body).toEqual({ error: "Unknown venue" });
    expect(errorLog).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });
});
