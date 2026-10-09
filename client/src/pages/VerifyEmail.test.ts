import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import VerifyEmail, { getPostVerificationPath } from "./VerifyEmail";

vi.mock("@/lib/trpc", () => ({
  trpc: { auth: { verifyEmail: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } } },
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/verify-email", vi.fn()],
  useSearch: () => "?token=synthetic-token",
}));

describe("after email verification", () => {
  it.each([
    [null, "/dashboard"],
    ["/coach/42", "/coach/42"],
    ["//evil.example", "/dashboard"],
    ["/\\evil.example", "/dashboard"],
    ["https://evil.example", "/dashboard"],
  ])("goes straight in from the browser that registered (stored %j)", (stored, expected) => {
    expect(getPostVerificationPath(true, stored)).toBe(expected);
  });

  it.each([
    [null, "/sign-in?redirect=%2Fdashboard"],
    ["/coach/42", "/sign-in?redirect=%2Fcoach%2F42"],
    ["//evil.example", "/sign-in?redirect=%2Fdashboard"],
  ])("signs in first anywhere else, keeping the destination (stored %j)", (stored, expected) => {
    expect(getPostVerificationPath(false, stored)).toBe(expected);
  });

  it("renders the waiting state without any navigation", () => {
    expect(renderToStaticMarkup(createElement(VerifyEmail))).toContain("Verifying Your Email");
  });
});
