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

    const userInfo = await this.googleUserService.getUserInfo(
      tokenData.access_token,
    );

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

      await this.profileRepository.createProfile(
        player.id,
        userInfo.name,
        userInfo.family_name,
      );
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
}
