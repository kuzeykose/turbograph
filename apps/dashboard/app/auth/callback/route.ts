import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);

      const providerToken = data.session?.provider_token;
      if (providerToken) {
        response.cookies.set("gh_provider_token", providerToken, {
          path: "/",
          httpOnly: false,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 8, // 8 hours
        });
      }

      return response;
    }

    console.error("Error exchanging code for session:", error.message);
  }

  // Return to login page with error if code exchange failed
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
