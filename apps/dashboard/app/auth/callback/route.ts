import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  GITHUB_PROVIDER_TOKEN_COOKIE,
  githubProviderTokenCookieOptions,
} from "@/lib/auth/github-token-cookie";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeRedirectPath(searchParams.get("next"));
  const oauthError = searchParams.get("error");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);

      const providerToken = data.session?.provider_token;
      if (providerToken) {
        response.cookies.set(
          GITHUB_PROVIDER_TOKEN_COOKIE,
          providerToken,
          githubProviderTokenCookieOptions(),
        );
      }

      return response;
    }

    console.error("Error exchanging code for session:", error.message);
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set(
    "error",
    oauthError === "access_denied" ? "access_denied" : "auth_failed",
  );
  loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}
