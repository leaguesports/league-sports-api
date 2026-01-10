"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeAuthorizationMiddleware = makeAuthorizationMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function makeAuthorizationMiddleware(config) {
    return (req, res, next) => {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const decodedPayload = jsonwebtoken_1.default.verify(token, config.JWT_SECRET);
        if (!decodedPayload) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        next();
    };
}
//# sourceMappingURL=authorization.js.map