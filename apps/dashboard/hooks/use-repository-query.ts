"use client";

import { useQuery } from "@tanstack/react-query";
import { githubService } from "@/lib/services/github";
import { queryKeys } from "@/lib/query-keys";
import {
  analyzeTurborepo,
  buildDependencyGraph,
  TurborepoStructure,
  DependencyEdge,
} from "@/lib/utils/turborepo";
import { analyzeImportGraph } from "@/lib/utils/imports";
import type { ImportFileNode } from "@workspace/graph";

export function useRepositoryQuery(owner: string, repo: string) {
  return useQuery({
    queryKey: queryKeys.repository.detail(owner, repo),
    queryFn: () => githubService.getRepository(owner, repo),
    enabled: !!owner && !!repo,
    staleTime: 5 * 60 * 1000,
  });
}

interface TurborepoAnalysis {
  structure: TurborepoStructure;
  dependencyGraph: DependencyEdge[];
}

export function useTurborepoAnalysisQuery(
  owner: string,
  repo: string,
  branch?: string,
) {
  return useQuery<TurborepoAnalysis>({
    queryKey: queryKeys.repository.turborepo(owner, repo, branch),
    queryFn: async () => {
      const ref =
        branch ||
        (await githubService.getRepository(owner, repo)).default_branch ||
        "HEAD";
      const structure = await analyzeTurborepo(owner, repo, ref);
      const dependencyGraph = structure.isTurborepo
        ? buildDependencyGraph(structure)
        : [];
      return { structure, dependencyGraph };
    },
    enabled: !!owner && !!repo,
    staleTime: 5 * 60 * 1000,
  });
}

interface ImportGraphAnalysis {
  files: ImportFileNode[];
  edges: DependencyEdge[];
  scannedFiles: number;
  truncated: boolean;
}

export function useImportGraphQuery(
  owner: string,
  repo: string,
  structure: TurborepoStructure | null,
  branch?: string,
  enabled = false,
) {
  return useQuery<ImportGraphAnalysis>({
    queryKey: queryKeys.repository.imports(owner, repo, branch),
    queryFn: async () => {
      if (!structure) {
        return { files: [], edges: [], scannedFiles: 0, truncated: false };
      }
      const ref =
        branch ||
        (await githubService.getRepository(owner, repo)).default_branch ||
        "HEAD";
      return analyzeImportGraph(owner, repo, structure, ref);
    },
    enabled: enabled && !!owner && !!repo && !!structure?.isTurborepo,
    staleTime: 5 * 60 * 1000,
  });
}
