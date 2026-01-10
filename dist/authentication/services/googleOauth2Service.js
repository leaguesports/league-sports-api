"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleOauth2Service = void 0;
const zod_1 = __importDefault(require("zod"));
const BASE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const BASE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const tokenDataSchema = zod_1.default.object({
    access_token: zod_1.default.string(),
    expires_in: zod_1.default.number(),
    scope: zod_1.default.string(),
    token_type: zod_1.default.string(),
    id_token: zod_1.default.string(),
});
class GoogleOauth2Service {
    clientId;
    clientSecret;
    redirectUri;
    constructor(clientId, clientSecret, redirectUri) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }
    getAuthenticationUrl() {
        const url = new URL(BASE_AUTH_URL);
        url.searchParams.set("client_id", this.clientId);
        url.searchParams.set("redirect_uri", this.redirectUri);
        url.searchParams.set("scope", "email profile");
        url.searchParams.set("response_type", "code");
        return url.toString();
    }
    async getAccessTokenFromAuthenticationCode(code) {
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
exports.GoogleOauth2Service = GoogleOauth2Service;
//# sourceMappingURL=googleOauth2Service.js.map