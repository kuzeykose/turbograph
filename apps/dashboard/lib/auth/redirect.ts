export const DEFAULT_POST_LOGIN_PATH = "/dashboard";

/**
 * Accept only same-origin relative paths to avoid open redirects.
 * Rejects protocol-relative URLs, backslashes, and the site root (home
 * should land on the dashboard after sign-in).
 */
export function getSafeRedirectPath(
  next: string | null | undefined,
  fallback = DEFAULT_POST_LOGIN_PATH,
): string {
  if (!next) {
    return fallback;
  }

  let decoded = next.trim();
  try {
    decoded = decodeURIComponent(decoded).trim();
  } catch {
    return fallback;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//")) {
    return fallback;
  }

  if (
    decoded.includes("://") ||
    decoded.includes("\\") ||
    decoded.includes("%5c") ||
    decoded.includes("%5C")
  ) {
    return fallback;
  }

  if (decoded === "/") {
    return fallback;
  }

  return decoded;
}

export function pathWithSearch(pathname: string, search: string): string {
  if (!search) {
    return pathname;
  }

  return `${pathname}${search.startsWith("?") ? search : `?${search}`}`;
}

export function buildLoginUrl(next?: string | null): string {
  const path = getSafeRedirectPath(next);
  return `/login?next=${encodeURIComponent(path)}`;
}

export function buildOAuthCallbackUrl(
  origin: string,
  next?: string | null,
): string {
  const path = getSafeRedirectPath(next);
  return `${origin}/auth/callback?next=${encodeURIComponent(path)}`;
}

export function loginErrorMessage(errorParam: string | null): string | null {
  if (!errorParam) {
    return null;
  }

  return "GitHub sign-in was cancelled or failed. Try again.";
}
