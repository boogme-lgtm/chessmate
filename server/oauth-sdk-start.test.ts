import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const post = vi.fn();
  return {
    env: {
      preview: undefined,
      appId: "synthetic-runtime-project",
      oAuthPortalUrl: "https://portal.example.invalid",
      oAuthServerUrl: "https://api.example.invalid",
      frontendUrl: "https://app.example.invalid:8443/",
      allowOAuthLoopback: false,
    },
    post,
    create: vi.fn(() => ({ post })),
    getUserById: vi.fn(),
    getUserByOpenId: vi.fn(),
    upsertUser: vi.fn(),
  };
});

vi.mock("./_core/env", () => ({ ENV: mocks.env }));
vi.mock("axios", () => ({ default: { create: mocks.create } }));
vi.mock("./db", () => ({
  getUserById: mocks.getUserById,
  getUserByOpenId: mocks.getUserByOpenId,
  upsertUser: mocks.upsertUser,
}));

import { ENV } from "./_core/env";
import { createOAuthFlowNonce } from "./_core/oauthFlow";
import { getOAuthSignInTarget, getOAuthStartUrl } from "./_core/oauthStart";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("exchanges a start route state with the same runtime project and exact configured callback", async () => {
  vi.stubEnv("VITE_APP_ID", "boogme");
  mocks.post.mockResolvedValue({ data: { accessToken: "synthetic-access-token" } });
  const { sdk } = await vi.importActual<typeof import("./_core/sdk")>("./_core/sdk");
  const flowNonce = createOAuthFlowNonce();
  const startUrl = new URL(getOAuthStartUrl(getOAuthSignInTarget(ENV)!, flowNonce));
  expect(mocks.post).not.toHaveBeenCalled();

  const token = await sdk.exchangeCodeForToken("synthetic-code", startUrl.searchParams.get("state")!);

  expect(startUrl.searchParams.get("appId")).toBe("synthetic-runtime-project");
  expect(startUrl.searchParams.get("redirectUri")).toBe("https://app.example.invalid:8443/api/oauth/callback");
  // The flow nonce rides in state only; the exchange sends the bare, broker-validated URI.
  expect(atob(startUrl.searchParams.get("state")!)).toBe(
    `https://app.example.invalid:8443/api/oauth/callback?nonce=${flowNonce}`,
  );
  expect(mocks.post).toHaveBeenCalledTimes(1);
  expect(mocks.post).toHaveBeenCalledWith(
    "/webdev.v1.WebDevAuthPublicService/ExchangeToken",
    {
      clientId: startUrl.searchParams.get("appId"),
      grantType: "authorization_code",
      code: "synthetic-code",
      redirectUri: startUrl.searchParams.get("redirectUri"),
    },
  );
  expect(token).toEqual({ accessToken: "synthetic-access-token" });
  expect(mocks.getUserById).not.toHaveBeenCalled();
  expect(mocks.getUserByOpenId).not.toHaveBeenCalled();
  expect(mocks.upsertUser).not.toHaveBeenCalled();
});

it.each([
  ["a legacy unbound state", "https://app.example.invalid:8443/api/oauth/callback", "https://app.example.invalid:8443/api/oauth/callback"],
  ["a bound state on another host", `https://evil.example.invalid/api/oauth/callback?nonce=${"n".repeat(43)}`, "/"],
])("keeps the existing redirect validation for %s", async (_label, decoded, expectedRedirectUri) => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.post.mockResolvedValue({ data: { accessToken: "synthetic-access-token" } });
  const { sdk } = await vi.importActual<typeof import("./_core/sdk")>("./_core/sdk");
  mocks.post.mockClear();

  await sdk.exchangeCodeForToken("synthetic-code", Buffer.from(decoded).toString("base64"));

  expect(mocks.post).toHaveBeenCalledWith("/webdev.v1.WebDevAuthPublicService/ExchangeToken", {
    clientId: "synthetic-runtime-project",
    grantType: "authorization_code",
    code: "synthetic-code",
    redirectUri: expectedRedirectUri,
  });
});

it("refuses a state that is not base64 without contacting the provider", async () => {
  const { sdk } = await vi.importActual<typeof import("./_core/sdk")>("./_core/sdk");
  mocks.post.mockClear();
  await expect(sdk.exchangeCodeForToken("synthetic-code", "%%%")).rejects.toThrow("Invalid OAuth state");
  expect(mocks.post).not.toHaveBeenCalled();
});
