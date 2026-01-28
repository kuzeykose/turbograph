'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { SignOutButton } from '@/components/auth/sign-out-button';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Show loading state while checking authentication
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

  // Don't render dashboard if not authenticated
  if (!user) {
    return null;
  }

  // Get user metadata from GitHub
  const userMetadata = user.user_metadata;
  const avatarUrl = userMetadata?.avatar_url;
  const fullName = userMetadata?.full_name || userMetadata?.name;
  const username = userMetadata?.user_name || userMetadata?.preferred_username;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Dashboard
          </h1>
          <SignOutButton />
        </div>

        {/* User Profile Card */}
        <div className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-6">
            {/* {avatarUrl && (
              <Image
                src={avatarUrl}
                alt={fullName || username || 'User avatar'}
                width={80}
                height={80}
                className="rounded-full border-2 border-zinc-200 dark:border-zinc-700"
              />
            )} */}
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

        {/* Welcome Message */}
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Welcome to your dashboard!
          </h3>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            You have successfully authenticated with GitHub using Supabase. This
            is a protected route that requires authentication.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a
            href="/repositories"
            className="group rounded-lg border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900">
                <svg
                  className="h-6 w-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  View Repositories
                </h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Browse and manage your GitHub repositories
                </p>
              </div>
              <svg
                className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1 dark:text-zinc-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
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
                <svg
                  className="h-6 w-6 text-purple-600 dark:text-purple-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  GitHub Profile
                </h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  View and edit your GitHub profile settings
                </p>
              </div>
              <svg
                className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1 dark:text-zinc-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
