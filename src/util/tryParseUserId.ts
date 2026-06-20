import { Request } from "express";

export function tryParseUserId(
  req: Request,
  parseToken: (token: string) => { userId: string },
): string | undefined {
  const token = req.cookies.token;
  if (!token) {
    return undefined;
  }

  try {
    return parseToken(token).userId;
  } catch {
    return undefined;
  }
}
