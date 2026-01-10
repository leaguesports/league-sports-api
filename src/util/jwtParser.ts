import jwt from "jsonwebtoken";
import { Config } from "../config";
import z from "zod";

export function makeJwtParser<T>(
  config: Config,
  schema: z.ZodSchema<T>
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
    } catch (error) {
      throw new Error("Invalid token");
    }
  };
}

const authenticationPayloadSchema = z.object({
  userId: z.string(),
});

export function makeAuthenticationTokenParser(config: Config) {
  return makeJwtParser(config, authenticationPayloadSchema);
}
