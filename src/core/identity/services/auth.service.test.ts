import { AuthService } from "./auth.service";

describe("AuthService.getMeUser", () => {
  const config = {
    JWT_SECRET: "test",
    FRONTEND_URL: "http://localhost:3001",
  } as ConstructorParameters<typeof AuthService>[0]["config"];

  function makeService(player: unknown) {
    const playerRepository = {
      getPlayerById: jest.fn(async () => player),
      createPlayer: jest.fn(),
    };
    const profileRepository = {
      createProfile: jest.fn(async (input) => input),
      allocateHandle: jest.fn(async () => "alexj"),
      updateHandle: jest.fn(async (_userId: string, handle: string) => ({
        userId: "user-1",
        firstName: "Alex",
        lastName: "Johnson",
        email: "alex@example.com",
        handle,
        avatarUrl: null,
      })),
      getProfileByUserId: jest.fn(),
      isHandleTaken: jest.fn(),
      updateGolfHandicapIndex: jest.fn(async (_userId: string, golfHandicapIndex: number | null) => ({
        userId: "user-1",
        firstName: "Alex",
        lastName: "Johnson",
        email: "alex@example.com",
        handle: "alexj",
        avatarUrl: null,
        golfHandicapIndex,
      })),
    };

    const service = new AuthService({
      config,
      googleOauthService: {} as never,
      googleUserService: {} as never,
      accountRepository: {} as never,
      playerRepository: playerRepository as never,
      profileRepository: profileRepository as never,
    });

    return { service, playerRepository, profileRepository };
  }

  test("returns profile fields for dashboard identity strip", async () => {
    const { service } = makeService({
      id: "user-1",
      profile: {
        firstName: "Alex",
        lastName: "Johnson",
        email: "alex@example.com",
        handle: "alexj",
        avatarUrl: "https://example.com/a.png",
        golfHandicapIndex: 12.4,
      },
    });

    await expect(service.getMeUser("user-1")).resolves.toEqual({
      id: "user-1",
      displayName: "Alex Johnson",
      name: "Alex Johnson",
      email: "alex@example.com",
      handle: "alexj",
      avatarUrl: "https://example.com/a.png",
      golfHandicapIndex: 12.4,
    });
  });

  test("backfills missing profile", async () => {
    const { service, profileRepository } = makeService({
      id: "user-1",
      profile: null,
    });

    const me = await service.getMeUser("user-1");

    expect(profileRepository.allocateHandle).toHaveBeenCalled();
    expect(profileRepository.createProfile).toHaveBeenCalled();
    expect(me?.handle).toBe("alexj");
    expect(me?.id).toBe("user-1");
    expect(me?.golfHandicapIndex).toBeNull();
  });

  test("updateMeProfile writes golfHandicapIndex", async () => {
    const { service, profileRepository } = makeService({
      id: "user-1",
      profile: {
        firstName: "Alex",
        lastName: "Johnson",
        email: "alex@example.com",
        handle: "alexj",
        avatarUrl: null,
        golfHandicapIndex: null,
      },
    });

    const updated = await service.updateMeProfile("user-1", {
      golfHandicapIndex: 8.2,
    });

    expect(profileRepository.updateGolfHandicapIndex).toHaveBeenCalledWith(
      "user-1",
      8.2,
    );
    expect(updated?.golfHandicapIndex).toBe(8.2);
  });
});
