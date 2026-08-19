export const GITHUB_PROVIDER_TOKEN_COOKIE = "gh_provider_token";
export const GITHUB_PROVIDER_TOKEN_MAX_AGE = 60 * 60 * 8;

function isSecureCookie(): boolean {
  if (typeof window !== "undefined") {
    return window.location.protocol === "https:";
  }

  return process.env.NODE_ENV === "production";
}

export function githubProviderTokenCookieOptions() {
  return {
    path: "/",
    httpOnly: false,
    secure: isSecureCookie(),
    sameSite: "lax" as const,
    maxAge: GITHUB_PROVIDER_TOKEN_MAX_AGE,
  };
}

export function serializeGitHubProviderTokenCookie(token: string): string {
  const options = githubProviderTokenCookieOptions();
  return `${GITHUB_PROVIDER_TOKEN_COOKIE}=${token}; path=${options.path}; max-age=${options.maxAge}; sameSite=${options.sameSite}${options.secure ? "; secure" : ""}`;
}

export function serializeClearedGitHubProviderTokenCookie(): string {
  const options = githubProviderTokenCookieOptions();
  return `${GITHUB_PROVIDER_TOKEN_COOKIE}=; path=${options.path}; max-age=0; sameSite=${options.sameSite}${options.secure ? "; secure" : ""}`;
}
