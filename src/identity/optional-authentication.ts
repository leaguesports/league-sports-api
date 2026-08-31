import { Request } from "express";
import jwt from "jsonwebtoken";

import { Config } from "../config";

export function makeOptionalAuthentication(config: Config) {
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
