import { TurborepoStructure, DependencyEdge } from "@/lib/utils/turborepo";
import { Archive, Waypoints } from "@workspace/ui/icons";
import { TurborepoGraphVisual } from "./turborepo-graph-visual";

interface ImportsTabProps {
  turborepoStructure: TurborepoStructure;
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
  turborepoStructure,
  importGraph,
  loading,
  truncated,
  scannedFiles,
  error,
  owner,
  repo,
  branch,
}: ImportsTabProps) {
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
      ) : turborepoStructure.apps.length === 0 &&
        turborepoStructure.packages.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-800">
          <Archive className="mx-auto h-12 w-12 text-zinc-400" />
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            No apps or packages found in this Turborepo
          </p>
        </div>
      ) : importGraph.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-800">
          <Waypoints className="mx-auto h-12 w-12 text-zinc-400" />
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            No workspace import edges found
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
              apps={turborepoStructure.apps}
              packages={turborepoStructure.packages}
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
