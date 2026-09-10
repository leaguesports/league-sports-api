export class MeetingNotFoundError extends Error {
  constructor(message = "Meeting not found") {
    super(message);
    this.name = "MeetingNotFoundError";
  }
}
