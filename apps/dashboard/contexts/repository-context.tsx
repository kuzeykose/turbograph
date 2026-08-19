"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  useRepositoryQuery,
  useTurborepoAnalysisQuery,
} from "@/hooks/use-repository-query";
import { TurborepoStructure, DependencyEdge } from "@/lib/utils/turborepo";
import { Repository } from "@/types/repository";

type TabValue = "files" | "commits" | "turborepo" | "packages" | "analysis";

interface RepositoryContextType {
  // Route params
  owner: string;
  repo: string;
  branch: string | undefined;

  // Repository data
  repository: Repository | null;
  turborepoStructure: TurborepoStructure | null;
  dependencyGraph: DependencyEdge[];
  loading: boolean;
  turborepoLoading: boolean;
  error: string | null;

  // Tab navigation (synced with URL via ?tab= param)
  activeTab: TabValue;
  setActiveTab: (tab: TabValue) => void;
}

const RepositoryContext = createContext<RepositoryContextType | undefined>(
  undefined
);

export function RepositoryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Route params
  const owner = params.owner as string;
  const repo = params.repo as string;
  const branch = searchParams.get("branch") || undefined;

  // Tab state - read from URL or default to "turborepo"
  const tabFromUrl = searchParams.get("tab") as TabValue | null;
  const [activeTabState, setActiveTabState] = useState<TabValue>(
    tabFromUrl && ["files", "commits", "turborepo", "packages", "analysis"].includes(tabFromUrl)
      ? tabFromUrl
      : "turborepo"
  );

  // Repository data via TanStack Query
  const {
    data: repository = null,
    isLoading: loading,
    error: repoError,
  } = useRepositoryQuery(owner, repo);

  const {
    data: turborepoData,
    isLoading: turborepoLoading,
  } = useTurborepoAnalysisQuery(owner, repo);

  const turborepoStructure = turborepoData?.structure ?? null;
  const dependencyGraph = turborepoData?.dependencyGraph ?? [];
  const error = repoError ? (repoError instanceof Error ? repoError.message : "Failed to fetch repository") : null;

  // Tab setter that syncs with URL
  const setActiveTab = useCallback(
    (tab: TabValue) => {
      setActiveTabState(tab);

      // Update URL with new tab param
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "turborepo") {
        params.delete("tab"); // "turborepo" is default, no need to show in URL
      } else {
        params.set("tab", tab);
      }

      const queryString = params.toString();
      const newUrl = queryString
        ? `${window.location.pathname}?${queryString}`
        : window.location.pathname;

      router.replace(newUrl, { scroll: false });
    },
    [searchParams, router]
  );

  // Sync tab state when URL changes externally
  useEffect(() => {
    const nextTabFromUrl = searchParams.get("tab") as TabValue | null;
    const newTab =
      nextTabFromUrl && ["files", "commits", "turborepo", "packages", "analysis"].includes(nextTabFromUrl)
        ? nextTabFromUrl
        : "turborepo";
    setActiveTabState(newTab);
  }, [searchParams]);

  // Non-Turborepo repos have no graph tabs — open Files instead of an empty view
  const activeTab: TabValue =
    !turborepoLoading && turborepoStructure && !turborepoStructure.isTurborepo
      ? "files"
      : activeTabState;

  return (
    <RepositoryContext.Provider
      value={{
        owner,
        repo,
        branch,
        repository,
        turborepoStructure,
        dependencyGraph,
        loading,
        turborepoLoading,
        error,
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepositoryContext() {
  const context = useContext(RepositoryContext);
  if (context === undefined) {
    throw new Error(
      "useRepositoryContext must be used within a RepositoryProvider"
    );
  }
  return context;
}
