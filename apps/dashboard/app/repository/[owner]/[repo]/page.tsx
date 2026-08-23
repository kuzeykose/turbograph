"use client";

import { useAuth } from "@/contexts/auth-context";
import { tabRequiresSignIn } from "@/lib/repository-tabs";
import { AI_ANALYSIS_ENABLED } from "@/lib/feature-flags";
import { useRepositoryContext } from "@/contexts/repository-context";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { buildLoginUrl, pathWithSearch } from "@/lib/auth/redirect";
import { RepositorySidebar } from "@/components/repository-sidebar";
import { SignInGate } from "@/components/sign-in-gate";
import { GuestNotice } from "@/components/guest-notice";
import { FilesTab } from "@/components/files-tab";
import { CommitsTab } from "@/components/commits-tab";
import { DependenciesTab } from "@/components/dependencies-tab";
import { PackagesTab } from "@/components/packages-tab";
import { AnalysisTab } from "@/components/analysis-tab";
import { ImportsTab } from "@/components/imports-tab";
import { useFileNavigation } from "@/hooks/use-file-navigation";
import { useCommitHistory } from "@/hooks/use-commit-history";
import { useImpactAnalysis } from "@/hooks/use-impact-analysis";

export default function RepositoryPage() {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loginHref = buildLoginUrl(
    pathWithSearch(pathname, searchParams.toString()),
  );
  const {
    owner,
    repo,
    branch,
    turborepoStructure,
    dependencyGraph,
    importGraph,
    importFiles,
    importGraphLoading,
    importGraphTruncated,
    importGraphScannedFiles,
    importGraphError,
    turborepoLoading,
    error: repoError,
    activeTab,
  } = useRepositoryContext();

  /**
   * The sidebar marks gated tabs but still opens them, so this prompt — not the
   * tab — is what a guest lands on, whether they clicked or came in by URL.
   * Held back while auth resolves, or a signed-in reader sees the prompt flash
   * before their session loads.
   */
  const tabLocked = !authLoading && !user && tabRequiresSignIn(activeTab);

  // Local hooks for tab-specific state
  const {
    contents,
    selectedFile,
    loading: filesLoading,
    error: filesError,
    handleFileClick,
  } = useFileNavigation({
    owner,
    repo,
    branch,
    // The prompt stands in for the tab, so don't spend the guest's rate limit
    // fetching contents behind it.
    enabled: activeTab === "files" && !tabLocked,
  });

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
      <>
        {/* Sidebar skeleton */}
        <div className="hidden lg:block w-[48px] flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 h-full">
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-8 rounded-sm bg-zinc-200 dark:bg-zinc-700 animate-pulse"
              />
            ))}
          </div>
        </div>
        {/* Main content skeleton */}
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col p-6 gap-6">
          {/* File tree skeleton */}
          <div className="flex gap-4 flex-1 min-h-0">
            <div className="w-64 flex-shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse flex-shrink-0" />
                  <div
                    className={`h-3.5 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse ${i % 3 === 0 ? "w-3/4" : i % 3 === 1 ? "w-1/2" : "w-2/3"
                      }`}
                  />
                </div>
              ))}
            </div>
            {/* Code viewer skeleton */}
            <div className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse ${i % 4 === 0 ? "w-full" : i % 4 === 1 ? "w-5/6" : i % 4 === 2 ? "w-3/4" : "w-2/3"
                    }`}
                />
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <RepositorySidebar />

      {/* Sits over the page in the corner, so a guest reads it without the
          repository being pushed down for it. */}
      {!user && <GuestNotice loginHref={loginHref} />}

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="w-full max-w-full flex-1 min-h-0 flex flex-col overflow-hidden">
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Turborepo loading skeleton */}
          {turborepoLoading && !turborepoStructure && activeTab !== "files" && !tabLocked && (
            <div className="flex-1 p-6 space-y-6">
              {/* Graph area skeleton */}
              <div className="space-y-3">
                <div className="h-5 w-40 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                <div className="h-64 w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              </div>
              {/* Stats cards skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3"
                  >
                    <div className="h-3.5 w-24 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                    <div className="h-8 w-16 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                    <div className="h-3 w-32 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* A guest opening a gated tab gets the pitch, not the tab. */}
          {tabLocked ? <SignInGate tab={activeTab} loginHref={loginHref} /> : null}

          {/* Tab content */}
          {!tabLocked && activeTab === "files" && (
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

          {!tabLocked && activeTab === "commits" && turborepoStructure?.isTurborepo && (
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
              owner={owner}
              repo={repo}
              branch={branch}
            />
          )}

          {!tabLocked && activeTab === "turborepo" && turborepoStructure?.isTurborepo && (
            <DependenciesTab
              turborepoStructure={turborepoStructure}
              turborepoLoading={turborepoLoading}
              dependencyGraph={dependencyGraph}
              owner={owner}
              repo={repo}
              branch={branch}
            />
          )}

          {!tabLocked && activeTab === "imports" && turborepoStructure?.isTurborepo && (
            <ImportsTab
              importFiles={importFiles}
              importGraph={importGraph}
              loading={turborepoLoading || importGraphLoading}
              truncated={importGraphTruncated}
              scannedFiles={importGraphScannedFiles}
              error={importGraphError}
              owner={owner}
              repo={repo}
              branch={branch}
            />
          )}

          {!tabLocked && activeTab === "packages" && turborepoStructure?.isTurborepo && (
            <PackagesTab
              turborepoStructure={turborepoStructure}
              turborepoLoading={turborepoLoading}
              dependencyGraph={dependencyGraph}
            />
          )}

          {AI_ANALYSIS_ENABLED && !tabLocked && activeTab === "analysis" && turborepoStructure?.isTurborepo && (
            <AnalysisTab
              turborepoStructure={turborepoStructure}
              dependencyGraph={dependencyGraph}
              owner={owner}
              repo={repo}
            />
          )}
        </div>
      </main>
    </>
  );
}
