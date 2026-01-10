"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
const configSchema = zod_1.z.object({
    PORT: zod_1.z.number().default(3000),
    DATABASE_URL: zod_1.z.string(),
    // Google OAuth2
    GOOGLE_CLIENT_ID: zod_1.z.string(),
    GOOGLE_CLIENT_SECRET: zod_1.z.string(),
    GOOGLE_REDIRECT_URI: zod_1.z.string(),
    // JWT
    JWT_SECRET: zod_1.z.string(),
});
function getConfig() {
    dotenv_1.default.config();
    try {
        return configSchema.parse({
            PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
            DATABASE_URL: process.env.DATABASE_URL,
            GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
            GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
            JWT_SECRET: process.env.JWT_SECRET,
        });
    }
    catch (error) {
        console.error(error);
        process.exit(1);
    }
}
//# sourceMappingURL=config.js.map