import { OAUTH_RETURN_TO_PARAM } from "@shared/const";
import { toSafeReturnPath } from "@shared/returnPath";
import { OAUTH_CALLBACK_PATH, encodeOAuthState } from "./oauthFlow";

/** Same-origin hop that binds a sign-in flow to the browser before it leaves for the broker. */
export const OAUTH_AUTHORIZE_PATH = "/api/oauth/authorize";

type OAuthStartConfig = {
  preview?: unknown;
  appId: string;
  oAuthPortalUrl: string;
  frontendUrl: string;
  allowOAuthLoopback: boolean;
};

export type OAuthSignInTarget = Readonly<{
  appId: string;
  portalOrigin: string;
  /** The configured origin's binding hop, where the flow cookie is set for the callback. */
  authorizeUrl: string;
  redirectUri: string;
  secureCookies: boolean;
}>;

function configuredOrigin(value: string, allowLoopback: boolean): string {
  if (!value || value !== value.trim() || /[\u0000-\u0020\u007f\\?#]/.test(value)) {
    throw new Error("Invalid OAuth configuration");
  }
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(allowLoopback && loopback && url.protocol === "http:")) ||
    url.username || url.password || url.pathname !== "/" || url.search || url.hash
  ) {
    throw new Error("Invalid OAuth configuration");
  }
  return url.origin;
}

/** Resolve only trusted server configuration; request headers and queries are irrelevant. */
export function getOAuthSignInTarget(config: OAuthStartConfig): OAuthSignInTarget | undefined {
  if (config.preview || !config.oAuthPortalUrl) return undefined;
  if (
    !config.appId || /\s|[\u0000-\u001f\u007f]/.test(config.appId) ||
    config.appId.toLowerCase() === "boogme"
  ) {
    throw new Error("Invalid OAuth configuration");
  }
  const frontendOrigin = configuredOrigin(config.frontendUrl, config.allowOAuthLoopback);
  const portalOrigin = configuredOrigin(config.oAuthPortalUrl, config.allowOAuthLoopback);
  return {
    appId: config.appId,
    portalOrigin,
    authorizeUrl: `${frontendOrigin}${OAUTH_AUTHORIZE_PATH}`,
    redirectUri: `${frontendOrigin}${OAUTH_CALLBACK_PATH}`,
    // Validation admits HTTP only for the explicitly allowed loopback development origin.
    secureCookies: frontendOrigin.startsWith("https:"),
  };
}

/** The binding hop, carrying a validated return path (other than "/") for the flow cookie. */
export function getOAuthAuthorizeUrl(target: OAuthSignInTarget, returnTo: string | null): string {
  const path = toSafeReturnPath(returnTo);
  if (!path || path === "/") return target.authorizeUrl;
  return `${target.authorizeUrl}?${new URLSearchParams({ [OAUTH_RETURN_TO_PARAM]: path })}`;
}

/** Broker sign-in URL; the same `flowNonce` must be stored in the browser's flow cookie. */
export function getOAuthStartUrl(target: OAuthSignInTarget, flowNonce: string): string {
  const url = new URL("/app-auth", target.portalOrigin);
  url.searchParams.set("appId", target.appId);
  url.searchParams.set("redirectUri", target.redirectUri);
  url.searchParams.set("state", encodeOAuthState(target.redirectUri, flowNonce));
  url.searchParams.set("type", "signIn");
  return url.toString();
}
