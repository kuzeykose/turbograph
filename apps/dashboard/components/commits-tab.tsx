import { TurborepoGraph } from "@/components/turborepo-graph";
import { CommitList, Commit, CommitFile } from "@/components/commit-list";
import { TurborepoStructure, DependencyEdge } from "@/lib/utils/turborepo";

interface CommitsTabProps {
  commits: Commit[];
  commitsLoading: boolean;
  currentPage: number;
  totalPages: number;
  hasMoreCommits: boolean;
  onPageChange: (page: number) => void;
  turborepoStructure: TurborepoStructure | null;
  dependencyGraph: DependencyEdge[];
  onFetchCommitDetails: (sha: string) => Promise<CommitFile[]>;
  affectedPackages: string[];
  downstreamDependents: string[];
  onImpactChange: (affected: string[], downstream: string[]) => void;
}

function getFilteredGraphData(
  turborepoStructure: TurborepoStructure | null,
  dependencyGraph: DependencyEdge[],
  affectedPackages: string[],
  downstreamDependents: string[],
) {
  if (!turborepoStructure || affectedPackages.length === 0) {
    return {
      apps: turborepoStructure?.apps || [],
      packages: turborepoStructure?.packages || [],
      dependencies: dependencyGraph,
    };
  }

  const packagesToShow = new Set([...affectedPackages, ...downstreamDependents]);

  const filteredApps = turborepoStructure.apps.filter((app) =>
    packagesToShow.has(app.name),
  );
  const filteredPackages = turborepoStructure.packages.filter((pkg) =>
    packagesToShow.has(pkg.name),
  );

  const filteredDependencies = dependencyGraph.filter(
    (dep) => packagesToShow.has(dep.from) && packagesToShow.has(dep.to),
  );

  return {
    apps: filteredApps,
    packages: filteredPackages,
    dependencies: filteredDependencies,
  };
}

export function CommitsTab({
  commits,
  commitsLoading,
  currentPage,
  totalPages,
  hasMoreCommits,
  onPageChange,
  turborepoStructure,
  dependencyGraph,
  onFetchCommitDetails,
  affectedPackages,
  downstreamDependents,
  onImpactChange,
}: CommitsTabProps) {
  const filteredData = getFilteredGraphData(
    turborepoStructure,
    dependencyGraph,
    affectedPackages,
    downstreamDependents,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Commit List - Left Column */}
      <div className="lg:col-span-5">
        <CommitList
          commits={commits}
          loading={commitsLoading}
          currentPage={currentPage}
          totalPages={totalPages}
          hasMore={hasMoreCommits}
          onPageChange={onPageChange}
          turborepoStructure={turborepoStructure || undefined}
          dependencyGraph={dependencyGraph}
          onFetchCommitDetails={onFetchCommitDetails}
          onImpactChange={onImpactChange}
        />
      </div>

      {/* Dependency Graph - Right Column */}
      <div className="lg:col-span-7">
        <div className="sticky top-6">
          {turborepoStructure?.isTurborepo ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {affectedPackages.length > 0
                  ? "Commit Impact Tree"
                  : "Dependency Graph"}
              </h3>
              {affectedPackages.length > 0 ? (
                <div className="mb-4 space-y-2">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Showing {affectedPackages.length} affected package
                    {affectedPackages.length !== 1 ? "s" : ""} and{" "}
                    {downstreamDependents.length} downstream dependent
                    {downstreamDependents.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-purple-500" />
                      <span className="text-zinc-600 dark:text-zinc-400">
                        Affected Packages
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-orange-500" />
                      <span className="text-zinc-600 dark:text-zinc-400">
                        Downstream Dependents
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                  Expand a commit to see its impact tree
                </p>
              )}
              <TurborepoGraph
                apps={filteredData.apps}
                packages={filteredData.packages}
                dependencies={filteredData.dependencies}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-center">
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <h3 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Not a Turborepo
                </h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Dependency graph visualization is only available for Turborepo
                  monorepos
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
