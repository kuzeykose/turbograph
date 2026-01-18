'use client';

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
    try {
      // Remove trailing slash and .git extension
      const cleanUrl = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
      
      // Handle different GitHub URL formats
      // https://github.com/owner/repo
      // github.com/owner/repo
      // owner/repo
      const patterns = [
        /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/,
        /^github\.com\/([^\/]+)\/([^\/]+)/,
        /^([^\/]+)\/([^\/]+)$/
      ];

      for (const pattern of patterns) {
        const match = cleanUrl.match(pattern);
        if (match) {
          return {
            owner: match[1],
            repo: match[2].replace(/\.git$/, '')
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
      setUrlError('Please enter a repository URL');
      return;
    }

    const parsed = parseGitHubUrl(repoUrl);
    
    if (!parsed) {
      setUrlError('Invalid GitHub repository URL. Examples: https://github.com/owner/repo or owner/repo');
      return;
    }

    // Navigate to the repository page
    router.push(`/repository/${parsed.owner}/${parsed.repo}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            GitHub Repository Explorer
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Explore GitHub repositories, browse code, and visualize Turborepo dependency graphs.
          </p>
          {user && (
            <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
              Welcome back, {user.user_metadata?.name || user.email}!
            </p>
          )}
          
          {/* Public Repository URL Input */}
          <div className="w-full max-w-md">
            <form onSubmit={handlePublicRepoSubmit} className="flex flex-col gap-3">
              <div>
                <label htmlFor="repo-url" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Explore a Public Repository
                </label>
                <input
                  id="repo-url"
                  type="text"
                  value={repoUrl}
                  onChange={(e) => {
                    setRepoUrl(e.target.value);
                    setUrlError(null);
                  }}
                  placeholder="vercel/turbo or github.com/facebook/react"
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
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Explore Repository
              </button>
            </form>
          </div>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          {loading ? (
            <div className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 dark:border-white/[.145] md:w-[158px]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
            </div>
          ) : user ? (
            <Link
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[200px]"
              href="/dashboard"
            >
              Go to Dashboard
            </Link>
          ) : (
            <Link
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
              href="/login"
            >
              Sign In
            </Link>
          )}
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
      </main>
    </div>
  );
}
