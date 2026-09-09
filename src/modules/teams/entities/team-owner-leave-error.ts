import { DomainError } from "../../../lib/domain-error";

export class TeamOwnerLeaveError extends DomainError {
  constructor(
    message = "Owner must transfer ownership before leaving or changing role",
  ) {
    super(message);
    this.name = "TeamOwnerLeaveError";
  }
}
