import { CodeViewer } from "@/components/code-viewer";
import { formatFileSize } from "@/lib/utils/format";
import { ContentItem, FileContent } from "@/types/repository";
import { Folder, File, ChevronRight, FileText } from "@workspace/ui/icons";

interface FilesTabProps {
  repo: string;
  currentPath: string;
  contents: ContentItem[];
  selectedFile: FileContent | null;
  loading: boolean;
  pathHistory: string[];
  onFileClick: (file: ContentItem) => void;
  onBreadcrumbClick: (index: number) => void;
}

function getFileIcon(type: string, name: string) {
  if (type === "dir") {
    return <Folder className="h-5 w-5 text-blue-500" />;
  }
  return <File className="h-5 w-5 text-zinc-500" />;
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    rb: "ruby",
    java: "java",
    go: "go",
    rs: "rust",
    cpp: "cpp",
    c: "c",
    h: "c",
    css: "css",
    scss: "scss",
    html: "html",
    json: "json",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
    xml: "xml",
    sh: "shell",
    bash: "shell",
  };
  return languageMap[ext || ""] || "plaintext";
}

export function FilesTab({
  repo,
  currentPath,
  contents,
  selectedFile,
  loading,
  pathHistory,
  onFileClick,
  onBreadcrumbClick,
}: FilesTabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* File Browser */}
      <div className="lg:col-span-4">
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {/* Breadcrumb */}
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-1 text-sm">
              <button
                onClick={() => onBreadcrumbClick(0)}
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {repo}
              </button>
              {currentPath
                .split("/")
                .filter(Boolean)
                .map((segment, index, array) => (
                  <div key={index} className="flex items-center gap-1">
                    <span className="text-zinc-400">/</span>
                    <button
                      onClick={() => onBreadcrumbClick(index + 1)}
                      className={
                        index === array.length - 1
                          ? "text-zinc-900 dark:text-zinc-50"
                          : "text-blue-600 hover:underline dark:text-blue-400"
                      }
                    >
                      {segment}
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* File List */}
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent text-zinc-900 dark:text-zinc-50" />
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {contents
                  .sort((a, b) => {
                    if (a.type === b.type)
                      return a.name.localeCompare(b.name);
                    return a.type === "dir" ? -1 : 1;
                  })
                  .map((item) => (
                    <button
                      key={item.sha}
                      onClick={() => onFileClick(item)}
                      className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      {getFileIcon(item.type, item.name)}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {item.name}
                        </p>
                        {item.type === "file" &&
                          item.size !== undefined && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-500">
                              {formatFileSize(item.size)}
                            </p>
                          )}
                      </div>
                      {item.type === "dir" && (
                        <ChevronRight className="h-4 w-4 text-zinc-400" />
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Code Viewer */}
      <div className="lg:col-span-8">
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {selectedFile ? (
            <div className="max-h-[calc(100vh-200px)] overflow-auto">
              <CodeViewer
                content={selectedFile.content}
                filename={selectedFile.name}
                language={getLanguageFromFilename(selectedFile.name)}
              />
            </div>
          ) : (
            <div className="flex min-h-[calc(100vh-300px)] items-center justify-center p-8">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-zinc-400" />
                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                  Select a file to view its contents
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
