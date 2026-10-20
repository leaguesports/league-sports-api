import jwt from "jsonwebtoken";
import { z } from "zod";

const payloadSchema = z.object({
  purpose: z.literal("coverage_unsub"),
  email: z.string().email(),
});

export function signCoverageUnsubscribeToken(
  secret: string,
  email: string,
): string {
  return jwt.sign(
    { purpose: "coverage_unsub", email: email.trim().toLowerCase() },
    secret,
    { expiresIn: "365d" },
  );
}

export function parseCoverageUnsubscribeToken(
  secret: string,
  token: string,
): string {
  const decoded = jwt.verify(token, secret);
  const payload = payloadSchema.parse(decoded);
  return payload.email;
}
