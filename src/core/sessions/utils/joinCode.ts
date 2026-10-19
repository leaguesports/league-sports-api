import { JoinCodeSource } from "./joinCodeGenerator";

export const MAX_JOIN_CODE_ATTEMPTS = 5;

export class JoinCodeAllocationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "JoinCodeAllocationError";
  }
}

export function isJoinCodeConflict(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  if (String((error as { code?: unknown }).code) !== "P2002") {
    return false;
  }

  const meta =
    "meta" in error ? (error as { meta?: unknown }).meta : undefined;
  const target =
    meta && typeof meta === "object" && meta !== null && "target" in meta
      ? (meta as { target?: unknown }).target
      : undefined;

  const fields = Array.isArray(target)
    ? target.map(String)
    : typeof target === "string"
      ? [target]
      : [];

  if (fields.length === 0) {
    return true;
  }

  return fields.some((field) => field.toLowerCase().includes("joincode"));
}

export async function withJoinCodeRetries<T>(
  joinCodes: JoinCodeSource,
  attempt: (joinCode: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attemptNumber = 1; attemptNumber <= MAX_JOIN_CODE_ATTEMPTS; attemptNumber += 1) {
    try {
      return await attempt(joinCodes.generate());
    } catch (error) {
      if (!isJoinCodeConflict(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  throw new JoinCodeAllocationError(
    `Could not allocate a unique join code after ${MAX_JOIN_CODE_ATTEMPTS} attempts`,
    { cause: lastError },
  );
}
