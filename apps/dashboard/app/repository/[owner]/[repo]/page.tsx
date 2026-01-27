"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase/client";
import { CodeViewer } from "@/components/code-viewer";
import { TurborepoGraph } from "@/components/turborepo-graph";
import { formatFileSize, isBinaryFile } from "@/lib/utils/format";
import {
  analyzeTurborepo,
  buildDependencyGraph,
  TurborepoStructure,
  DependencyEdge,
} from "@/lib/utils/turborepo";
import Link from "next/link";
import { Repository, ContentItem, FileContent } from "@/types/repository";
import { RepositoryHeader } from "@/components/repository-header";
import { CommitList, Commit, CommitFile } from '@/components/commit-list';

export default function RepositoryPage() {
  const params = useParams();
  const { user, loading: authLoading } = useAuth();

  const owner = params.owner as string;
  const repo = params.repo as string;

  const [repository, setRepository] = useState<Repository | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pathHistory, setPathHistory] = useState<string[]>([""]);

  // Commits state
  const [commits, setCommits] = useState<Commit[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMoreCommits, setHasMoreCommits] = useState(true);
  const commitsPerPage = 30;

  // Impact visualization state
  const [affectedPackages, setAffectedPackages] = useState<string[]>([]);
  const [downstreamDependents, setDownstreamDependents] = useState<string[]>([]);


  // Turborepo state
  const [activeTab, setActiveTab] = useState<"files" | "turborepo" | "commits">("files");
  const [turborepoStructure, setTurborepoStructure] =
    useState<TurborepoStructure | null>(null);
  const [turborepoLoading, setTurborepoLoading] = useState(false);
  const [dependencyGraph, setDependencyGraph] = useState<DependencyEdge[]>([]);

  // Fetch repository details and check for Turborepo
  useEffect(() => {
    async function fetchRepository() {
      if (!owner || !repo) return;

      try {
        // Get token if user is authenticated, otherwise make anonymous request
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.provider_token;

        const headers: Record<string, string> = {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        };

        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}`,
          {
            headers,
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch repository: ${response.statusText}`);
        }

        const data = await response.json();
        setRepository(data);

        // Check if this is a Turborepo
        setTurborepoLoading(true);
        try {
          const structure = await analyzeTurborepo(owner, repo, token || "");
          setTurborepoStructure(structure);

          if (structure.isTurborepo) {
            const graph = buildDependencyGraph(structure);
            setDependencyGraph(graph);
          }
        } catch (err) {
          console.error("Error analyzing Turborepo:", err);
        } finally {
          setTurborepoLoading(false);
        }
      } catch (err) {
        console.error("Error fetching repository:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch repository",
        );
      }
    }

    fetchRepository();
  }, [owner, repo]);

  // Fetch directory contents
  useEffect(() => {
    async function fetchContents() {
      if (!owner || !repo) return;

      try {
        setLoading(true);
        setError(null);
        setSelectedFile(null);

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.provider_token;

        const headers: Record<string, string> = {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        };

        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const url = currentPath
          ? `https://api.github.com/repos/${owner}/${repo}/contents/${currentPath}`
          : `https://api.github.com/repos/${owner}/${repo}/contents`;

        const response = await fetch(url, {
          headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch contents: ${response.statusText}`);
        }

        const data = await response.json();

        // If it's a file, show it directly
        if (!Array.isArray(data)) {
          handleFileClick(data);
          return;
        }

        setContents(data);
      } catch (err) {
        console.error("Error fetching contents:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch contents",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchContents();
  }, [owner, repo, currentPath]);

  // Fetch commits
  useEffect(() => {
    async function fetchCommits() {
      if (!owner || !repo || activeTab !== 'commits') return;

      try {
        setCommitsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.provider_token;

        const headers: Record<string, string> = {
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
        url.searchParams.append('page', currentPage.toString());
        url.searchParams.append('per_page', commitsPerPage.toString());

        const response = await fetch(url.toString(), {
          headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch commits: ${response.statusText}`);
        }

        const data = await response.json();
        setCommits(data);

        // Check if there are more commits (if we got less than per_page, we're on the last page)
        setHasMoreCommits(data.length === commitsPerPage);

        // Parse Link header for pagination info if available
        const linkHeader = response.headers.get('Link');
        if (linkHeader) {
          const lastPageMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
          if (lastPageMatch) {
            setTotalPages(parseInt(lastPageMatch[1]));
          }
        }
      } catch (err) {
        console.error('Error fetching commits:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch commits');
      } finally {
        setCommitsLoading(false);
      }
    }

    fetchCommits();
  }, [owner, repo, activeTab, currentPage]);

  // Fetch commit details (files changed)
  const fetchCommitDetails = async (sha: string): Promise<CommitFile[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.provider_token;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch commit details: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  };

  // Handle impact change from CommitList
  const handleImpactChange = (affected: string[], downstream: string[]) => {
    setAffectedPackages(affected);
    setDownstreamDependents(downstream);
  };

  // Filter graph to show only affected packages tree
  const getFilteredGraphData = () => {
    if (!turborepoStructure || affectedPackages.length === 0) {
      // Show full graph when no commit is expanded
      return {
        apps: turborepoStructure?.apps || [],
        packages: turborepoStructure?.packages || [],
        dependencies: dependencyGraph,
      };
    }

    // Combined set of all packages to show
    const packagesToShow = new Set([...affectedPackages, ...downstreamDependents]);

    // Filter apps and packages
    const filteredApps = turborepoStructure.apps.filter(app => packagesToShow.has(app.name));
    const filteredPackages = turborepoStructure.packages.filter(pkg => packagesToShow.has(pkg.name));

    // Filter dependencies to only show edges between visible nodes
    const filteredDependencies = dependencyGraph.filter(dep =>
      packagesToShow.has(dep.from) && packagesToShow.has(dep.to)
    );

    return {
      apps: filteredApps,
      packages: filteredPackages,
      dependencies: filteredDependencies,
    };
  };

  const handleFileClick = async (file: ContentItem) => {
    if (file.type === "dir") {
      setCurrentPath(file.path);
      setPathHistory([...pathHistory, file.path]);
      return;
    }

    // Check if file is binary
    if (isBinaryFile(file.name)) {
      setSelectedFile({
        name: file.name,
        path: file.path,
        content: "[Binary file - cannot display]",
        encoding: "binary",
        size: file.size || 0,
        sha: file.sha,
        type: "binary",
      });
      return;
    }

    // Fetch file content
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.provider_token;

      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(file.url, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      const data = await response.json();

      // Decode base64 content
      if (data.encoding === "base64" && data.content) {
        const decodedContent = atob(data.content.replace(/\n/g, ""));
        setSelectedFile({
          ...data,
          content: decodedContent,
        });
      }
    } catch (err) {
      console.error("Error fetching file:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch file");
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const newPath = pathHistory[index];
    setCurrentPath(newPath);
    setPathHistory(pathHistory.slice(0, index + 1));
  };

  const getFileIcon = (type: string, name: string) => {
    if (type === "dir") {
      return (
        <svg
          className="h-5 w-5 text-blue-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      );
    }
    return (
      <svg
        className="h-5 w-5 text-zinc-500"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
          clipRule="evenodd"
        />
      </svg>
    );
  };

  const getLanguageFromFilename = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      rb: "ruby",
      java: "java",
      go: "go",
      rs: "rust",
      cpp: "cpp",
      c: "c",
      h: "c",
      css: "css",
      scss: "scss",
      html: "html",
      json: "json",
      md: "markdown",
      yml: "yaml",
      yaml: "yaml",
      xml: "xml",
      sh: "shell",
      bash: "shell",
    };
    return languageMap[ext || ""] || "plaintext";
  };

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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <RepositoryHeader
        repository={repository}
        turborepoStructure={turborepoStructure}
      />
      <div className="mx-auto max-w-full px-4 py-6">
        {/* Tabs */}
        {turborepoStructure?.isTurborepo && (
          <div className="mb-6 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("files")}
                className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "files"
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  }`}
              >
                <div className="flex items-center gap-2">
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
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  Files
                </div>
              </button>
              <button
                onClick={() => setActiveTab('commits')}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'commits'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Commits
                </div>
              </button>
              <button
                onClick={() => setActiveTab("turborepo")}
                className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "turborepo"
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  }`}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  Dependencies
                  {dependencyGraph.length > 0 && (
                    <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {dependencyGraph.length}
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Info banner for unauthenticated users */}
        {!user && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-medium">Viewing as guest</p>
                <p className="mt-1">
                  You're viewing this repository without authentication. GitHub
                  API has rate limits for unauthenticated requests (60 requests
                  per hour).{" "}
                  <Link
                    href="/login"
                    className="font-medium underline hover:no-underline"
                  >
                    Sign in
                  </Link>{" "}
                  to increase your rate limit to 5,000 requests per hour.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Turborepo Analysis View */}
        {activeTab === "turborepo" && turborepoStructure?.isTurborepo && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            {turborepoLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-zinc-900 dark:text-zinc-50" />
                  <p className="mt-4 text-zinc-600 dark:text-zinc-400">
                    Analyzing Turborepo structure...
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                    Turborepo Dependency Graph
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Visualizing internal workspace dependencies between apps and
                    packages
                  </p>
                </div>

                {turborepoStructure.apps.length === 0 &&
                  turborepoStructure.packages.length === 0 ? (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-800">
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
                    <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                      No apps or packages found in this Turborepo
                    </p>
                  </div>
                ) : (
                  <TurborepoGraph
                    apps={turborepoStructure.apps}
                    packages={turborepoStructure.packages}
                    dependencies={dependencyGraph}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* File Browser View */}
        {activeTab === "files" && (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* File Browser */}
            <div className="lg:col-span-4">
              <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                {/* Breadcrumb */}
                <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center gap-1 text-sm">
                    <button
                      onClick={() => handleBreadcrumbClick(0)}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {repo}
                    </button>
                    {currentPath
                      .split("/")
                      .filter(Boolean)
                      .map((segment, index, array) => (
                        <div key={index} className="flex items-center gap-1">
                          <span className="text-zinc-400">/</span>
                          <button
                            onClick={() => handleBreadcrumbClick(index + 1)}
                            className={
                              index === array.length - 1
                                ? "text-zinc-900 dark:text-zinc-50"
                                : "text-blue-600 hover:underline dark:text-blue-400"
                            }
                          >
                            {segment}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* File List */}
                <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent text-zinc-900 dark:text-zinc-50" />
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {contents
                        .sort((a, b) => {
                          if (a.type === b.type)
                            return a.name.localeCompare(b.name);
                          return a.type === "dir" ? -1 : 1;
                        })
                        .map((item) => (
                          <button
                            key={item.sha}
                            onClick={() => handleFileClick(item)}
                            className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                          >
                            {getFileIcon(item.type, item.name)}
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                                {item.name}
                              </p>
                              {item.type === "file" &&
                                item.size !== undefined && (
                                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                                    {formatFileSize(item.size)}
                                  </p>
                                )}
                            </div>
                            {item.type === "dir" && (
                              <svg
                                className="h-4 w-4 text-zinc-400"
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
                            )}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Code Viewer */}
            <div className="lg:col-span-8">
              <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                {selectedFile ? (
                  <div className="max-h-[calc(100vh-200px)] overflow-auto">
                    <CodeViewer
                      content={selectedFile.content}
                      filename={selectedFile.name}
                      language={getLanguageFromFilename(selectedFile.name)}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[calc(100vh-300px)] items-center justify-center p-8">
                    <div className="text-center">
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
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                        Select a file to view its contents
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


        {/* Commits View */}
        {activeTab === 'commits' && (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Commit List - Left Column */}
            <div className="lg:col-span-5">
              <CommitList
                commits={commits}
                loading={commitsLoading}
                currentPage={currentPage}
                totalPages={totalPages}
                hasMore={hasMoreCommits}
                onPageChange={setCurrentPage}
                turborepoStructure={turborepoStructure || undefined}
                dependencyGraph={dependencyGraph}
                onFetchCommitDetails={fetchCommitDetails}
                onImpactChange={handleImpactChange}
              />
            </div>

            {/* Dependency Graph - Right Column */}
            <div className="lg:col-span-7">
              <div className="sticky top-6">
                {turborepoStructure?.isTurborepo ? (() => {
                  const filteredData = getFilteredGraphData();
                  return (
                    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {affectedPackages.length > 0 ? 'Commit Impact Tree' : 'Dependency Graph'}
                      </h3>
                      {affectedPackages.length > 0 ? (
                        <div className="mb-4 space-y-2">
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Showing {affectedPackages.length} affected package{affectedPackages.length !== 1 ? 's' : ''} and {downstreamDependents.length} downstream dependent{downstreamDependents.length !== 1 ? 's' : ''}
                          </p>
                          <div className="flex gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                              <div className="h-3 w-3 rounded-full bg-purple-500" />
                              <span className="text-zinc-600 dark:text-zinc-400">Affected Packages</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="h-3 w-3 rounded-full bg-orange-500" />
                              <span className="text-zinc-600 dark:text-zinc-400">Downstream Dependents</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                          Expand a commit to see its impact tree
                        </p>
                      )}
                      <TurborepoGraph
                        apps={filteredData.apps}
                        packages={filteredData.packages}
                        dependencies={filteredData.dependencies}
                      />
                    </div>
                  );
                })() : (
                  <div className="rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-center">
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
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                      <h3 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        Not a Turborepo
                      </h3>
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        Dependency graph visualization is only available for Turborepo monorepos
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
