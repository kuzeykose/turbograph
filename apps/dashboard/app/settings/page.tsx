"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { buildLoginUrl } from "@/lib/auth/redirect";
import { Folder, ChevronRight, Github } from "@workspace/ui/icons";

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(buildLoginUrl("/settings"));
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-auto">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const userMetadata = user.user_metadata;
  const fullName = userMetadata?.full_name || userMetadata?.name;
  const username = userMetadata?.user_name || userMetadata?.preferred_username;

  return (
    <main className="flex-1 overflow-auto">
      <div className="mx-auto max-w-5xl px-6 py-6">
        {/* User Profile Card */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {fullName || username || "GitHub User"}
              </h2>
              {username && (
                <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                  @{username}
                </p>
              )}
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                {user.email}
              </p>
            </div>
          </div>

          {/* Account Details */}
          <div className="mt-6 space-y-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Account Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  Last Sign In
                </p>
                <p className="mt-0.5 text-xs text-zinc-900 dark:text-zinc-100">
                  {user.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  Created At
                </p>
                <p className="mt-0.5 text-xs text-zinc-900 dark:text-zinc-100">
                  {new Date(user.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href="/dashboard"
            className="group rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950/40">
                <Folder className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  View Repositories
                </h3>
                <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                  Browse and manage your GitHub repositories
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-600 shrink-0" />
            </div>
          </a>

          <a
            href="https://github.com/settings/profile"
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-purple-50 p-2.5 dark:bg-purple-950/40">
                <Github className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  GitHub Profile
                </h3>
                <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                  View and edit your GitHub profile settings
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-600 shrink-0" />
            </div>
          </a>
        </div>
      </div>
    </main>
  );
}
