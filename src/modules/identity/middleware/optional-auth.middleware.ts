import { Request } from "express";
import jwt from "jsonwebtoken";

import { IdentityConfig } from "../config";

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
