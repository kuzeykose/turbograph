import { useEffect, useState } from "react";
import { githubService } from "@/lib/services/github";

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
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    async function fetchCommits() {
      if (!owner || !repo || !enabled) return;

      try {
        setLoading(true);
        setError(null);

        const response = await githubService.getCommits(owner, repo, {
          page: currentPage,
          perPage,
          sha: branch,
        });

        setCommits(response.data);
        setHasMore(response.hasMore);

        if (response.totalPages) {
          setTotalPages(response.totalPages);
        }
      } catch (err) {
        console.error("Error fetching commits:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch commits");
      } finally {
        setLoading(false);
      }
    }

    fetchCommits();
  }, [owner, repo, currentPage, branch, perPage, enabled]);

  const setPage = (page: number) => {
    setCurrentPage(page);
  };

  const fetchCommitDetails = async (sha: string): Promise<CommitFile[]> => {
    const data = await githubService.getCommit(owner, repo, sha);
    return data.files || [];
  };

  return {
    commits,
    loading,
    error,
    currentPage,
    totalPages,
    hasMore,
    setPage,
    fetchCommitDetails,
  };
}
