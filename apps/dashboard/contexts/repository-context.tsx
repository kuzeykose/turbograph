"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { githubService } from "@/lib/services/github";
import {
  analyzeTurborepo,
  buildDependencyGraph,
  TurborepoStructure,
  DependencyEdge,
} from "@/lib/utils/turborepo";
import { Repository } from "@/types/repository";

type TabValue = "files" | "commits" | "turborepo";

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

  // Tab state - read from URL or default to "files"
  const tabFromUrl = searchParams.get("tab") as TabValue | null;
  const [activeTab, setActiveTabState] = useState<TabValue>(
    tabFromUrl && ["files", "commits", "turborepo"].includes(tabFromUrl)
      ? tabFromUrl
      : "files"
  );

  // Repository state
  const [repository, setRepository] = useState<Repository | null>(null);
  const [turborepoStructure, setTurborepoStructure] =
    useState<TurborepoStructure | null>(null);
  const [dependencyGraph, setDependencyGraph] = useState<DependencyEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [turborepoLoading, setTurborepoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab setter that syncs with URL
  const setActiveTab = useCallback(
    (tab: TabValue) => {
      setActiveTabState(tab);

      // Update URL with new tab param
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "files") {
        params.delete("tab"); // "files" is default, no need to show in URL
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
    const tabFromUrl = searchParams.get("tab") as TabValue | null;
    const newTab =
      tabFromUrl && ["files", "commits", "turborepo"].includes(tabFromUrl)
        ? tabFromUrl
        : "files";
    setActiveTabState(newTab);
  }, [searchParams]);

  // Fetch repository data
  useEffect(() => {
    async function fetchRepository() {
      if (!owner || !repo) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const data = await githubService.getRepository(owner, repo);
        setRepository(data);

        // Check if this is a Turborepo
        setTurborepoLoading(true);
        try {
          const structure = await analyzeTurborepo(owner, repo, "");
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
          err instanceof Error ? err.message : "Failed to fetch repository"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchRepository();
  }, [owner, repo]);

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
