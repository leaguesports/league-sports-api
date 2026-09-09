export class GolfTourRosterMemberNotFoundError extends Error {
  constructor(message = "Roster member not found") {
    super(message);
    this.name = "GolfTourRosterMemberNotFoundError";
  }
}
