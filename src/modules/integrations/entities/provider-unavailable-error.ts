export class ProviderUnavailableError extends Error {
  constructor(providerId = "this provider") {
    super(`${providerId} is not available yet`);
    this.name = "ProviderUnavailableError";
  }
}
