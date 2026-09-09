import { Prisma, PrismaClient } from "../../../generated/prisma/client";
import { ConnectionStatus } from "../entities/connection-status";
import { ImportedSession } from "../entities/imported-session";
import { ImportedSessionCount } from "../entities/imported-session-count";
import { IntegrationConnection } from "../entities/integration-connection";
import { IntegrationPersistenceError } from "../entities/integration-persistence-error";
import { ProviderId } from "../entities/provider-id";
import { StoredCredential } from "../entities/stored-credential";
import { IntegrationConnectionRepository } from "./integration-connection.repository";

type ConnectionRow = {
  id: string;
  userId: string;
  providerId: string;
  status: "connected" | "disconnected";
  lastSyncedAt: Date | null;
  importedSessionCount: number;
  importedSessions: Prisma.JsonValue;
  encryptedToken: string | null;
  tokenHint: string | null;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: ConnectionRow): IntegrationConnection {
  return IntegrationConnection.rehydrate({
    id: row.id,
    userId: row.userId,
    providerId: ProviderId.from(row.providerId),
    status: ConnectionStatus.from(row.status),
    lastSyncedAt: row.lastSyncedAt,
    importedSessionCount: ImportedSessionCount.from(row.importedSessionCount),
    importedSessions: parseImportedSessions(row.importedSessions),
    credential:
      row.encryptedToken && row.tokenHint
        ? StoredCredential.fromEncrypted(row.encryptedToken, row.tokenHint)
        : null,
    connectedAt: row.connectedAt,
    disconnectedAt: row.disconnectedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function parseImportedSessions(raw: Prisma.JsonValue): ImportedSession[] {
  if (!Array.isArray(raw)) {
    throw new IntegrationPersistenceError("importedSessions must be an array");
  }
  return raw.map((item) => ImportedSession.from(item));
}

function toCreateData(connection: IntegrationConnection) {
  const snapshot = connection.toSnapshot();
  return {
    id: snapshot.id,
    userId: snapshot.userId,
    providerId: snapshot.providerId,
    status: snapshot.status,
    lastSyncedAt: connection.lastSyncedAt,
    importedSessionCount: snapshot.importedSessionCount,
    importedSessions: snapshot.importedSessions as Prisma.InputJsonValue,
    encryptedToken: snapshot.encryptedToken,
    tokenHint: snapshot.tokenHint,
    connectedAt: connection.connectedAt,
    disconnectedAt: connection.disconnectedAt,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

export class PrismaIntegrationConnectionRepository
  implements IntegrationConnectionRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserAndProvider(
    userId: string,
    providerId: ProviderId,
  ): Promise<IntegrationConnection | null> {
    try {
      const row = await this.prisma.integrationConnection.findUnique({
        where: {
          userId_providerId: {
            userId,
            providerId: providerId.value,
          },
        },
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      if (error instanceof IntegrationPersistenceError) throw error;
      throw new IntegrationPersistenceError(
        "Failed to load integration connection",
        { cause: error },
      );
    }
  }

  async create(
    connection: IntegrationConnection,
  ): Promise<IntegrationConnection> {
    try {
      const row = await this.prisma.integrationConnection.create({
        data: toCreateData(connection),
      });
      return toDomain(row);
    } catch (error) {
      throw new IntegrationPersistenceError(
        "Failed to create integration connection",
        { cause: error },
      );
    }
  }

  async persist(
    connection: IntegrationConnection,
  ): Promise<IntegrationConnection> {
    const snapshot = connection.toSnapshot();
    try {
      const row = await this.prisma.integrationConnection.update({
        where: { id: snapshot.id },
        data: {
          status: snapshot.status,
          lastSyncedAt: connection.lastSyncedAt,
          importedSessionCount: snapshot.importedSessionCount,
          importedSessions: snapshot.importedSessions as Prisma.InputJsonValue,
          encryptedToken: snapshot.encryptedToken,
          tokenHint: snapshot.tokenHint,
          connectedAt: connection.connectedAt,
          disconnectedAt: connection.disconnectedAt,
          updatedAt: connection.updatedAt,
        },
      });
      return toDomain(row);
    } catch (error) {
      throw new IntegrationPersistenceError(
        "Failed to save integration connection",
        { cause: error },
      );
    }
  }

  async listForUser(userId: string): Promise<IntegrationConnection[]> {
    try {
      const rows = await this.prisma.integrationConnection.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(toDomain);
    } catch (error) {
      if (error instanceof IntegrationPersistenceError) throw error;
      throw new IntegrationPersistenceError(
        "Failed to list integration connections",
        { cause: error },
      );
    }
  }
}
