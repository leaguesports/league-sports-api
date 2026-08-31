export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function requiredTrimmed(raw: unknown, field: string): string {
  if (typeof raw !== "string") {
    throw new DomainError(`${field} is required`);
  }

  const value = raw.trim();
  if (value.length === 0) {
    throw new DomainError(`${field} must not be blank`);
  }

  return value;
}
