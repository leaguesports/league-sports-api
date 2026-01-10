"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeJwtParser = makeJwtParser;
exports.makeAuthenticationTokenParser = makeAuthenticationTokenParser;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = __importDefault(require("zod"));
function makeJwtParser(config, schema) {
    return (token) => {
        if (!token) {
            throw new Error("Token is required");
        }
        const decodedPayload = jsonwebtoken_1.default.verify(token, config.JWT_SECRET);
        if (!decodedPayload) {
            throw new Error("Invalid token");
        }
        try {
            return zod_1.default.parse(schema, decodedPayload);
        }
        catch (error) {
            throw new Error("Invalid token");
        }
    };
}
const authenticationPayloadSchema = zod_1.default.object({
    userId: zod_1.default.string(),
});
function makeAuthenticationTokenParser(config) {
    return makeJwtParser(config, authenticationPayloadSchema);
}
//# sourceMappingURL=jwtParser.js.map