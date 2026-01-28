import { useEffect, useState } from "react";
import { githubService } from "@/lib/services/github";
import {
  analyzeTurborepo,
  buildDependencyGraph,
  TurborepoStructure,
  DependencyEdge,
} from "@/lib/utils/turborepo";
import { Repository } from "@/types/repository";

interface UseRepositoryOptions {
  owner: string;
  repo: string;
  enabled?: boolean;
}

interface UseRepositoryReturn {
  repository: Repository | null;
  turborepoStructure: TurborepoStructure | null;
  dependencyGraph: DependencyEdge[];
  loading: boolean;
  turborepoLoading: boolean;
  error: string | null;
}

export function useRepository({
  owner,
  repo,
  enabled = true,
}: UseRepositoryOptions): UseRepositoryReturn {
  const [repository, setRepository] = useState<Repository | null>(null);
  const [turborepoStructure, setTurborepoStructure] =
    useState<TurborepoStructure | null>(null);
  const [dependencyGraph, setDependencyGraph] = useState<DependencyEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [turborepoLoading, setTurborepoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRepository() {
      if (!owner || !repo || !enabled) {
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
  }, [owner, repo, enabled]);

  return {
    repository,
    turborepoStructure,
    dependencyGraph,
    loading,
    turborepoLoading,
    error,
  };
}
