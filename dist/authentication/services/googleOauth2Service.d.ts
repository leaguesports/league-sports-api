import z from "zod";
declare const tokenDataSchema: z.ZodObject<{
    access_token: z.ZodString;
    expires_in: z.ZodNumber;
    scope: z.ZodString;
    token_type: z.ZodString;
    id_token: z.ZodString;
}, z.core.$strip>;
type TokenData = z.infer<typeof tokenDataSchema>;
export declare class GoogleOauth2Service {
    private readonly clientId;
    private readonly clientSecret;
    private readonly redirectUri;
    constructor(clientId: string, clientSecret: string, redirectUri: string);
    getAuthenticationUrl(): string;
    getAccessTokenFromAuthenticationCode(code: string): Promise<TokenData>;
}
export {};
//# sourceMappingURL=googleOauth2Service.d.ts.map