import { Request, Response, NextFunction } from "express";
import { Config } from "../../config";
import jwt from "jsonwebtoken";

export function makeAuthorizationMiddleware(config: Config) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decodedPayload = jwt.verify(token, config.JWT_SECRET);

    if (!decodedPayload) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    next();
  };
}
