import { TurborepoStructure, DependencyEdge } from "@/lib/utils/turborepo";
import { Archive } from "@workspace/ui/icons";
import { TurborepoGraphVisual } from "./turborepo-graph-visual";

interface DependenciesTabProps {
  turborepoStructure: TurborepoStructure;
  turborepoLoading: boolean;
  dependencyGraph: DependencyEdge[];
  owner: string;
  repo: string;
  branch?: string | null;
}

export function DependenciesTab({
  turborepoStructure,
  turborepoLoading,
  dependencyGraph,
  owner,
  repo,
  branch,
}: DependenciesTabProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {turborepoLoading ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-zinc-900 dark:text-zinc-50" />
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              Analyzing Turborepo structure...
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {turborepoStructure.apps.length === 0 &&
            turborepoStructure.packages.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-800">
              <Archive className="mx-auto h-12 w-12 text-zinc-400" />
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                No apps or packages found in this Turborepo
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <TurborepoGraphVisual
                apps={turborepoStructure.apps}
                packages={turborepoStructure.packages}
                dependencies={dependencyGraph}
                github={{ owner, repo, branch }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
