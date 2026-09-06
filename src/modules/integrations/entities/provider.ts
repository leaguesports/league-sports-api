import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { ProviderId } from "./provider-id";
import { ProviderUnavailableError } from "./provider-unavailable-error";

export type ProviderDefinition = {
  id: string;
  name: string;
  description: string;
  available: boolean;
  comingSoon: boolean;
};

export type ProviderSnapshot = {
  id: string;
  name: string;
  description: string;
  available: boolean;
  comingSoon: boolean;
};

export class Provider {
  private constructor(
    readonly id: ProviderId,
    readonly name: string,
    readonly description: string,
    readonly available: boolean,
    readonly comingSoon: boolean,
  ) {}

  static fromDefinition(definition: ProviderDefinition): Provider {
    const name = requiredTrimmed(definition.name, "name");
    const description = requiredTrimmed(definition.description, "description");
    if (definition.available && definition.comingSoon) {
      throw new DomainError("available providers cannot be marked comingSoon");
    }
    if (!definition.available && !definition.comingSoon) {
      throw new DomainError("unavailable providers must be marked comingSoon");
    }

    return new Provider(
      ProviderId.from(definition.id),
      name,
      description,
      definition.available,
      definition.comingSoon,
    );
  }

  assertConnectable(): void {
    if (!this.available) {
      throw new ProviderUnavailableError(this.id.value);
    }
  }

  toSnapshot(): ProviderSnapshot {
    return {
      id: this.id.value,
      name: this.name,
      description: this.description,
      available: this.available,
      comingSoon: this.comingSoon,
    };
  }
}
