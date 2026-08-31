import jwt from "jsonwebtoken";
import z from "zod";

import { IdentityConfig } from "../config";

export function makeJwtParser<T>(
  config: IdentityConfig,
  schema: z.ZodSchema<T>,
): (token: string) => T {
  return (token: string) => {
    if (!token) {
      throw new Error("Token is required");
    }

    const decodedPayload = jwt.verify(token, config.JWT_SECRET);

    if (!decodedPayload) {
      throw new Error("Invalid token");
    }

    try {
      return z.parse(schema, decodedPayload);
    } catch {
      throw new Error("Invalid token");
    }
  };
}

const authenticationPayloadSchema = z.object({
  userId: z.string(),
});

export type AuthenticationPayload = z.infer<typeof authenticationPayloadSchema>;

export function makeAuthenticationTokenParser(config: IdentityConfig) {
  return makeJwtParser(config, authenticationPayloadSchema);
}

export function signAuthenticationToken(
  config: IdentityConfig,
  payload: AuthenticationPayload,
): string {
  return jwt.sign(payload, config.JWT_SECRET);
}
