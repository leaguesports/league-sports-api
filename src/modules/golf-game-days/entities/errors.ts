export class GameDayHttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "GameDayHttpError";
    this.statusCode = statusCode;
  }
}

export class GameDayPersistenceError extends Error {
  constructor(message = "Unable to save game day", options?: ErrorOptions) {
    super(message, options);
    this.name = "GameDayPersistenceError";
  }
}

export class InviteCodeCollisionError extends Error {
  constructor() {
    super("invite code collision");
    this.name = "InviteCodeCollisionError";
  }
}
