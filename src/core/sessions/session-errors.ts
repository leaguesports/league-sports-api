export class SessionConflictError extends Error {
  readonly details: unknown;

  constructor(message: string, details: unknown = undefined) {
    super(message);
    this.name = "SessionConflictError";
    this.details = details;
  }
}

export class SessionCapacityError extends Error {
  readonly details: unknown;

  constructor(message: string, details: unknown = undefined) {
    super(message);
    this.name = "SessionCapacityError";
    this.details = details;
  }
}

export class SessionForbiddenError extends Error {
  readonly details: unknown;

  constructor(message: string, details: unknown = undefined) {
    super(message);
    this.name = "SessionForbiddenError";
    this.details = details;
  }
}

export class ParticipantTokenError extends Error {
  constructor(message = "Invalid session token") {
    super(message);
    this.name = "ParticipantTokenError";
  }
}

export class JoinLookupRateLimitError extends Error {
  constructor() {
    super("Too many requests");
    this.name = "JoinLookupRateLimitError";
  }
}
