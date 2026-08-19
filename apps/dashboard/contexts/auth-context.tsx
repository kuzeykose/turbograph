'use client';

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { buildOAuthCallbackUrl, getSafeRedirectPath, GITHUB_OAUTH_SCOPES } from "@/lib/auth/redirect";
import {
  serializeClearedGitHubProviderTokenCookie,
  serializeGitHubProviderTokenCookie,
} from "@/lib/auth/github-token-cookie";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshGitHubToken: (returnTo?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshGitHubToken: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      // Save provider token to cookie if available
      // Supabase only provides provider_token during sign-in events
      if (session?.provider_token && typeof document !== "undefined") {
        document.cookie = serializeGitHubProviderTokenCookie(
          session.provider_token,
        );
        // Clear the refresh-attempt flag on successful token retrieval
        sessionStorage.removeItem("gh_token_refresh_attempted");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();

    if (typeof document !== "undefined") {
      document.cookie = serializeClearedGitHubProviderTokenCookie();
    }

    router.push("/login");
  };

  /**
   * Silently re-trigger the GitHub OAuth flow to get a fresh provider token.
   * Since the user already has an active GitHub session, GitHub will redirect
   * back immediately without prompting for credentials.
   * A sessionStorage flag prevents infinite redirect loops.
   */
  const refreshGitHubToken = async (returnTo?: string) => {
    if (typeof window === "undefined") return;

    // Prevent infinite loops: if we already tried refreshing this session, don't try again
    const refreshKey = "gh_token_refresh_attempted";
    if (sessionStorage.getItem(refreshKey)) {
      sessionStorage.removeItem(refreshKey);
      // If we already tried and still failing, show a sign-out prompt as fallback
      throw new Error("GitHub token refresh failed. Please sign out and sign in again.");
    }

    // Mark that we're attempting a refresh
    sessionStorage.setItem(refreshKey, "true");

    const supabase = createSupabaseBrowserClient();
    const redirectPath = getSafeRedirectPath(
      returnTo || `${window.location.pathname}${window.location.search}`,
    );

    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: buildOAuthCallbackUrl(window.location.origin, redirectPath),
        scopes: GITHUB_OAUTH_SCOPES,
      },
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshGitHubToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
