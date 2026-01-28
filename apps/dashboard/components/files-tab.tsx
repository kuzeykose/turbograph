"use client";

import React, { useState, useCallback } from "react";
import { CodeViewer } from "@/components/code-viewer";
import { formatFileSize } from "@/lib/utils/format";
import { githubService } from "@/lib/services/github";
import { ContentItem, FileContent } from "@/types/repository";
import {
  Folder,
  FolderOpen,
  File,
  ChevronRight,
  ChevronDown,
  FileText,
  Loader2,
} from "@workspace/ui/icons";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";

interface FilesTabProps {
  owner: string;
  repo: string;
  branch?: string;
  contents: ContentItem[];
  selectedFile: FileContent | null;
  loading: boolean;
  onFileClick: (file: ContentItem) => void;
}

// State for tracking expanded folders and their children
interface TreeState {
  expandedFolders: Map<string, ContentItem[]>;
  loadingFolders: Set<string>;
}

function getFileIcon(type: string, name: string, isExpanded?: boolean) {
  if (type === "dir") {
    return isExpanded ? (
      <FolderOpen className="h-4 w-4 flex-shrink-0 text-blue-500" />
    ) : (
      <Folder className="h-4 w-4 flex-shrink-0 text-blue-500" />
    );
  }
  return <File className="h-4 w-4 flex-shrink-0 text-zinc-500" />;
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

function sortContents(items: ContentItem[]): ContentItem[] {
  return [...items].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "dir" ? -1 : 1;
  });
}

interface TreeNodeProps {
  item: ContentItem;
  level: number;
  treeState: TreeState;
  selectedFilePath: string | null;
  onToggleFolder: (item: ContentItem) => void;
  onFileClick: (item: ContentItem) => void;
}

function TreeNode({
  item,
  level,
  treeState,
  selectedFilePath,
  onToggleFolder,
  onFileClick,
}: TreeNodeProps) {
  const isFolder = item.type === "dir";
  const isExpanded = treeState.expandedFolders.has(item.path);
  const isLoading = treeState.loadingFolders.has(item.path);
  const children = treeState.expandedFolders.get(item.path);
  const isSelected = selectedFilePath === item.path;

  const handleClick = () => {
    if (isFolder) {
      onToggleFolder(item);
    } else {
      onFileClick(item);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`flex w-full items-center gap-2 py-1.5 pr-3 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${isSelected
          ? "bg-blue-50 dark:bg-blue-950/30"
          : ""
          }`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
      >
        {/* Chevron for folders */}
        {isFolder ? (
          isLoading ? (
            <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-zinc-400" />
          ) : isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
          )
        ) : (
          <span className="w-3.5" />
        )}

        {/* Icon */}
        {getFileIcon(item.type, item.name, isExpanded)}

        {/* Name and size */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span
            className={`truncate text-sm ${isSelected
              ? "font-medium text-blue-600 dark:text-blue-400"
              : "text-zinc-900 dark:text-zinc-100"
              }`}
          >
            {item.name}
          </span>
          {item.type === "file" && item.size !== undefined && (
            <span className="flex-shrink-0 text-xs text-zinc-400">
              {formatFileSize(item.size)}
            </span>
          )}
        </div>
      </button>

      {/* Render children if expanded */}
      {isFolder && isExpanded && children && (
        <div>
          {sortContents(children).map((child) => (
            <TreeNode
              key={child.sha}
              item={child}
              level={level + 1}
              treeState={treeState}
              selectedFilePath={selectedFilePath}
              onToggleFolder={onToggleFolder}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FilesTab({
  owner,
  repo,
  branch,
  contents,
  selectedFile,
  loading,
  onFileClick,
}: FilesTabProps) {
  // Tree state management
  const [expandedFolders, setExpandedFolders] = useState<
    Map<string, ContentItem[]>
  >(new Map());
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

  const treeState: TreeState = {
    expandedFolders,
    loadingFolders,
  };

  // Handle folder toggle (expand/collapse)
  const handleToggleFolder = useCallback(
    async (folder: ContentItem) => {
      const folderPath = folder.path;

      // If already expanded, collapse it
      if (expandedFolders.has(folderPath)) {
        setExpandedFolders((prev) => {
          const next = new Map(prev);
          next.delete(folderPath);
          return next;
        });
        return;
      }

      // Start loading
      setLoadingFolders((prev) => new Set(prev).add(folderPath));

      try {
        // Fetch folder contents
        const data = await githubService.getContents(owner, repo, folderPath, {
          ref: branch,
        });

        if (Array.isArray(data)) {
          setExpandedFolders((prev) => {
            const next = new Map(prev);
            next.set(folderPath, data);
            return next;
          });
        }
      } catch (error) {
        console.error("Error fetching folder contents:", error);
      } finally {
        setLoadingFolders((prev) => {
          const next = new Set(prev);
          next.delete(folderPath);
          return next;
        });
      }
    },
    [owner, repo, branch, expandedFolders]
  );

  return (
    <div>
      <div className="p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Folder className="h-4 w-4 flex-shrink-0 text-blue-500" />
          <Breadcrumb>
            <BreadcrumbList className="text-sm">
              <BreadcrumbItem>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {repo}
                </span>
              </BreadcrumbItem>
              {selectedFile && (() => {
                const pathSegments = selectedFile.path.split('/');
                const fileName = pathSegments[pathSegments.length - 1];
                const directories = pathSegments.slice(0, -1);

                return (
                  <>
                    {directories.map((dir, index) => (
                      <React.Fragment key={index}>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {dir}
                          </span>
                        </BreadcrumbItem>
                      </React.Fragment>
                    ))}
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="font-medium">
                        {fileName}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                );
              })()}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-12">

        {/* File Browser */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {/* Header showing selected file path */}


            {/* Directory Tree */}
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto py-2">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                </div>
              ) : (
                <div>
                  {sortContents(contents).map((item) => (
                    <TreeNode
                      key={item.sha}
                      item={item}
                      level={0}
                      treeState={treeState}
                      selectedFilePath={selectedFile?.path ?? null}
                      onToggleFolder={handleToggleFolder}
                      onFileClick={onFileClick}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Code Viewer */}
        <div className="lg:col-span-10">
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
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
    </div>
  );
}
