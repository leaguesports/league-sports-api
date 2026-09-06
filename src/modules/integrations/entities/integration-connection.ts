import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { ConnectionStatus } from "./connection-status";
import { ImportedSession } from "./imported-session";
import { ImportedSessionCount } from "./imported-session-count";
import { IntegrationNotConnectedError } from "./integration-not-connected-error";
import { ProviderId } from "./provider-id";
import { StoredCredential } from "./stored-credential";

export const MAX_STORED_IMPORTED_SESSIONS = 50;

export type IntegrationConnectionSnapshot = {
  id: string;
  userId: string;
  providerId: string;
  status: "connected" | "disconnected";
  lastSyncedAt: string | null;
  importedSessionCount: number;
  importedSessions: ReturnType<ImportedSession["toSnapshot"]>[];
  encryptedToken: string | null;
  tokenHint: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export class IntegrationConnection {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly providerId: ProviderId,
    readonly createdAt: Date,
    private statusValue: ConnectionStatus,
    private lastSyncedAtValue: Date | null,
    private importedSessionCountValue: ImportedSessionCount,
    private importedSessionsValue: ImportedSession[],
    private credentialValue: StoredCredential | null,
    private connectedAtValue: Date | null,
    private disconnectedAtValue: Date | null,
    private updatedAtValue: Date,
  ) {}

  static open(
    userId: string,
    providerId: ProviderId,
    credential: StoredCredential | null,
  ): IntegrationConnection {
    const now = new Date();
    return new IntegrationConnection(
      randomUUID(),
      requiredTrimmed(userId, "userId"),
      providerId,
      now,
      ConnectionStatus.CONNECTED,
      null,
      ImportedSessionCount.ZERO,
      [],
      credential,
      now,
      null,
      now,
    );
  }

  static rehydrate(props: {
    id: string;
    userId: string;
    providerId: ProviderId;
    status: ConnectionStatus;
    lastSyncedAt: Date | null;
    importedSessionCount: ImportedSessionCount;
    importedSessions: ImportedSession[];
    credential: StoredCredential | null;
    connectedAt: Date | null;
    disconnectedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): IntegrationConnection {
    return new IntegrationConnection(
      props.id,
      props.userId,
      props.providerId,
      props.createdAt,
      props.status,
      props.lastSyncedAt,
      props.importedSessionCount,
      [...props.importedSessions],
      props.credential,
      props.connectedAt,
      props.disconnectedAt,
      props.updatedAt,
    );
  }

  static fromSnapshot(
    snapshot: IntegrationConnectionSnapshot,
  ): IntegrationConnection {
    return IntegrationConnection.rehydrate({
      id: snapshot.id,
      userId: snapshot.userId,
      providerId: ProviderId.from(snapshot.providerId),
      status: ConnectionStatus.from(snapshot.status),
      lastSyncedAt: snapshot.lastSyncedAt
        ? new Date(snapshot.lastSyncedAt)
        : null,
      importedSessionCount: ImportedSessionCount.from(
        snapshot.importedSessionCount,
      ),
      importedSessions: snapshot.importedSessions.map((session) =>
        ImportedSession.fromSnapshot(session),
      ),
      credential:
        snapshot.encryptedToken && snapshot.tokenHint
          ? StoredCredential.fromEncrypted(
              snapshot.encryptedToken,
              snapshot.tokenHint,
            )
          : null,
      connectedAt: snapshot.connectedAt
        ? new Date(snapshot.connectedAt)
        : null,
      disconnectedAt: snapshot.disconnectedAt
        ? new Date(snapshot.disconnectedAt)
        : null,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    });
  }

  get status(): ConnectionStatus {
    return this.statusValue;
  }

  get lastSyncedAt(): Date | null {
    return this.lastSyncedAtValue;
  }

  get importedSessionCount(): number {
    return this.importedSessionCountValue.value;
  }

  get importedSessions(): readonly ImportedSession[] {
    return this.importedSessionsValue;
  }

  get credential(): StoredCredential | null {
    return this.credentialValue;
  }

  get connectedAt(): Date | null {
    return this.connectedAtValue;
  }

  get disconnectedAt(): Date | null {
    return this.disconnectedAtValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  belongsTo(userId: string): boolean {
    return this.userId === userId.trim();
  }

  connect(credential: StoredCredential | null): void {
    const now = new Date();
    if (this.statusValue.isConnected && !credential) {
      return;
    }

    this.statusValue = ConnectionStatus.CONNECTED;
    this.connectedAtValue = now;
    this.disconnectedAtValue = null;
    if (credential) {
      this.credentialValue = credential;
    }
    this.updatedAtValue = now;
  }

  disconnect(): void {
    if (this.statusValue.isDisconnected) {
      return;
    }

    const now = new Date();
    this.statusValue = ConnectionStatus.DISCONNECTED;
    this.credentialValue = null;
    this.disconnectedAtValue = now;
    this.updatedAtValue = now;
  }

  importSessions(sessions: ImportedSession[]): void {
    if (!this.statusValue.isConnected) {
      throw new IntegrationNotConnectedError();
    }
    if (sessions.length === 0) {
      throw new DomainError("at least one session is required");
    }

    const now = new Date();
    this.importedSessionsValue = [
      ...this.importedSessionsValue,
      ...sessions,
    ].slice(-MAX_STORED_IMPORTED_SESSIONS);
    this.importedSessionCountValue = this.importedSessionCountValue.increment(
      sessions.length,
    );
    this.lastSyncedAtValue = now;
    this.updatedAtValue = now;
  }

  toSnapshot(): IntegrationConnectionSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      providerId: this.providerId.value,
      status: this.statusValue.value,
      lastSyncedAt: this.lastSyncedAtValue
        ? this.lastSyncedAtValue.toISOString()
        : null,
      importedSessionCount: this.importedSessionCountValue.value,
      importedSessions: this.importedSessionsValue.map((session) =>
        session.toSnapshot(),
      ),
      encryptedToken: this.credentialValue?.encryptedValue ?? null,
      tokenHint: this.credentialValue?.hint ?? null,
      connectedAt: this.connectedAtValue
        ? this.connectedAtValue.toISOString()
        : null,
      disconnectedAt: this.disconnectedAtValue
        ? this.disconnectedAtValue.toISOString()
        : null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAtValue.toISOString(),
    };
  }
}
