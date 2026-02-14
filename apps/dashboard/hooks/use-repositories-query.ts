"use client";

import { useQuery } from "@tanstack/react-query";
import { githubService } from "@/lib/services/github";
import { queryKeys } from "@/lib/query-keys";
import { GitHubRepository } from "@/types/github";

export interface RepositoryWithTurbo extends GitHubRepository {
  isTurborepo: boolean;
}

async function fetchRepositories(): Promise<RepositoryWithTurbo[]> {
  const repos = await githubService.getUserRepositories({
    sort: "updated",
    perPage: 100,
  });

  const repositoriesToCheck = repos.map((repo) => {
    const [owner, name] = repo.full_name.split("/");
    return { owner, name };
  });

  const turborepoResults =
    await githubService.batchCheckTurboJson(repositoriesToCheck);

  return repos.map((repo) => ({
    ...repo,
    isTurborepo: turborepoResults.get(repo.full_name) || false,
  }));
}

export function useRepositoriesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.repositories.userRepos(),
    queryFn: fetchRepositories,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}
