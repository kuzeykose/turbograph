"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { githubService } from "@/lib/services/github";
import { getLanguageColor } from "@/lib/utils/language-colors";
import Link from "next/link";
import { GitHubRepository } from "@/types/github";

interface Repository extends GitHubRepository {
  isTurborepo: boolean;
}

export default function RepositoriesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [showAllRepos, setShowAllRepos] = useState(false);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function fetchRepositories() {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch repositories from GitHub API
        const repos = await githubService.getUserRepositories({
          sort: "updated",
          perPage: 100,
        });

        // Use GitHub GraphQL API to batch check for turbo.json
        // This checks ~50 repos per request instead of 1 request per repo
        const repositoriesToCheck = repos.map((repo) => {
          const [owner, name] = repo.full_name.split("/");
          return { owner, name };
        });

        const turborepoResults = await githubService.batchCheckTurboJson(
          repositoriesToCheck
        );

        // Mark repositories with Turborepo detection
        const reposWithTurboCheck: Repository[] = repos.map((repo) => ({
          ...repo,
          isTurborepo: turborepoResults.get(repo.full_name) || false,
        }));

        setRepositories(reposWithTurboCheck);
      } catch (err) {
        console.error("Error fetching repositories:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch repositories",
        );
      } finally {
        setLoading(false);
      }
    }

    if (user && !authLoading) {
      fetchRepositories();
    }
  }, [user, authLoading]);

  const parseGitHubUrl = (
    url: string,
  ): { owner: string; repo: string } | null => {
    try {
      // Remove trailing slash and .git extension
      const cleanUrl = url
        .trim()
        .replace(/\.git$/, "")
        .replace(/\/$/, "");

      // Handle different GitHub URL formats
      // https://github.com/owner/repo
      // github.com/owner/repo
      // owner/repo
      const patterns = [
        /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/,
        /^github\.com\/([^\/]+)\/([^\/]+)/,
        /^([^\/]+)\/([^\/]+)$/,
      ];

      for (const pattern of patterns) {
        const match = cleanUrl.match(pattern);
        if (match) {
          return {
            owner: match[1],
            repo: match[2].replace(/\.git$/, ""),
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  };

  const handlePublicRepoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    if (!repoUrl.trim()) {
      setUrlError("Please enter a repository URL");
      return;
    }

    const parsed = parseGitHubUrl(repoUrl);

    if (!parsed) {
      setUrlError(
        "Invalid GitHub repository URL. Examples: https://github.com/owner/repo or owner/repo",
      );
      return;
    }

    // Navigate to the repository page
    router.push(`/repository/${parsed.owner}/${parsed.repo}`);
  };

  // Filter repositories based on toggle
  const filteredRepositories = showAllRepos
    ? repositories
    : repositories.filter((repo) => repo.isTurborepo);

  const turborepoCount = repositories.filter((repo) => repo.isTurborepo).length;

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-zinc-900 dark:text-zinc-50" />
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-7xl px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Your Repositories
              </h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Repositories from your GitHub account or browse any public
                repository
              </p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              Back to Dashboard
            </Link>
          </div>
          {/* Filter Toggle */}
          {!loading && !error && repositories.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => setShowAllRepos(!showAllRepos)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${showAllRepos
                    ? "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  }`}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                {showAllRepos ? "Show Turborepo Only" : "Show All Repositories"}
              </button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {showAllRepos ? (
                  <>
                    Showing all {repositories.length} repositories (
                    {turborepoCount} Turborepo{" "}
                    {turborepoCount === 1 ? "project" : "projects"})
                  </>
                ) : (
                  <>
                    Showing {turborepoCount} Turborepo{" "}
                    {turborepoCount === 1 ? "project" : "projects"} (of{" "}
                    {repositories.length} total)
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Public Repository URL Input */}
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Browse Public Repository
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Enter any public GitHub repository URL to explore its structure
              and dependencies
            </p>
          </div>
          <form
            onSubmit={handlePublicRepoSubmit}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="flex-1">
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  setUrlError(null);
                }}
                placeholder="https://github.com/vercel/turbo or vercel/turbo"
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500"
              />
              {urlError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {urlError}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Explore
            </button>
          </form>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p className="font-semibold">Error loading repositories</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && !error && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-zinc-900 dark:text-zinc-50" />
              <p className="mt-4 text-zinc-600 dark:text-zinc-400">
                Fetching repositories...
              </p>
            </div>
          </div>
        )}

        {/* Repositories List */}
        {!loading && !error && filteredRepositories.length > 0 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRepositories.map((repo) => (
                <div
                  key={repo.id}
                  className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {/* Repository Header */}
                  <div className="mb-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/repository/${repo.owner.login}/${repo.name}`}
                        className="text-lg font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {repo.name}
                      </Link>
                      <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        title="View on GitHub"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                        </svg>
                      </a>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {repo.isTurborepo && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Turborepo
                        </span>
                      )}
                      {repo.private && (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          Private
                        </span>
                      )}
                      {repo.fork && (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                          Fork
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {repo.description && (
                    <p className="mb-4 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {repo.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                    {repo.language && (
                      <div className="flex items-center gap-1">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: getLanguageColor(repo.language),
                          }}
                        />
                        <span>{repo.language}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                        />
                      </svg>
                      <span>{repo.stargazers_count}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <span>{repo.forks_count}</span>
                    </div>
                  </div>

                  {/* Updated Time */}
                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">
                      Updated {new Date(repo.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State - No repositories at all */}
        {!loading && !error && repositories.length === 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <svg
              className="mx-auto h-12 w-12 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              No repositories found
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              You don&apos;t have any repositories yet.
            </p>
            <a
              href="https://github.com/new"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Create a repository on GitHub
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        )}

        {/* Empty State - No Turborepo projects when filtered */}
        {!loading &&
          !error &&
          repositories.length > 0 &&
          filteredRepositories.length === 0 &&
          !showAllRepos && (
            <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <svg
                className="mx-auto h-12 w-12 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                No Turborepo projects found
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                None of your {repositories.length} repositories contain a
                turbo.json file.
              </p>
              <button
                onClick={() => setShowAllRepos(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Show all repositories
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
