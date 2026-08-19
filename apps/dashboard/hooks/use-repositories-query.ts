"use client";

import { useQuery } from "@tanstack/react-query";
import { githubService } from "@/lib/services/github";
import { queryKeys } from "@/lib/query-keys";
import { GitHubRepository } from "@/types/github";

export interface RepositoryWithTurbo extends GitHubRepository {
  isTurborepo: boolean;
}

interface RepositoriesResult {
  repositories: RepositoryWithTurbo[];
}

async function fetchRepositories(): Promise<RepositoriesResult> {
  const repos = await githubService.getUserRepositories({
    sort: "updated",
    type: "all",
  });

  if (repos.length === 0) {
    return { repositories: [] };
  }

  const repositoriesToCheck = repos.map((repo) => {
    const [owner, name] = repo.full_name.split("/");
    return { owner, name };
  });

  const turborepoResults =
    await githubService.batchCheckTurboConfig(repositoriesToCheck);

  const repositories = repos.map((repo) => ({
    ...repo,
    isTurborepo: turborepoResults.get(repo.full_name) || false,
  }));

  return { repositories };
}

export function useRepositoriesQuery(enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.repositories.userRepos(),
    queryFn: fetchRepositories,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });

  return {
    ...query,
    repositories: query.data?.repositories ?? [],
  };
}
