type OAuthStartConfig = {
  preview?: unknown;
  appId: string;
  oAuthPortalUrl: string;
  frontendUrl: string;
  allowOAuthLoopback: boolean;
};

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
export function getOAuthStartUrl(config: OAuthStartConfig): string | undefined {
  if (config.preview || !config.oAuthPortalUrl) return undefined;
  if (
    !config.appId || /\s|[\u0000-\u001f\u007f]/.test(config.appId) ||
    config.appId.toLowerCase() === "boogme"
  ) {
    throw new Error("Invalid OAuth configuration");
  }
  const frontendOrigin = configuredOrigin(config.frontendUrl, config.allowOAuthLoopback);
  const portalOrigin = configuredOrigin(config.oAuthPortalUrl, config.allowOAuthLoopback);
  const redirectUri = `${frontendOrigin}/api/oauth/callback`;
  const url = new URL("/app-auth", portalOrigin);
  url.searchParams.set("appId", config.appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", Buffer.from(redirectUri, "utf8").toString("base64"));
  url.searchParams.set("type", "signIn");
  return url.toString();
}
