import {
  COOKIE_NAME,
  OAUTH_SIGN_IN_ERROR_PARAM,
  OAUTH_SIGN_IN_EXPIRED,
  ONE_YEAR_MS,
} from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";
import {
  OAUTH_CALLBACK_PATH,
  OAUTH_FLOW_COOKIE,
  OAUTH_FLOW_TTL_MS,
  createOAuthFlowNonce,
  getOAuthFlowCookieOptions,
  isOAuthStateBound,
  readOAuthFlowCookie,
} from "./oauthFlow";
import { OAUTH_AUTHORIZE_PATH, getOAuthSignInTarget, getOAuthStartUrl } from "./oauthStart";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function flowCookieIsSecure(): boolean {
  try {
    return getOAuthSignInTarget(ENV)?.secureCookies ?? true;
  } catch {
    return true;
  }
}

export function registerOAuthRoutes(app: Express) {
  registerOAuthStartRoutes(app);
  registerOAuthCallbackRoutes(app);
}

export function registerOAuthStartRoutes(app: Express) {
  app.get("/api/oauth/availability", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    let enabled = false;
    try {
      enabled = Boolean(getOAuthSignInTarget(ENV));
    } catch {
      // Expose only a Boolean, never configuration or provider details.
    }
    res.json({ enabled });
  });

  // Sign-in links may be followed on any host serving the app (e.g. a platform domain), but the
  // flow cookie must be set on the configured callback origin, so always hop there first.
  app.get("/api/oauth/start", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      res.redirect(302, getOAuthSignInTarget(ENV)?.authorizeUrl ?? "/sign-in");
    } catch {
      res.status(503).json({ error: "OAuth sign-in is unavailable" });
    }
  });

  app.get(OAUTH_AUTHORIZE_PATH, (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const target = getOAuthSignInTarget(ENV);
      if (!target) {
        res.redirect(302, "/sign-in");
        return;
      }
      const flowNonce = createOAuthFlowNonce();
      const location = getOAuthStartUrl(target, flowNonce);
      res.cookie(OAUTH_FLOW_COOKIE, flowNonce, {
        ...getOAuthFlowCookieOptions(target.secureCookies),
        maxAge: OAUTH_FLOW_TTL_MS,
      });
      res.redirect(302, location);
    } catch {
      res.status(503).json({ error: "OAuth sign-in is unavailable" });
    }
  });
}

export function registerOAuthCallbackRoutes(app: Express) {
  app.get(OAUTH_CALLBACK_PATH, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const flowCookie = readOAuthFlowCookie(req);
    // Single use whatever the outcome: clear the binding before any validation or exchange.
    res.clearCookie(OAUTH_FLOW_COOKIE, getOAuthFlowCookieOptions(flowCookieIsSecure()));

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    if (!isOAuthStateBound(state, flowCookie)) {
      // Missing, expired, replayed or foreign flow (login CSRF): never exchange this code.
      console.warn("[OAuth] Rejected a callback that does not match this browser's sign-in flow");
      res.redirect(302, `/sign-in?${OAUTH_SIGN_IN_ERROR_PARAM}=${OAUTH_SIGN_IN_EXPIRED}`);
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? "",
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
