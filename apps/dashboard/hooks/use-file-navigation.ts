import { useEffect, useState } from "react";
import { githubService } from "@/lib/services/github";
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
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pathHistory, setPathHistory] = useState<string[]>([initialPath]);

  // Fetch directory contents
  useEffect(() => {
    async function fetchContents() {
      if (!owner || !repo || !enabled) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setSelectedFile(null);

        const data = await githubService.getContents(owner, repo, currentPath, {
          ref: branch,
        });

        // If it's a file, show it directly
        if (!Array.isArray(data)) {
          const fileItem = {
            name: data.name,
            path: data.path,
            type: "file" as const,
            size: data.size,
            sha: data.sha,
            url: "",
            html_url: "",
          };
          await handleFileClick(fileItem);
          return;
        }

        setContents(data);
      } catch (err) {
        console.error("Error fetching contents:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch contents"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchContents();
  }, [owner, repo, currentPath, branch, enabled]);

  const handleFileClick = async (file: ContentItem) => {
    if (file.type === "dir") {
      setCurrentPath(file.path);
      setPathHistory([...pathHistory, file.path]);
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
      setError(err instanceof Error ? err.message : "Failed to fetch file");
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const newPath = pathHistory[index];
    setCurrentPath(newPath);
    setPathHistory(pathHistory.slice(0, index + 1));
  };

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
