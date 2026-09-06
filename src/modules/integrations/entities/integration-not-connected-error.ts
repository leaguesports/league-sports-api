export class IntegrationNotConnectedError extends Error {
  constructor() {
    super("Integration is not connected");
    this.name = "IntegrationNotConnectedError";
  }
}
