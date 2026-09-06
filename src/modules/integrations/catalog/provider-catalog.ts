import { Provider } from "../entities/provider";
import { ProviderId } from "../entities/provider-id";
import { ProviderNotFoundError } from "../entities/provider-not-found-error";
import { PROVIDER_DEFINITIONS } from "./providers";

export class ProviderCatalog {
  private readonly byId: Map<string, Provider>;

  constructor(providers: readonly Provider[]) {
    this.byId = new Map(providers.map((provider) => [provider.id.value, provider]));
  }

  static defaults(): ProviderCatalog {
    return new ProviderCatalog(
      PROVIDER_DEFINITIONS.map((definition) =>
        Provider.fromDefinition(definition),
      ),
    );
  }

  list(): Provider[] {
    return [...this.byId.values()];
  }

  get(rawId: unknown): Provider | null {
    let id: ProviderId;
    try {
      id = ProviderId.from(rawId);
    } catch {
      return null;
    }
    return this.byId.get(id.value) ?? null;
  }

  require(rawId: unknown): Provider {
    const provider = this.get(rawId);
    if (!provider) {
      throw new ProviderNotFoundError();
    }
    return provider;
  }
}
