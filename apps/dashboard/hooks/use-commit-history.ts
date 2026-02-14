import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { githubService } from "@/lib/services/github";
import { queryKeys } from "@/lib/query-keys";

export interface CommitFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed";
  additions: number;
  deletions: number;
  changes: number;
}

export interface Commit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
    html_url: string;
  } | null;
}

interface UseCommitHistoryOptions {
  owner: string;
  repo: string;
  branch?: string;
  perPage?: number;
  enabled?: boolean;
}

interface UseCommitHistoryReturn {
  commits: Commit[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
  setPage: (page: number) => void;
  fetchCommitDetails: (sha: string) => Promise<CommitFile[]>;
}

export function useCommitHistory({
  owner,
  repo,
  branch,
  perPage = 30,
  enabled = true,
}: UseCommitHistoryOptions): UseCommitHistoryReturn {
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.commits.list(owner, repo, currentPage, branch),
    queryFn: () =>
      githubService.getCommits(owner, repo, {
        page: currentPage,
        perPage,
        sha: branch,
      }),
    enabled: !!owner && !!repo && enabled,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const fetchCommitDetails = useCallback(
    async (sha: string): Promise<CommitFile[]> => {
      const data = await githubService.getCommit(owner, repo, sha);
      return data.files || [];
    },
    [owner, repo],
  );

  return {
    commits: (data?.data as Commit[]) ?? [],
    loading: isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "Failed to fetch commits"
      : null,
    currentPage,
    totalPages: data?.totalPages ?? 1,
    hasMore: data?.hasMore ?? true,
    setPage,
    fetchCommitDetails,
  };
}
