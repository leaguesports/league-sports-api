import { DomainError } from "../../../lib/domain-error";
import { ProviderCatalog } from "../catalog/provider-catalog";
import { IntegrationConnection } from "../entities/integration-connection";
import { ImportedSession } from "../entities/imported-session";
import { IntegrationNotConnectedError } from "../entities/integration-not-connected-error";
import { Provider } from "../entities/provider";
import { ProviderNotFoundError } from "../entities/provider-not-found-error";
import { StoredCredential } from "../entities/stored-credential";
import { IntegrationConnectionRepository } from "../repositories/integration-connection.repository";
import { maskHint, TokenCipher } from "./token-cipher";

export type PublicImportedSession = {
  id: string;
  sport: string;
  playedAt: string;
  title: string | null;
};

export type PublicProvider = {
  id: string;
  name: string;
  description: string;
  available: boolean;
  comingSoon: boolean;
  status: "connected" | "disconnected";
  lastSyncedAt: string | null;
  importedSessionCount: number;
  connectedAt: string | null;
  disconnectedAt: string | null;
  credentialMasked: string | null;
  lastImportedSession: PublicImportedSession | null;
};

function requireUserId(userId: string): string {
  const id = userId.trim();
  if (!id) throw new DomainError("userId is required");
  return id;
}

function toPublicImportedSession(
  session: ImportedSession,
): PublicImportedSession {
  const snapshot = session.toSnapshot();
  return {
    id: snapshot.id,
    sport: snapshot.sport,
    playedAt: snapshot.playedAt,
    title: snapshot.title,
  };
}

export function toPublicProvider(
  provider: Provider,
  connection: IntegrationConnection | null,
): PublicProvider {
  const last = connection?.importedSessions.at(-1) ?? null;
  return {
    ...provider.toSnapshot(),
    status: connection?.status.value ?? "disconnected",
    lastSyncedAt: connection?.lastSyncedAt
      ? connection.lastSyncedAt.toISOString()
      : null,
    importedSessionCount: connection?.importedSessionCount ?? 0,
    connectedAt: connection?.connectedAt
      ? connection.connectedAt.toISOString()
      : null,
    disconnectedAt: connection?.disconnectedAt
      ? connection.disconnectedAt.toISOString()
      : null,
    credentialMasked: maskHint(connection?.credential?.hint),
    lastImportedSession: last ? toPublicImportedSession(last) : null,
  };
}

function parseSessions(input: {
  session?: unknown;
  sessions?: unknown;
  body?: unknown;
}): ImportedSession[] {
  if (Array.isArray(input.sessions)) {
    return input.sessions.map((session) => ImportedSession.from(session));
  }
  if (input.session !== undefined) {
    return [ImportedSession.from(input.session)];
  }
  if (input.body !== undefined) {
    return [ImportedSession.from(input.body)];
  }
  throw new DomainError("provide session, sessions, or a session body");
}

export class ListIntegrations {
  constructor(
    private readonly connections: IntegrationConnectionRepository,
    private readonly catalog: ProviderCatalog,
  ) {}

  async execute(input: { userId: string }): Promise<{
    providers: PublicProvider[];
  }> {
    const userId = requireUserId(input.userId);
    const rows = await this.connections.listForUser(userId);
    const byProvider = new Map(
      rows.map((connection) => [connection.providerId.value, connection]),
    );

    return {
      providers: this.catalog.list().map((provider) =>
        toPublicProvider(provider, byProvider.get(provider.id.value) ?? null),
      ),
    };
  }
}

export class ConnectIntegration {
  constructor(
    private readonly connections: IntegrationConnectionRepository,
    private readonly catalog: ProviderCatalog,
    private readonly cipher: TokenCipher,
  ) {}

  async execute(input: {
    userId: string;
    providerId: unknown;
    token?: unknown;
  }): Promise<{ provider: PublicProvider }> {
    const userId = requireUserId(input.userId);
    const provider = this.catalog.require(input.providerId);
    provider.assertConnectable();

    const credential = toStoredCredential(this.cipher, input.token);
    const existing = await this.connections.findByUserAndProvider(
      userId,
      provider.id,
    );

    if (existing) {
      existing.connect(credential);
      const saved = await this.connections.persist(existing);
      return { provider: toPublicProvider(provider, saved) };
    }

    const created = await this.connections.create(
      IntegrationConnection.open(userId, provider.id, credential),
    );
    return { provider: toPublicProvider(provider, created) };
  }
}

export class DisconnectIntegration {
  constructor(
    private readonly connections: IntegrationConnectionRepository,
    private readonly catalog: ProviderCatalog,
  ) {}

  async execute(input: {
    userId: string;
    providerId: unknown;
  }): Promise<{ provider: PublicProvider }> {
    const userId = requireUserId(input.userId);
    const provider = this.catalog.require(input.providerId);
    const existing = await this.connections.findByUserAndProvider(
      userId,
      provider.id,
    );

    if (!existing) {
      return { provider: toPublicProvider(provider, null) };
    }

    existing.disconnect();
    const saved = await this.connections.persist(existing);
    return { provider: toPublicProvider(provider, saved) };
  }
}

export class SyncIntegration {
  constructor(
    private readonly connections: IntegrationConnectionRepository,
    private readonly catalog: ProviderCatalog,
  ) {}

  async execute(input: {
    userId: string;
    providerId: unknown;
    session?: unknown;
    sessions?: unknown;
    body?: unknown;
  }): Promise<{ provider: PublicProvider }> {
    const userId = requireUserId(input.userId);
    const provider = this.catalog.require(input.providerId);
    provider.assertConnectable();

    const existing = await this.connections.findByUserAndProvider(
      userId,
      provider.id,
    );
    if (!existing || !existing.status.isConnected) {
      throw new IntegrationNotConnectedError();
    }

    existing.importSessions(parseSessions(input));
    const saved = await this.connections.persist(existing);
    return { provider: toPublicProvider(provider, saved) };
  }
}

function toStoredCredential(
  cipher: TokenCipher,
  token: unknown,
): StoredCredential | null {
  if (token == null || token === "") return null;
  const encrypted = cipher.encrypt(token);
  return StoredCredential.fromEncrypted(
    encrypted.encryptedValue,
    encrypted.hint,
  );
}

export { IntegrationNotConnectedError } from "../entities/integration-not-connected-error";
export { ProviderNotFoundError } from "../entities/provider-not-found-error";
export { ProviderUnavailableError } from "../entities/provider-unavailable-error";
