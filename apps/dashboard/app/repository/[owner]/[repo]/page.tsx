"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRepositoryContext } from "@/contexts/repository-context";
import Link from "next/link";
import { Info } from "@workspace/ui/icons";
import { RepositorySidebar } from "@/components/repository-sidebar";
import { FilesTab } from "@/components/files-tab";
import { CommitsTab } from "@/components/commits-tab";
import { DependenciesTab } from "@/components/dependencies-tab";
import { useFileNavigation } from "@/hooks/use-file-navigation";
import { useCommitHistory } from "@/hooks/use-commit-history";
import { useImpactAnalysis } from "@/hooks/use-impact-analysis";

export default function RepositoryPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    owner,
    repo,
    branch,
    turborepoStructure,
    dependencyGraph,
    turborepoLoading,
    error: repoError,
    activeTab,
  } = useRepositoryContext();

  // Local hooks for tab-specific state
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

  // Aggregate errors
  const error = repoError || filesError || commitsError;

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-zinc-900 dark:text-zinc-50" />
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <RepositorySidebar />

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-full px-4 py-6">
          {/* Info banner for unauthenticated users */}
          {!user && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Viewing as guest</p>
                  <p className="mt-1">
                    You're viewing this repository without authentication.
                    GitHub API has rate limits for unauthenticated requests (60
                    requests per hour).{" "}
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
          {activeTab === "files" && (
            <FilesTab
              owner={owner}
              repo={repo}
              branch={branch}
              contents={contents}
              selectedFile={selectedFile}
              loading={filesLoading}
              onFileClick={handleFileClick}
            />
          )}

          {activeTab === "commits" && turborepoStructure?.isTurborepo && (
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
          )}

          {activeTab === "turborepo" && turborepoStructure?.isTurborepo && (
            <DependenciesTab
              turborepoStructure={turborepoStructure}
              turborepoLoading={turborepoLoading}
              dependencyGraph={dependencyGraph}
            />
          )}
        </div>
      </main>
    </>
  );
}
