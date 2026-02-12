'use client';

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
    // Redirect to dashboard if already logged in
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
      // If successful, the user will be redirected to GitHub
    } catch (_err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to your account to continue
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          <button
            onClick={handleGitHubSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            {loading ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Github className="h-5 w-5" />
                <span>Sign in with GitHub</span>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-zinc-500 dark:text-zinc-500">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
