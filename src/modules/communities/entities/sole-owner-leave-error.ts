import { DomainError } from "../../../lib/domain-error";

export class SoleOwnerLeaveError extends DomainError {
  constructor() {
    super("Sole owner cannot leave the community");
    this.name = "SoleOwnerLeaveError";
  }
}
