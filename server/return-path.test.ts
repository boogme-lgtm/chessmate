import { describe, expect, it } from "vitest";
import { getSignInPath, toSafeReturnPath } from "@shared/returnPath";

describe("post-sign-in return paths", () => {
  it.each(["/", "/coach/42", "/coach/42?tab=book#slots", "/courses/a%20b", "/dashboard/apiary", "/apis"])(
    "keeps the same-origin page path %j",
    path => {
      expect(toSafeReturnPath(path)).toBe(path);
    },
  );

  it.each([
    ["an absolute URL", "https://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash the browser reads as a slash", "/\\evil.example"],
    ["a backslash later in the path", "/coach\\..\\..\\evil"],
    ["a tab the browser strips", "/\t/evil.example"],
    ["a newline the browser strips", "/\n/evil.example"],
    ["a scheme", "javascript:alert(1)"],
    ["a relative path", "coach/42"],
    ["an empty value", ""],
    ["a server endpoint", "/api/force-logout"],
    ["the OAuth entry point", "/api/oauth/start"],
    ["a server endpoint in another case", "/API/force-logout"],
    ["a server endpoint reached through a dot segment", "/coach/../api/force-logout"],
    ["a server endpoint reached through an encoded dot segment", "/coach/%2e%2e/api/force-logout"],
    ["the API root", "/api"],
    ["an oversized value", `/${"a".repeat(1024)}`],
  ])("refuses %s", (_label, value) => {
    expect(toSafeReturnPath(value)).toBeNull();
  });

  it.each([undefined, null, 42, ["/coach/42"], { path: "/coach/42" }])("refuses the non-string %j", value => {
    expect(toSafeReturnPath(value)).toBeNull();
  });
});

describe("sign-in page links", () => {
  it("adds only what is needed, with the OAuth flag first", () => {
    expect(getSignInPath()).toBe("/sign-in");
    expect(getSignInPath({ returnTo: "/" })).toBe("/sign-in");
    expect(getSignInPath({ returnTo: "/coach/42?tab=book" })).toBe("/sign-in?redirect=%2Fcoach%2F42%3Ftab%3Dbook");
    expect(getSignInPath({ oauthError: "expired" })).toBe("/sign-in?oauthError=expired");
    expect(getSignInPath({ oauthError: "expired", returnTo: "/coach/42" }))
      .toBe("/sign-in?oauthError=expired&redirect=%2Fcoach%2F42");
  });

  it.each(["//evil.example", "https://evil.example", "/api/force-logout", null])(
    "drops the unsafe return path %j",
    returnTo => {
      expect(getSignInPath({ oauthError: "expired", returnTo })).toBe("/sign-in?oauthError=expired");
    },
  );
});
