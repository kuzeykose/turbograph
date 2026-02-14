import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { githubService } from "@/lib/services/github";
import { queryKeys } from "@/lib/query-keys";
import { ContentItem, FileContent } from "@/types/repository";
import { isBinaryFile } from "@/lib/utils/format";

interface UseFileNavigationOptions {
  owner: string;
  repo: string;
  branch?: string;
  initialPath?: string;
  enabled?: boolean;
}

interface UseFileNavigationReturn {
  currentPath: string;
  contents: ContentItem[];
  selectedFile: FileContent | null;
  loading: boolean;
  error: string | null;
  pathHistory: string[];
  handleFileClick: (file: ContentItem) => Promise<void>;
  handleBreadcrumbClick: (index: number) => void;
}

export function useFileNavigation({
  owner,
  repo,
  branch,
  initialPath = "",
  enabled = true,
}: UseFileNavigationOptions): UseFileNavigationReturn {
  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [pathHistory, setPathHistory] = useState<string[]>([initialPath]);

  const {
    data: contentsData,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.contents.dir(owner, repo, currentPath, branch),
    queryFn: async () => {
      const data = await githubService.getContents(owner, repo, currentPath, {
        ref: branch,
      });
      return data;
    },
    enabled: !!owner && !!repo && enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Extract contents from query data (only if it's an array = directory listing)
  const contents: ContentItem[] = Array.isArray(contentsData)
    ? contentsData
    : [];

  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Failed to fetch contents"
    : null;

  const handleFileClick = useCallback(
    async (file: ContentItem) => {
      if (file.type === "dir") {
        setCurrentPath(file.path);
        setPathHistory((prev) => [...prev, file.path]);
        setSelectedFile(null);
        return;
      }

      // Check if file is binary
      if (isBinaryFile(file.name)) {
        setSelectedFile({
          name: file.name,
          path: file.path,
          content: "[Binary file - cannot display]",
          encoding: "binary",
          size: file.size || 0,
          sha: file.sha,
          type: "binary",
        });
        return;
      }

      // Fetch file content
      try {
        const data = await githubService.getContents(owner, repo, file.path, {
          ref: branch,
        });

        if (!Array.isArray(data)) {
          setSelectedFile(data);
        }
      } catch (err) {
        console.error("Error fetching file:", err);
      }
    },
    [owner, repo, branch],
  );

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      const newPath = pathHistory[index];
      setCurrentPath(newPath);
      setPathHistory(pathHistory.slice(0, index + 1));
      setSelectedFile(null);
    },
    [pathHistory],
  );

  return {
    currentPath,
    contents,
    selectedFile,
    loading,
    error,
    pathHistory,
    handleFileClick,
    handleBreadcrumbClick,
  };
}
