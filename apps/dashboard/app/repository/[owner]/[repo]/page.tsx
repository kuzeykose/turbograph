"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase/client";
import {
  analyzeTurborepo,
  buildDependencyGraph,
  TurborepoStructure,
  DependencyEdge,
} from "@/lib/utils/turborepo";
import Link from "next/link";
import { Repository, ContentItem, FileContent } from "@/types/repository";
import { RepositoryHeader } from "@/components/repository-header";
import { CommitFile } from "@/components/commit-list";
import { Tabs, TabsContent } from "@workspace/ui/components/tabs";
import { RepositoryTabBar } from "@/components/repository-tab-bar";
import { FilesTab } from "@/components/files-tab";
import { CommitsTab } from "@/components/commits-tab";
import { DependenciesTab } from "@/components/dependencies-tab";
import { isBinaryFile } from "@/lib/utils/format";

export default function RepositoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const owner = params.owner as string;
  const repo = params.repo as string;
  const branch = searchParams.get("branch") || undefined;

  const [repository, setRepository] = useState<Repository | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pathHistory, setPathHistory] = useState<string[]>([""]);

  // Commits state
  const [commits, setCommits] = useState<import("@/components/commit-list").Commit[]>([]);
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

        let url = currentPath
          ? `https://api.github.com/repos/${owner}/${repo}/contents/${currentPath}`
          : `https://api.github.com/repos/${owner}/${repo}/contents`;

        if (branch) {
          url += `?ref=${branch}`;
        }

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
  }, [owner, repo, currentPath, branch]);

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
        if (branch) {
          url.searchParams.append('sha', branch);
        }

        const response = await fetch(url.toString(), {
          headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch commits: ${response.statusText}`);
        }

        const data = await response.json();
        setCommits(data);

        setHasMoreCommits(data.length === commitsPerPage);

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
  }, [owner, repo, activeTab, currentPage, branch]);

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
        currentBranch={branch}
      />
      <div className="mx-auto max-w-full px-4 py-6">
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


        {/* Tab content */}
        {turborepoStructure?.isTurborepo ? (
          <div>
            <Tabs
              value={activeTab}
              onValueChange={(val) =>
                setActiveTab(val as "files" | "commits" | "turborepo")
              }
              className="flex flex-col gap-4"
            >

              <div>
                <RepositoryTabBar dependencyCount={dependencyGraph.length} />
              </div>
              <div>
                <TabsContent value="files">
                  <FilesTab
                    repo={repo}
                    currentPath={currentPath}
                    contents={contents}
                    selectedFile={selectedFile}
                    loading={loading}
                    pathHistory={pathHistory}
                    onFileClick={handleFileClick}
                    onBreadcrumbClick={handleBreadcrumbClick}
                  />
                </TabsContent>
                <TabsContent value="commits">
                  <CommitsTab
                    commits={commits}
                    commitsLoading={commitsLoading}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    hasMoreCommits={hasMoreCommits}
                    onPageChange={setCurrentPage}
                    turborepoStructure={turborepoStructure}
                    dependencyGraph={dependencyGraph}
                    onFetchCommitDetails={fetchCommitDetails}
                    affectedPackages={affectedPackages}
                    downstreamDependents={downstreamDependents}
                    onImpactChange={handleImpactChange}
                  />
                </TabsContent>
                <TabsContent value="turborepo">
                  <DependenciesTab
                    turborepoStructure={turborepoStructure}
                    turborepoLoading={turborepoLoading}
                    dependencyGraph={dependencyGraph}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        ) : (
          <FilesTab
            repo={repo}
            currentPath={currentPath}
            contents={contents}
            selectedFile={selectedFile}
            loading={loading}
            pathHistory={pathHistory}
            onFileClick={handleFileClick}
            onBreadcrumbClick={handleBreadcrumbClick}
          />
        )}
      </div>
    </div>
  );
}
