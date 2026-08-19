"use client";

import { Suspense, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { Github } from "@workspace/ui/icons";
import {
  buildOAuthCallbackUrl,
  getSafeRedirectPath,
  loginErrorMessage,
  GITHUB_OAUTH_SCOPES,
} from "@/lib/auth/redirect";

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null | undefined>(
    undefined,
  );
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeRedirectPath(searchParams.get("next"));
  const urlError = loginErrorMessage(searchParams.get("error"));
  const error = actionError !== undefined ? actionError : urlError;

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(nextPath);
    }
  }, [user, authLoading, router, nextPath]);

  const handleGitHubSignIn = async () => {
    try {
      setLoading(true);
      setActionError(null);

      const supabase = createSupabaseBrowserClient();

      // Identity is created by Supabase Auth. GitHub is only the OAuth provider.
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: buildOAuthCallbackUrl(window.location.origin, nextPath),
          scopes: GITHUB_OAUTH_SCOPES,
        },
      });

      if (oauthError) {
        setActionError(oauthError.message);
        setLoading(false);
      }
    } catch {
      setActionError("An unexpected error occurred");
      setLoading(false);
    }
  };

  if (authLoading || user) {
    return (
      <main className="flex flex-1 items-center justify-center overflow-auto">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center overflow-auto">
      <div className="w-full max-w-sm px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Sign in with GitHub
          </h1>
          <p className="mt-1 text-base text-zinc-400 dark:text-zinc-500">
            Sign in with your GitHub account to continue.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={handleGitHubSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Github className="h-4 w-4" />
                <span>Sign in with GitHub</span>
              </>
            )}
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          GitHub will ask you to authorize repository access. You can revoke it
          anytime from GitHub Settings → Applications.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center overflow-auto">
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
