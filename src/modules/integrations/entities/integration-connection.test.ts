import { DomainError } from "../../../lib/domain-error";
import { ProviderId } from "./provider-id";
import { ConnectionStatus } from "./connection-status";
import { ImportedSession } from "./imported-session";
import { ImportedSessionCount } from "./imported-session-count";
import { IntegrationConnection } from "./integration-connection";
import { IntegrationNotConnectedError } from "./integration-not-connected-error";
import { Provider } from "./provider";
import { StoredCredential } from "./stored-credential";

function genericImportId() {
  return ProviderId.from("generic-import");
}

function sampleSession(overrides: Record<string, unknown> = {}) {
  return ImportedSession.from({
    sport: "padel",
    playedAt: "2026-09-06T10:00:00.000Z",
    title: "Morning set",
    notes: "Serve held",
    metrics: { winners: 8 },
    ...overrides,
  });
}

function sampleCredential() {
  return StoredCredential.fromEncrypted("iv.tag.cipher", "ab12");
}

describe("integration value objects", () => {
  test("provider id is a kebab-case slug", () => {
    expect(ProviderId.from("Generic-Import").value).toBe("generic-import");
    expect(() => ProviderId.from("")).toThrow(DomainError);
    expect(() => ProviderId.from("Generic Import")).toThrow(DomainError);
  });

  test("status is connected or disconnected", () => {
    expect(ConnectionStatus.from("connected").isConnected).toBe(true);
    expect(ConnectionStatus.from("disconnected").isDisconnected).toBe(true);
    expect(() => ConnectionStatus.from("active")).toThrow(DomainError);
  });

  test("imported session count is a non-negative whole number", () => {
    expect(ImportedSessionCount.from(0).increment(2).value).toBe(2);
    expect(() => ImportedSessionCount.from(-1)).toThrow(DomainError);
    expect(() => ImportedSessionCount.from(1.5)).toThrow(DomainError);
  });

  test("imported session requires sport and playedAt", () => {
    const session = sampleSession();
    expect(session.toSnapshot()).toMatchObject({
      sport: "padel",
      playedAt: "2026-09-06T10:00:00.000Z",
      title: "Morning set",
      notes: "Serve held",
      metrics: { winners: 8 },
    });
    expect(() => ImportedSession.from({ sport: "padel" })).toThrow(DomainError);
    expect(() =>
      ImportedSession.from({
        sport: "tennis",
        playedAt: "2026-09-06T10:00:00.000Z",
      }),
    ).toThrow(DomainError);
  });

  test("stored credential never exposes the full secret", () => {
    const credential = sampleCredential();
    expect(credential.masked).toBe("••••ab12");
    expect(credential.encryptedValue).toBe("iv.tag.cipher");
  });

  test("provider catalog rules reject available+comingSoon", () => {
    expect(() =>
      Provider.fromDefinition({
        id: "broken",
        name: "Broken",
        description: "Nope",
        available: true,
        comingSoon: true,
      }),
    ).toThrow(DomainError);
  });
});

describe(IntegrationConnection, () => {
  test("open starts connected with zero imports", () => {
    const connection = IntegrationConnection.open(
      "user-a",
      genericImportId(),
      sampleCredential(),
    );
    const snapshot = connection.toSnapshot();

    expect(connection.id).toBeTruthy();
    expect(snapshot).toMatchObject({
      userId: "user-a",
      providerId: "generic-import",
      status: "connected",
      lastSyncedAt: null,
      importedSessionCount: 0,
      importedSessions: [],
      tokenHint: "ab12",
      disconnectedAt: null,
    });
    expect(snapshot.encryptedToken).toBe("iv.tag.cipher");
    expect(snapshot.connectedAt).toEqual(expect.any(String));
  });

  test("import updates lastSyncedAt and the session count", () => {
    const connection = IntegrationConnection.open(
      "user-a",
      genericImportId(),
      null,
    );

    connection.importSessions([sampleSession()]);
    expect(connection.toSnapshot()).toMatchObject({
      status: "connected",
      importedSessionCount: 1,
    });
    expect(connection.lastSyncedAt).toBeInstanceOf(Date);
    expect(connection.importedSessions).toHaveLength(1);

    connection.importSessions([
      sampleSession({ sport: "golf", title: "Range" }),
    ]);
    expect(connection.importedSessionCount).toBe(2);
    expect(connection.importedSessions.at(-1)?.toSnapshot().title).toBe("Range");
  });

  test("import on a disconnected connection is rejected", () => {
    const connection = IntegrationConnection.open(
      "user-a",
      genericImportId(),
      null,
    );
    connection.disconnect();
    expect(() => connection.importSessions([sampleSession()])).toThrow(
      IntegrationNotConnectedError,
    );
  });

  test("disconnect clears the credential and keeps import history", () => {
    const connection = IntegrationConnection.open(
      "user-a",
      genericImportId(),
      sampleCredential(),
    );
    connection.importSessions([sampleSession()]);
    connection.disconnect();

    const snapshot = connection.toSnapshot();
    expect(snapshot).toMatchObject({
      status: "disconnected",
      importedSessionCount: 1,
      encryptedToken: null,
      tokenHint: null,
    });
    expect(snapshot.lastSyncedAt).toEqual(expect.any(String));
    expect(snapshot.disconnectedAt).toEqual(expect.any(String));
  });

  test("reconnect without a token keeps history and does not invent a credential", () => {
    const connection = IntegrationConnection.open(
      "user-a",
      genericImportId(),
      sampleCredential(),
    );
    connection.importSessions([sampleSession()]);
    connection.disconnect();
    connection.connect(null);

    expect(connection.toSnapshot()).toMatchObject({
      status: "connected",
      importedSessionCount: 1,
      encryptedToken: null,
      tokenHint: null,
    });
  });

  test("rehydrate + snapshot round-trips connection state", () => {
    const created = IntegrationConnection.open(
      "user-a",
      genericImportId(),
      sampleCredential(),
    );
    created.importSessions([sampleSession()]);
    const restored = IntegrationConnection.fromSnapshot(created.toSnapshot());
    expect(restored.toSnapshot()).toEqual(created.toSnapshot());
  });

  test("empty import list is a domain error", () => {
    const connection = IntegrationConnection.open(
      "user-a",
      genericImportId(),
      null,
    );
    expect(() => connection.importSessions([])).toThrow(DomainError);
  });
});
