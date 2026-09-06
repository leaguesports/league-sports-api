import { DomainError } from "../../../lib/domain-error";
import { ProviderCatalog } from "../catalog/provider-catalog";
import {
  AUTODARTS_PROVIDER_ID,
  GENERIC_IMPORT_PROVIDER_ID,
  TRACKMAN_PROVIDER_ID,
} from "../catalog/providers";
import { InMemoryIntegrationConnectionRepository } from "../repositories/in-memory-integration-connection.repository";
import {
  ConnectIntegration,
  DisconnectIntegration,
  IntegrationNotConnectedError,
  ListIntegrations,
  ProviderNotFoundError,
  ProviderUnavailableError,
  SyncIntegration,
} from "./integrations.service";
import { TokenCipher } from "./token-cipher";

describe("integrations services", () => {
  function setup() {
    const catalog = ProviderCatalog.defaults();
    const connections = new InMemoryIntegrationConnectionRepository();
    const cipher = new TokenCipher("service-test-secret");
    return {
      catalog,
      connections,
      cipher,
      list: new ListIntegrations(connections, catalog),
      connect: new ConnectIntegration(connections, catalog, cipher),
      disconnect: new DisconnectIntegration(connections, catalog),
      sync: new SyncIntegration(connections, catalog),
    };
  }

  const session = {
    sport: "padel",
    playedAt: "2026-09-06T10:00:00.000Z",
    title: "Club night",
  };

  test("list returns the catalog with disconnected defaults", async () => {
    const { list } = setup();
    const result = await list.execute({ userId: "user-a" });

    expect(result.providers.map((provider) => provider.id)).toEqual([
      GENERIC_IMPORT_PROVIDER_ID,
      TRACKMAN_PROVIDER_ID,
      AUTODARTS_PROVIDER_ID,
    ]);
    expect(result.providers[0]).toMatchObject({
      id: GENERIC_IMPORT_PROVIDER_ID,
      available: true,
      comingSoon: false,
      status: "disconnected",
      lastSyncedAt: null,
      importedSessionCount: 0,
      credentialMasked: null,
      lastImportedSession: null,
    });
    expect(result.providers[1]).toMatchObject({
      id: TRACKMAN_PROVIDER_ID,
      available: false,
      comingSoon: true,
      status: "disconnected",
    });
  });

  test("connect stores a masked credential and never returns the token", async () => {
    const { connect, list } = setup();
    const token = "super-secret-import-token";
    const connected = await connect.execute({
      userId: "user-a",
      providerId: GENERIC_IMPORT_PROVIDER_ID,
      token,
    });

    expect(connected.provider).toMatchObject({
      id: GENERIC_IMPORT_PROVIDER_ID,
      status: "connected",
      credentialMasked: "••••oken",
    });
    expect(JSON.stringify(connected)).not.toContain(token);

    const listed = await list.execute({ userId: "user-a" });
    const generic = listed.providers.find(
      (provider) => provider.id === GENERIC_IMPORT_PROVIDER_ID,
    );
    expect(generic?.status).toBe("connected");
    expect(generic?.credentialMasked).toBe("••••oken");
    expect(JSON.stringify(listed)).not.toContain(token);
  });

  test("connect is idempotent and can replace the stored token", async () => {
    const { connect } = setup();
    const first = await connect.execute({
      userId: "user-a",
      providerId: GENERIC_IMPORT_PROVIDER_ID,
      token: "first-token",
    });
    const again = await connect.execute({
      userId: "user-a",
      providerId: GENERIC_IMPORT_PROVIDER_ID,
    });
    expect(again.provider.status).toBe("connected");
    expect(again.provider.credentialMasked).toBe(first.provider.credentialMasked);

    const rotated = await connect.execute({
      userId: "user-a",
      providerId: GENERIC_IMPORT_PROVIDER_ID,
      token: "second-token",
    });
    expect(rotated.provider.credentialMasked).toBe("••••oken");
    expect(JSON.stringify(rotated)).not.toContain("second-token");
  });

  test("sync accepts a structured session and updates lastSyncedAt", async () => {
    const { connect, sync, list } = setup();
    await connect.execute({
      userId: "user-a",
      providerId: GENERIC_IMPORT_PROVIDER_ID,
    });

    const synced = await sync.execute({
      userId: "user-a",
      providerId: GENERIC_IMPORT_PROVIDER_ID,
      session,
    });
    expect(synced.provider).toMatchObject({
      status: "connected",
      importedSessionCount: 1,
      lastImportedSession: {
        sport: "padel",
        title: "Club night",
      },
    });
    expect(synced.provider.lastSyncedAt).toEqual(expect.any(String));

    await sync.execute({
      userId: "user-a",
      providerId: GENERIC_IMPORT_PROVIDER_ID,
      sessions: [
        { ...session, sport: "golf", title: "Range" },
        { ...session, sport: "other", title: "Gym" },
      ],
    });

    const listed = await list.execute({ userId: "user-a" });
    expect(listed.providers[0]).toMatchObject({
      importedSessionCount: 3,
      lastImportedSession: { title: "Gym" },
    });
  });

  test("disconnect keeps import history and clears the credential", async () => {
    const { connect, sync, disconnect } = setup();
    await connect.execute({
      userId: "user-a",
      providerId: GENERIC_IMPORT_PROVIDER_ID,
      token: "keep-secret",
    });
    await sync.execute({
      userId: "user-a",
      providerId: GENERIC_IMPORT_PROVIDER_ID,
      session,
    });

    const disconnected = await disconnect.execute({
      userId: "user-a",
      providerId: GENERIC_IMPORT_PROVIDER_ID,
    });
    expect(disconnected.provider).toMatchObject({
      status: "disconnected",
      importedSessionCount: 1,
      credentialMasked: null,
    });
    expect(disconnected.provider.lastSyncedAt).toEqual(expect.any(String));
    expect(JSON.stringify(disconnected)).not.toContain("keep-secret");
  });

  test("sync requires a connected available provider", async () => {
    const { sync, connect } = setup();

    await expect(
      sync.execute({
        userId: "user-a",
        providerId: GENERIC_IMPORT_PROVIDER_ID,
        session,
      }),
    ).rejects.toBeInstanceOf(IntegrationNotConnectedError);

    await connect.execute({
      userId: "user-a",
      providerId: GENERIC_IMPORT_PROVIDER_ID,
    });
    await expect(
      sync.execute({
        userId: "user-a",
        providerId: GENERIC_IMPORT_PROVIDER_ID,
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  test("unknown and coming-soon providers are rejected on connect/sync", async () => {
    const { connect, sync } = setup();

    await expect(
      connect.execute({
        userId: "user-a",
        providerId: "not-a-provider",
      }),
    ).rejects.toBeInstanceOf(ProviderNotFoundError);

    await expect(
      connect.execute({
        userId: "user-a",
        providerId: TRACKMAN_PROVIDER_ID,
        token: "vendor-key",
      }),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);

    await expect(
      sync.execute({
        userId: "user-a",
        providerId: AUTODARTS_PROVIDER_ID,
        session,
      }),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});
