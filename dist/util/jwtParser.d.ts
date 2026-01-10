import { Config } from "../config";
import z from "zod";
export declare function makeJwtParser<T>(config: Config, schema: z.ZodSchema<T>): (token: string) => T;
export declare function makeAuthenticationTokenParser(config: Config): (token: string) => {
    userId: string;
};
//# sourceMappingURL=jwtParser.d.ts.map