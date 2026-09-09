import { ProviderUnavailableError } from "../entities/provider-unavailable-error";
import { ProviderCatalog } from "./provider-catalog";
import {
  AUTODARTS_PROVIDER_ID,
  GENERIC_IMPORT_PROVIDER_ID,
  TRACKMAN_PROVIDER_ID,
} from "./providers";

describe(ProviderCatalog, () => {
  const catalog = ProviderCatalog.defaults();

  test("ships generic-import as the live path and lists vendor shells as coming soon", () => {
    const providers = catalog.list().map((provider) => provider.toSnapshot());
    expect(providers.map((provider) => provider.id)).toEqual([
      GENERIC_IMPORT_PROVIDER_ID,
      TRACKMAN_PROVIDER_ID,
      AUTODARTS_PROVIDER_ID,
    ]);

    expect(catalog.require(GENERIC_IMPORT_PROVIDER_ID).toSnapshot()).toMatchObject({
      name: "Import session",
      available: true,
      comingSoon: false,
    });
    expect(catalog.require(TRACKMAN_PROVIDER_ID).toSnapshot()).toMatchObject({
      available: false,
      comingSoon: true,
    });
    expect(catalog.require(AUTODARTS_PROVIDER_ID).toSnapshot()).toMatchObject({
      available: false,
      comingSoon: true,
    });
  });

  test("lookup is case-insensitive and unknown ids miss", () => {
    expect(catalog.get("Generic-Import")?.id.value).toBe(
      GENERIC_IMPORT_PROVIDER_ID,
    );
    expect(catalog.get("missing")).toBeNull();
  });

  test("coming-soon providers are not connectable", () => {
    expect(() => catalog.require(TRACKMAN_PROVIDER_ID).assertConnectable()).toThrow(
      ProviderUnavailableError,
    );
  });
});
