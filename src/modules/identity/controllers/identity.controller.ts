import { Request, Response } from "express";

import { IdentityConfig } from "../config";
import { AuthService } from "../services/auth.service";
import {
  getAuthCookieOptions,
  getClearAuthCookieOptions,
} from "../utils/cookie";
import { makeAuthenticationTokenParser } from "../utils/jwt";
import { resolvePostAuthRedirect } from "../utils/post-auth-redirect";

export type IdentityControllerDeps = {
  config: IdentityConfig;
  authService: AuthService;
};

export class IdentityController {
  private readonly config: IdentityConfig;
  private readonly authService: AuthService;
  private readonly parseAuthenticationToken: ReturnType<
    typeof makeAuthenticationTokenParser
  >;

  constructor(deps: IdentityControllerDeps) {
    this.config = deps.config;
    this.authService = deps.authService;
    this.parseAuthenticationToken = makeAuthenticationTokenParser(deps.config);
  }

  googleSignIn(req: Request, res: Response): void {
    const returnTo =
      typeof req.query.returnTo === "string" ? req.query.returnTo : undefined;
    const authenticationUrl =
      this.authService.getGoogleAuthenticationUrl(returnTo);
    res.redirect(authenticationUrl);
  }

  async googleCallback(req: Request, res: Response): Promise<void> {
    const authenticationCode = req.query.code as string;
    // Sign-in puts `returnTo` into Google OAuth `state`; Google echoes it here.
    const returnTo =
      typeof req.query.state === "string" ? req.query.state : undefined;
    const { token, frontendUrl } =
      await this.authService.signInWithGoogle(authenticationCode);

    res.cookie("token", token, getAuthCookieOptions(this.config));
    res.redirect(resolvePostAuthRedirect(returnTo, frontendUrl));
  }

  async me(req: Request, res: Response): Promise<void> {
    const { userId } = this.parseAuthenticationToken(req.cookies.token);
    const user = await this.authService.getMeUser(userId);

    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.status(200).json(user);
  }

  async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie("token", getClearAuthCookieOptions(this.config));
    res.status(204).send();
  }
}
