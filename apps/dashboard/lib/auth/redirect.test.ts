import {
  buildLoginUrl,
  buildOAuthCallbackUrl,
  getSafeRedirectPath,
  loginErrorMessage,
  pathWithSearch,
  GITHUB_OAUTH_SCOPES,
} from "./redirect";

describe("getSafeRedirectPath", () => {
  it("defaults to the dashboard when next is missing", () => {
    expect(getSafeRedirectPath(null)).toBe("/dashboard");
    expect(getSafeRedirectPath(undefined)).toBe("/dashboard");
    expect(getSafeRedirectPath("")).toBe("/dashboard");
  });

  it("allows relative app paths including query strings", () => {
    expect(getSafeRedirectPath("/settings")).toBe("/settings");
    expect(
      getSafeRedirectPath("/repository/acme/app?tab=analysis&branch=main"),
    ).toBe("/repository/acme/app?tab=analysis&branch=main");
  });

  it("rejects open redirects and the site root", () => {
    expect(getSafeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(getSafeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(getSafeRedirectPath("/\\evil.example")).toBe("/dashboard");
    expect(getSafeRedirectPath("/")).toBe("/dashboard");
  });

  it("decodes encoded paths", () => {
    expect(getSafeRedirectPath("%2Fsettings")).toBe("/settings");
  });
});

describe("pathWithSearch", () => {
  it("joins pathname and search", () => {
    expect(pathWithSearch("/repository/a/b", "tab=analysis")).toBe(
      "/repository/a/b?tab=analysis",
    );
    expect(pathWithSearch("/repository/a/b", "?tab=analysis")).toBe(
      "/repository/a/b?tab=analysis",
    );
    expect(pathWithSearch("/repository/a/b", "")).toBe("/repository/a/b");
  });
});

describe("buildLoginUrl", () => {
  it("always includes a sanitized next param", () => {
    expect(buildLoginUrl("/settings")).toBe("/login?next=%2Fsettings");
    expect(buildLoginUrl("//evil.example")).toBe("/login?next=%2Fdashboard");
  });
});

describe("buildOAuthCallbackUrl", () => {
  it("forwards a sanitized next path", () => {
    expect(buildOAuthCallbackUrl("https://app.example", "/settings")).toBe(
      "https://app.example/auth/callback?next=%2Fsettings",
    );
  });
});

describe("loginErrorMessage", () => {
  it("maps OAuth error params to a user-facing message", () => {
    expect(loginErrorMessage(null)).toBeNull();
    expect(loginErrorMessage("auth_failed")).toBe(
      "GitHub sign-in was cancelled or failed. Try again.",
    );
    expect(loginErrorMessage("access_denied")).toBe(
      "GitHub sign-in was cancelled or failed. Try again.",
    );
  });
});

describe("GITHUB_OAUTH_SCOPES", () => {
  it("requests public repo access through an OAuth App", () => {
    expect(GITHUB_OAUTH_SCOPES).toBe("public_repo read:user");
  });
});
