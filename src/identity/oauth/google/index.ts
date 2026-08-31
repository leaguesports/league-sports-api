import { GoogleOauthConfig } from "./config";
import { GoogleOauthService } from "./google-oauth.service";
import { GoogleUserService } from "./google-user.service";

export type CreateGoogleOauthModuleParams = {
  config: GoogleOauthConfig;
};

export type GoogleOauthModule = {
  googleOauthService: GoogleOauthService;
  googleUserService: GoogleUserService;
};

export function createGoogleOauthModule({
  config,
}: CreateGoogleOauthModuleParams): GoogleOauthModule {
  return {
    googleOauthService: new GoogleOauthService(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      config.GOOGLE_REDIRECT_URI,
    ),
    googleUserService: new GoogleUserService(),
  };
}

export { googleOauthConfigSchema, type GoogleOauthConfig } from "./config";
export { GoogleOauthService } from "./google-oauth.service";
export { GoogleUserService } from "./google-user.service";
