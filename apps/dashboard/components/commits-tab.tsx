"use client";

import { useCallback, useRef, useState } from "react";
import { CommitList, Commit, CommitFile } from "@/components/commit-list";
import { TurborepoStructure, DependencyEdge } from "@/lib/utils/turborepo";
import { BarChart3 } from "@workspace/ui/icons";
import { TurborepoGraphVisual } from "./turborepo-graph-visual";

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

  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(30);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const pct = (x / rect.width) * 100;
      setLeftWidth(Math.min(Math.max(pct, 20), 80));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <div ref={containerRef} className="flex-1 min-h-0 flex flex-row gap-1">
      {/* Commit List - Left Panel */}
      <div className="min-h-0 overflow-y-auto" style={{ width: `${leftWidth}%` }}>
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

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="group relative flex-shrink-0 w-1.5 cursor-col-resize select-none flex items-center justify-center"
      >
        <div className="absolute inset-y-0 -left-1 -right-1 z-10" />
        <div className="h-full w-px bg-zinc-200 transition-colors group-hover:bg-zinc-400 dark:bg-zinc-800 dark:group-hover:bg-zinc-600" />
        <div className="absolute top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="h-1 w-1 rounded-full bg-zinc-400 dark:bg-zinc-500" />
          <div className="h-1 w-1 rounded-full bg-zinc-400 dark:bg-zinc-500" />
          <div className="h-1 w-1 rounded-full bg-zinc-400 dark:bg-zinc-500" />
        </div>
      </div>

      {/* Dependency Graph - Right Panel */}
      <div className="min-h-0 flex flex-col overflow-hidden" style={{ width: `${100 - leftWidth}%` }}>
        {turborepoStructure?.isTurborepo ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {affectedPackages.length > 0 ? "Impact" : "Dependencies"}
              </h3>
              {affectedPackages.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 font-medium">
                    {affectedPackages.length} affected
                  </span>
                  {downstreamDependents.length > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 font-medium">
                      {downstreamDependents.length} downstream
                    </span>
                  )}
                </div>
              )}
            </div>
            {affectedPackages.length > 0 ? (
              <div className="mb-4">
                <div className="flex gap-3 text-[11px]">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-violet-500" />
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Affected
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Downstream
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mb-4 text-xs text-zinc-400 dark:text-zinc-500">
                Expand a commit to see its impact
              </p>
            )}
            <div className="flex-1 min-h-0">
              <TurborepoGraphVisual
                className="rounded-xl border border-border bg-card h-full"
                apps={filteredData.apps}
                packages={filteredData.packages}
                dependencies={filteredData.dependencies}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-center">
              <BarChart3 className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
              <h3 className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Not a Turborepo
              </h3>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                Dependency graph is available for Turborepo monorepos
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
