import { GoogleOauthService, GoogleUserService } from "../../google-oauth";
import { IdentityConfig } from "../config";
import { AccountRepository } from "../repositories/account.repository";
import { PlayerRepository } from "../repositories/player.repository";
import { ProfileRepository } from "../repositories/profile.repository";
import { signAuthenticationToken } from "../utils/jwt";

export type AuthServiceDeps = {
  config: IdentityConfig;
  googleOauthService: GoogleOauthService;
  googleUserService: GoogleUserService;
  accountRepository: AccountRepository;
  playerRepository: PlayerRepository;
  profileRepository: ProfileRepository;
};

export type AuthMeUser = {
  id: string;
  displayName: string;
  name: string;
  email: string;
  handle: string;
  avatarUrl: string | null;
};

type GoogleUserInfo = {
  id: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

export class AuthService {
  private readonly config: IdentityConfig;
  private readonly googleOauthService: GoogleOauthService;
  private readonly googleUserService: GoogleUserService;
  private readonly accountRepository: AccountRepository;
  private readonly playerRepository: PlayerRepository;
  private readonly profileRepository: ProfileRepository;

  constructor(deps: AuthServiceDeps) {
    this.config = deps.config;
    this.googleOauthService = deps.googleOauthService;
    this.googleUserService = deps.googleUserService;
    this.accountRepository = deps.accountRepository;
    this.playerRepository = deps.playerRepository;
    this.profileRepository = deps.profileRepository;
  }

  getGoogleAuthenticationUrl(returnTo?: string): string {
    return this.googleOauthService.getAuthenticationUrl(returnTo);
  }

  async signInWithGoogle(authenticationCode: string): Promise<{
    token: string;
    frontendUrl: string;
  }> {
    const tokenData =
      await this.googleOauthService.getAccessTokenFromAuthenticationCode(
        authenticationCode,
      );

    const userInfo = (await this.googleUserService.getUserInfo(
      tokenData.access_token,
    )) as GoogleUserInfo;

    let account =
      await this.accountRepository.getAccountByProviderAndProviderId(
        "google",
        userInfo.id,
      );

    if (!account) {
      const player = await this.playerRepository.createPlayer();

      account = await this.accountRepository.createAccount(
        player.id,
        "google",
        userInfo.id,
        tokenData.access_token,
        "",
        new Date(new Date().getTime() + tokenData.expires_in * 1000),
      );

      const firstName =
        userInfo.given_name?.trim() ||
        userInfo.name?.trim() ||
        "Player";
      const lastName = userInfo.family_name?.trim() || "";
      const email = userInfo.email?.trim() || "";
      const handleSeed = email || firstName;
      const handle = await this.profileRepository.allocateHandle(handleSeed);

      await this.profileRepository.createProfile({
        userId: player.id,
        firstName,
        lastName,
        email,
        handle,
        avatarUrl: userInfo.picture?.trim() || null,
      });
    }

    return {
      token: signAuthenticationToken(this.config, {
        userId: account.userId,
      }),
      frontendUrl: this.config.FRONTEND_URL,
    };
  }

  async getPlayerById(userId: string) {
    return this.playerRepository.getPlayerById(userId);
  }

  async getMeUser(userId: string): Promise<AuthMeUser | null> {
    const player = await this.playerRepository.getPlayerById(userId);
    if (!player) return null;

    let profile = player.profile;
    if (!profile) {
      const handle = await this.profileRepository.allocateHandle(
        `user_${userId}`,
        userId,
      );
      profile = await this.profileRepository.createProfile({
        userId,
        firstName: "Player",
        lastName: "",
        email: "",
        handle,
        avatarUrl: null,
      });
    } else if (!profile.handle?.trim()) {
      const handle = await this.profileRepository.allocateHandle(
        profile.email || profile.firstName || `user_${userId}`,
        userId,
      );
      profile = await this.profileRepository.updateHandle(userId, handle);
    }

    const displayName =
      [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() ||
      profile.handle;

    return {
      id: userId,
      displayName,
      name: displayName,
      email: profile.email || "",
      handle: profile.handle,
      avatarUrl: profile.avatarUrl ?? null,
    };
  }
}
