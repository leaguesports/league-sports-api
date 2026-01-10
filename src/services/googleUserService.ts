const BASE_USER_INFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export class GoogleUserService {
  async getUserInfo(accessToken: string) {
    const response = await fetch(BASE_USER_INFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userInfo = (await response.json()) as any;

    return userInfo;
  }
}
