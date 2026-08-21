import { useMemo } from "react";
import { Archive, Waypoints } from "@workspace/ui/icons";
import { TurborepoGraphVisual } from "./turborepo-graph-visual";
import {
  importFilesToLayoutNodes,
  type DependencyEdge,
  type ImportFileNode,
} from "@workspace/graph";

interface ImportsTabProps {
  importFiles: ImportFileNode[];
  importGraph: DependencyEdge[];
  loading: boolean;
  truncated?: boolean;
  scannedFiles?: number;
  error?: string | null;
  owner: string;
  repo: string;
  branch?: string | null;
}

export function ImportsTab({
  importFiles,
  importGraph,
  loading,
  truncated,
  scannedFiles,
  error,
  owner,
  repo,
  branch,
}: ImportsTabProps) {
  // Derived once per import scan. Rebuilding these arrays on every render gave
  // the graph new prop identities each frame and forced a full re-layout.
  const { apps, packages } = useMemo(
    () => importFilesToLayoutNodes(importFiles),
    [importFiles],
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-zinc-900 dark:text-zinc-50" />
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              Scanning source imports...
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : importGraph.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-800">
          {importFiles.length === 0 && !scannedFiles ? (
            <Archive className="mx-auto h-12 w-12 text-zinc-400" />
          ) : (
            <Waypoints className="mx-auto h-12 w-12 text-zinc-400" />
          )}
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            No file-to-file imports found
            {scannedFiles ? ` after scanning ${scannedFiles} files` : ""}
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {truncated ? (
            <p className="px-4 pt-3 text-xs text-zinc-500">
              Import scan was capped; some source files were skipped.
            </p>
          ) : null}
          <div className="flex-1 min-h-0">
            <TurborepoGraphVisual
              apps={apps}
              packages={packages}
              dependencies={importGraph}
              github={{ owner, repo, branch }}
              edgeMode="imports"
            />
          </div>
        </div>
      )}
    </div>
  );
}
