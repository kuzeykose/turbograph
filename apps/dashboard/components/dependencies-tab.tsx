import { TurborepoGraph } from "@/components/turborepo-graph";
import { TurborepoStructure, DependencyEdge } from "@/lib/utils/turborepo";

interface DependenciesTabProps {
  turborepoStructure: TurborepoStructure;
  turborepoLoading: boolean;
  dependencyGraph: DependencyEdge[];
}

export function DependenciesTab({
  turborepoStructure,
  turborepoLoading,
  dependencyGraph,
}: DependenciesTabProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {turborepoLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-zinc-900 dark:text-zinc-50" />
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              Analyzing Turborepo structure...
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Turborepo Dependency Graph
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Visualizing internal workspace dependencies between apps and
              packages
            </p>
          </div>

          {turborepoStructure.apps.length === 0 &&
          turborepoStructure.packages.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-800">
              <svg
                className="mx-auto h-12 w-12 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                No apps or packages found in this Turborepo
              </p>
            </div>
          ) : (
            <TurborepoGraph
              apps={turborepoStructure.apps}
              packages={turborepoStructure.packages}
              dependencies={dependencyGraph}
            />
          )}
        </div>
      )}
    </div>
  );
}
