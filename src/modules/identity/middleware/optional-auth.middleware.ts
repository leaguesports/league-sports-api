import { Request } from "express";
import jwt from "jsonwebtoken";

import { IdentityConfig } from "../config";
import { makeAuthenticationTokenParser } from "../utils/jwt";

export function makeOptionalAuthentication(config: IdentityConfig) {
  return (req: Request): boolean => {
    const token = req.cookies?.token;
    if (typeof token !== "string" || token.length === 0) {
      return false;
    }

    try {
      jwt.verify(token, config.JWT_SECRET);
      return true;
    } catch {
      return false;
    }
  };
}

export function makeTryGetSessionUserId(config: IdentityConfig) {
  const parse = makeAuthenticationTokenParser(config);

  return (req: Request): string | null => {
    const token = req.cookies?.token;
    if (typeof token !== "string" || token.length === 0) {
      return null;
    }

    try {
      return parse(token).userId;
    } catch {
      return null;
    }
  };
}
