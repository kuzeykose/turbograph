"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { Github } from "@workspace/ui/icons";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleGitHubSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createSupabaseBrowserClient();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      }
    } catch (_err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center overflow-auto">
      <div className="w-full max-w-sm px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Welcome
          </h1>
          <p className="mt-1 text-base text-zinc-400 dark:text-zinc-500">
            Sign in to your account to continue
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
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </main>
  );
}
