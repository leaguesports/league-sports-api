import { IntegrationConnection } from "../entities/integration-connection";
import { IntegrationPersistenceError } from "../entities/integration-persistence-error";
import { ProviderId } from "../entities/provider-id";
import { IntegrationConnectionRepository } from "./integration-connection.repository";

export class InMemoryIntegrationConnectionRepository
  implements IntegrationConnectionRepository
{
  private readonly byId = new Map<string, IntegrationConnection>();

  async findByUserAndProvider(
    userId: string,
    providerId: ProviderId,
  ): Promise<IntegrationConnection | null> {
    const match = [...this.byId.values()].find(
      (connection) =>
        connection.belongsTo(userId) && connection.providerId.equals(providerId),
    );
    return clone(match ?? null);
  }

  async create(
    connection: IntegrationConnection,
  ): Promise<IntegrationConnection> {
    const stored = clone(connection)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async persist(
    connection: IntegrationConnection,
  ): Promise<IntegrationConnection> {
    if (!this.byId.has(connection.id)) {
      throw new IntegrationPersistenceError(
        "Unable to save integration connection",
      );
    }
    const stored = clone(connection)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async listForUser(userId: string): Promise<IntegrationConnection[]> {
    return [...this.byId.values()]
      .filter((connection) => connection.belongsTo(userId))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((connection) => clone(connection)!);
  }
}

function clone(
  connection: IntegrationConnection | null,
): IntegrationConnection | null {
  if (!connection) return null;
  return IntegrationConnection.fromSnapshot(connection.toSnapshot());
}
