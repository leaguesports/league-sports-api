"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("./lib/prisma");
const googleOauth2Service_1 = require("./authentication/services/googleOauth2Service");
const googleUserService_1 = require("./services/googleUserService");
const accountService_1 = require("./services/accountService");
const playerService_1 = require("./services/playerService");
const profileService_1 = require("./services/profileService");
const communityService_1 = require("./services/communityService");
const crypto_1 = require("crypto");
const authorization_1 = require("./core/middleware/authorization");
const jwtParser_1 = require("./util/jwtParser");
function createApp(config) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use((0, cookie_parser_1.default)());
    app.use((0, cors_1.default)({
        origin: "http://localhost:3001",
        credentials: true,
    }));
    const authorizationMiddleware = (0, authorization_1.makeAuthorizationMiddleware)(config);
    const authenticationTokenParser = (0, jwtParser_1.makeAuthenticationTokenParser)(config);
    const prisma = (0, prisma_1.createPrismaClient)(config);
    const googleOauth2Service = new googleOauth2Service_1.GoogleOauth2Service(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, config.GOOGLE_REDIRECT_URI);
    const googleUserService = new googleUserService_1.GoogleUserService();
    const accountService = new accountService_1.AccountService(prisma);
    const playerService = new playerService_1.PlayerService(prisma);
    const profileService = new profileService_1.ProfileService(prisma);
    const communityService = new communityService_1.CommunityService(prisma);
    const sessions = new Map();
    const playerSessions = new Map();
    app.get("/api/auth/providers/google/signin", async (req, res) => {
        const authenticationUrl = googleOauth2Service.getAuthenticationUrl();
        res.redirect(authenticationUrl);
    });
    app.get("/api/auth/providers/google/callback-url", async (req, res) => {
        const authenticationCode = req.query.code;
        const tokenData = await googleOauth2Service.getAccessTokenFromAuthenticationCode(authenticationCode);
        const userInfo = await googleUserService.getUserInfo(tokenData.access_token);
        let account = await accountService.getAccountByProviderAndProviderId("google", userInfo.id);
        if (!account) {
            const player = await playerService.createPlayer();
            account = await accountService.createAccount(player.id, "google", userInfo.id, tokenData.access_token, "", new Date(new Date().getTime() + tokenData.expires_in * 1000));
            await profileService.createProfile(player.id, userInfo.name, userInfo.family_name);
            const token = jsonwebtoken_1.default.sign({ userId: player.id }, config.JWT_SECRET);
            res.cookie("token", token, {
                httpOnly: true,
                secure: false,
                maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
                sameSite: "lax",
            });
        }
        const player = await playerService.getPlayerById(account.playerId);
        if (!player) {
            return res.status(404).json({ error: "Player not found" });
        }
        const token = jsonwebtoken_1.default.sign({ userId: player.id }, config.JWT_SECRET);
        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
            sameSite: "lax",
        });
        return res.redirect("http://localhost:3001");
    });
    // Protected routes
    app.use(authorizationMiddleware);
    app.get("/api/auth/me", async (req, res) => {
        const { userId } = authenticationTokenParser(req.cookies.token);
        const player = await playerService.getPlayerById(userId);
        if (!player) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        return res.status(204).send();
    });
    app.post("/api/auth/logout", async (req, res) => {
        res.clearCookie("token");
        return res.status(204).send();
    });
    app.get("/api/communities/:id", async (req, res) => {
        const community = await communityService.getCommunityById(req.params.id);
        if (!community) {
            return res.status(404).json({ error: "Community not found" });
        }
        return res.status(200).json(community);
    });
    app.get("/api/communities", async (req, res) => {
        const { userId } = authenticationTokenParser(req.cookies.token);
        const player = await playerService.getPlayerById(userId);
        if (!player) {
            return res.status(404).json({ error: "Player not found" });
        }
        const communities = await communityService.getCommunitiesByPlayerId(player.id);
        return res.status(200).json(communities);
    });
    app.post("/api/communities", async (req, res) => {
        const { name, description } = req.body;
        const { userId } = authenticationTokenParser(req.cookies.token);
        const player = await playerService.getPlayerById(userId);
        if (!player) {
            return res.status(404).json({ error: "Player not found" });
        }
        const community = await communityService.createCommunity(player.id, name, description);
        return res.status(201).json(community);
    });
    app.post("/api/sessions", async (req, res) => {
        const { userId } = authenticationTokenParser(req.cookies.token);
        const player = await playerService.getPlayerById(userId);
        if (!player) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (playerSessions.has(player.id)) {
            return res.status(400).json({ error: "Player already has a session" });
        }
        const sessionId = (0, crypto_1.randomUUID)();
        sessions.set(sessionId, {});
        playerSessions.set(player.id, sessionId);
        return res.status(201).json({ sessionId });
    });
    app.get("/api/sessions", async (req, res) => {
        const { userId } = authenticationTokenParser(req.cookies.token);
        const player = await playerService.getPlayerById(userId);
        if (!player) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const sessionId = playerSessions.get(player.id);
        if (!sessionId) {
            return res.status(404).json({ error: "Session not found" });
        }
        if (!sessions.has(sessionId)) {
            return res.status(404).json({ error: "Session not found" });
        }
        const session = sessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }
        return res.status(200).json(session);
    });
    app.post("/api/sessions/:sessionId/events", async (req, res) => {
        const { sessionId } = req.params;
        const { event } = req.body;
        if (!sessions.has(sessionId)) {
            return res.status(404).json({ error: "Session not found" });
        }
        const session = sessions.get(sessionId);
        session.events.push(event);
    });
    app.post("/api/sessions/:sessionId/end", async (req, res) => {
        const { sessionId } = req.params;
        const { userId } = authenticationTokenParser(req.cookies.token);
        const player = await playerService.getPlayerById(userId);
        if (!player) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (!sessions.has(sessionId)) {
            return res.status(404).json({ error: "Session not found" });
        }
        const session = sessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }
        sessions.delete(sessionId);
        playerSessions.delete(player.id);
        return res.status(204).send();
    });
    app.listen(config.PORT, () => {
        console.log("Server is running on port 3000");
    });
}
//# sourceMappingURL=app.js.map