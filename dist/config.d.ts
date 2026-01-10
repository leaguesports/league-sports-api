import { z } from "zod";
declare const configSchema: z.ZodObject<{
    PORT: z.ZodDefault<z.ZodNumber>;
    DATABASE_URL: z.ZodString;
    GOOGLE_CLIENT_ID: z.ZodString;
    GOOGLE_CLIENT_SECRET: z.ZodString;
    GOOGLE_REDIRECT_URI: z.ZodString;
    JWT_SECRET: z.ZodString;
}, z.core.$strip>;
export type Config = z.infer<typeof configSchema>;
export declare function getConfig(): Config;
export {};
//# sourceMappingURL=config.d.ts.map