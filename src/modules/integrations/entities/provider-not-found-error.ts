export class ProviderNotFoundError extends Error {
  constructor() {
    super("Integration provider not found");
    this.name = "ProviderNotFoundError";
  }
}
