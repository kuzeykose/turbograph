"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { Tabs, TabsContent } from "@workspace/ui/components/tabs";
import { Info } from "@workspace/ui/icons";
import { RepositoryHeader } from "@/components/repository-header";
import { RepositoryTabBar } from "@/components/repository-tab-bar";
import { FilesTab } from "@/components/files-tab";
import { CommitsTab } from "@/components/commits-tab";
import { DependenciesTab } from "@/components/dependencies-tab";
import { useRepository } from "@/hooks/use-repository";
import { useFileNavigation } from "@/hooks/use-file-navigation";
import { useCommitHistory } from "@/hooks/use-commit-history";
import { useImpactAnalysis } from "@/hooks/use-impact-analysis";

export default function RepositoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const owner = params.owner as string;
  const repo = params.repo as string;
  const branch = searchParams.get("branch") || undefined;

  // Tab state
  const [activeTab, setActiveTab] = useState<"files" | "turborepo" | "commits">("files");

  // Custom hooks for state management
  const {
    repository,
    turborepoStructure,
    dependencyGraph,
    loading: repoLoading,
    turborepoLoading,
    error: repoError,
  } = useRepository({ owner, repo });

  const {
    contents,
    selectedFile,
    loading: filesLoading,
    error: filesError,
    handleFileClick,
  } = useFileNavigation({ owner, repo, branch });

  const {
    commits,
    loading: commitsLoading,
    error: commitsError,
    currentPage,
    totalPages,
    hasMore: hasMoreCommits,
    setPage,
    fetchCommitDetails,
  } = useCommitHistory({
    owner,
    repo,
    branch,
    perPage: 30,
    enabled: activeTab === "commits",
  });

  const { affectedPackages, downstreamDependents, handleImpactChange } =
    useImpactAnalysis();

  // Aggregate errors and loading states
  const error = repoError || filesError || commitsError;
  const loading = filesLoading;

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
              <Info className="h-5 w-5 flex-shrink-0" />
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
          <Tabs
            value={activeTab}
            onValueChange={(val) =>
              setActiveTab(val as "files" | "commits" | "turborepo")
            }
            className="flex flex-col gap-4"
          >

            <RepositoryTabBar dependencyCount={dependencyGraph.length} />
            <TabsContent value="files">
              <FilesTab
                owner={owner}
                repo={repo}
                branch={branch}
                contents={contents}
                selectedFile={selectedFile}
                loading={loading}
                onFileClick={handleFileClick}
              />
            </TabsContent>
            <TabsContent value="commits">
              <CommitsTab
                commits={commits}
                commitsLoading={commitsLoading}
                currentPage={currentPage}
                totalPages={totalPages}
                hasMoreCommits={hasMoreCommits}
                onPageChange={setPage}
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
          </Tabs>
        ) : (
          <FilesTab
            owner={owner}
            repo={repo}
            branch={branch}
            contents={contents}
            selectedFile={selectedFile}
            loading={loading}
            onFileClick={handleFileClick}
          />
        )}
      </div>
    </div>
  );
}
