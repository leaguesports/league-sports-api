import z from "zod";

const BASE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const BASE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const tokenDataSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  scope: z.string(),
  token_type: z.string(),
  id_token: z.string(),
});

type TokenData = z.infer<typeof tokenDataSchema>;

export class GoogleOauth2Service {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  getAuthenticationUrl(): string {
    const url = new URL(BASE_AUTH_URL);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("scope", "email profile");
    url.searchParams.set("response_type", "code");
    return url.toString();
  }

  async getAccessTokenFromAuthenticationCode(code: string): Promise<TokenData> {
    const response = await fetch(BASE_TOKEN_URL, {
      method: "POST",
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await response.json();

    const parsedTokenData = tokenDataSchema.parse(tokenData);

    return parsedTokenData;
  }
}
