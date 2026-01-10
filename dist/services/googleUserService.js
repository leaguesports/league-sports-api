"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleUserService = void 0;
const BASE_USER_INFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
class GoogleUserService {
    async getUserInfo(accessToken) {
        const response = await fetch(BASE_USER_INFO_URL, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        const userInfo = (await response.json());
        return userInfo;
    }
}
exports.GoogleUserService = GoogleUserService;
//# sourceMappingURL=googleUserService.js.map