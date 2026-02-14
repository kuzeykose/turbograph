'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Folder, ChevronRight, Github } from '@workspace/ui/icons';

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-zinc-900 dark:text-zinc-50" />
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
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
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Settings
          </h1>
          <SignOutButton />
        </div>

        {/* User Profile Card */}
        <div className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {fullName || username || 'GitHub User'}
              </h2>
              {username && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  @{username}
                </p>
              )}
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {user.email}
              </p>
            </div>
          </div>

          {/* User Details */}
          <div className="mt-8 space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Account Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  User ID
                </p>
                <p className="mt-1 font-mono text-sm text-zinc-900 dark:text-zinc-50">
                  {user.id}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Provider
                </p>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  GitHub
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Last Sign In
                </p>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {user.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleString()
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Created At
                </p>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {new Date(user.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a
            href="/dashboard"
            className="group rounded-lg border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900">
                <Folder className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  View Repositories
                </h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Browse and manage your GitHub repositories
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1 dark:text-zinc-600" />
            </div>
          </a>

          <a
            href="https://github.com/settings/profile"
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-lg border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-purple-100 p-3 dark:bg-purple-900">
                <Github className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  GitHub Profile
                </h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  View and edit your GitHub profile settings
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1 dark:text-zinc-600" />
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
