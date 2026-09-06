import { IntegrationConnection } from "../entities/integration-connection";
import { ProviderId } from "../entities/provider-id";

export interface IntegrationConnectionRepository {
  findByUserAndProvider(
    userId: string,
    providerId: ProviderId,
  ): Promise<IntegrationConnection | null>;
  create(connection: IntegrationConnection): Promise<IntegrationConnection>;
  persist(connection: IntegrationConnection): Promise<IntegrationConnection>;
  listForUser(userId: string): Promise<IntegrationConnection[]>;
}
