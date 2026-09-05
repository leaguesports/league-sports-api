export class PreferencesPersistenceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "PreferencesPersistenceError";
  }
}
