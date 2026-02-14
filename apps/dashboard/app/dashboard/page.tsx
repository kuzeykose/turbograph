"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useRepositoriesQuery } from "@/hooks/use-repositories-query";
import { getLanguageColor } from "@/lib/utils/language-colors";
import Link from "next/link";
import { GitHubAPIError } from "@/types/github";
import {
  Search,
  ExternalLink,
  Star,
  GitFork,
  Archive,
  ArrowRight,
  ChevronRight,
} from "@workspace/ui/icons";

type FilterMode = "turborepo" | "all";

export default function DashboardPage() {
  const { user, loading: authLoading, signOut, refreshGitHubToken } = useAuth();
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("turborepo");

  const {
    data: repositories = [],
    isLoading: loading,
    error: queryError,
  } = useRepositoriesQuery(!!user && !authLoading);

  // Handle auth errors
  const error = queryError
    ? queryError instanceof GitHubAPIError &&
      (queryError.status === 401 || queryError.status === 403)
      ? "Your GitHub session has expired. Please sign out and sign back in to refresh your access."
      : queryError instanceof Error
        ? queryError.message
        : "Failed to fetch repositories"
    : null;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Attempt token refresh on auth errors
  useEffect(() => {
    if (
      queryError instanceof GitHubAPIError &&
      (queryError.status === 401 || queryError.status === 403)
    ) {
      refreshGitHubToken("/dashboard").catch(() => {});
    }
  }, [queryError, refreshGitHubToken]);

  const parseGitHubUrl = (
    url: string,
  ): { owner: string; repo: string } | null => {
    try {
      const cleanUrl = url
        .trim()
        .replace(/\.git$/, "")
        .replace(/\/$/, "");

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
        "Invalid URL. Try: https://github.com/owner/repo or owner/repo",
      );
      return;
    }

    router.push(`/repository/${parsed.owner}/${parsed.repo}`);
  };

  const filteredRepositories = filter === "all"
    ? repositories
    : repositories.filter((repo) => repo.isTurborepo);

  const turborepoCount = repositories.filter((repo) => repo.isTurborepo).length;

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-auto">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="flex-1 overflow-auto">
      <div className="mx-auto max-w-5xl px-6 py-6">
        {/* Search bar */}
        <form
          onSubmit={handlePublicRepoSubmit}
          className="mb-6"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                setUrlError(null);
              }}
              placeholder="Search a public repository... owner/repo"
              className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-600 dark:focus:border-zinc-600"
            />
          </div>
          {urlError && (
            <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">
              {urlError}
            </p>
          )}
        </form>

        {/* Filter tabs + count */}
        {!loading && !error && repositories.length > 0 && (
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
              <button
                onClick={() => setFilter("turborepo")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === "turborepo"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                Turborepo ({turborepoCount})
              </button>
              <button
                onClick={() => setFilter("all")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === "all"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                All ({repositories.length})
              </button>
            </div>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {filteredRepositories.length} {filteredRepositories.length === 1 ? "repository" : "repositories"}
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <p>{error}</p>
            {error.includes("sign out") && (
              <button
                onClick={signOut}
                className="mt-2 text-xs font-medium underline underline-offset-2 hover:no-underline"
              >
                Sign out
              </button>
            )}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && !error && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mb-3 h-4 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                <div className="mb-4 h-3 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                <div className="flex gap-3">
                  <div className="h-3 w-12 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                  <div className="h-3 w-8 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                  <div className="h-3 w-8 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Repository grid */}
        {!loading && !error && filteredRepositories.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRepositories.map((repo) => (
              <Link
                key={repo.id}
                href={`/repository/${repo.owner.login}/${repo.name}`}
                className="group rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {repo.name}
                  </span>
                  <ChevronRight className="h-4 w-4 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-600 shrink-0" />
                </div>

                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {repo.owner.login}
                  </span>
                  {repo.isTurborepo && (
                    <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                      turbo
                    </span>
                  )}
                  {repo.private && (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                      private
                    </span>
                  )}
                  {repo.fork && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      fork
                    </span>
                  )}
                </div>

                {repo.description && (
                  <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {repo.description}
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
                  {repo.language && (
                    <span className="flex items-center gap-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: getLanguageColor(repo.language),
                        }}
                      />
                      {repo.language}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3" />
                    {repo.stargazers_count}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <GitFork className="h-3 w-3" />
                    {repo.forks_count}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty: no repos at all */}
        {!loading && !error && repositories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Archive className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              No repositories found
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              You don&apos;t have any repositories yet.
            </p>
            <a
              href="https://github.com/new"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-900 underline underline-offset-2 hover:no-underline dark:text-zinc-100"
            >
              Create on GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Empty: no turborepo projects */}
        {!loading &&
          !error &&
          repositories.length > 0 &&
          filteredRepositories.length === 0 &&
          filter === "turborepo" && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                No Turborepo projects found
              </p>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                None of your {repositories.length} repositories contain a turbo.json file.
              </p>
              <button
                onClick={() => setFilter("all")}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-900 underline underline-offset-2 hover:no-underline dark:text-zinc-100"
              >
                Show all repositories
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
      </div>
    </main>
  );
}
