'use client';

import { useState } from 'react';
import { DependencyEdge, PackageInfo } from '@/lib/utils/turborepo';
import { TurborepoGraphVisual } from './turborepo-graph-visual';
import { BarChart3, List } from '@workspace/ui/icons';

interface TurborepoGraphProps {
  apps: PackageInfo[];
  packages: PackageInfo[];
  dependencies: DependencyEdge[];
}

export function TurborepoGraph({ apps, packages, dependencies }: TurborepoGraphProps) {
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('graph');
  // Group dependencies by app
  const appDependencies = apps.map((app) => {
    const deps = dependencies.filter((dep) => dep.from === app.name);
    return {
      app,
      dependencies: deps,
    };
  });

  // Group dependencies by package to show which apps use each package
  const packageUsage = packages.map((pkg) => {
    const usedBy = dependencies.filter((dep) => dep.to === pkg.name);
    return {
      package: pkg,
      usedBy,
    };
  });

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            onClick={() => setViewMode('graph')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'graph'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Graph View
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            <List className="h-4 w-4" />
            List View
          </button>
        </div>
        
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          {apps.length} apps • {packages.length} packages • {dependencies.length} dependencies
        </div>
      </div>

      {/* Graph View */}
      {viewMode === 'graph' && (
        <TurborepoGraphVisual
          apps={apps}
          packages={packages}
          dependencies={dependencies}
        />
      )}

      {/* List View */}
      {viewMode === 'list' && (
      <div className="space-y-8">
      {/* Apps and their dependencies */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Applications ({apps.length})
        </h3>
        <div className="space-y-4">
          {appDependencies.map(({ app, dependencies }) => (
            <div
              key={app.name}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {app.name}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    {app.path}
                  </p>
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  App
                </span>
              </div>

              {dependencies.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Depends on:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {dependencies.map((dep, idx) => (
                      <div
                        key={idx}
                        className="group relative"
                      >
                        <div
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            dep.type === 'dependency'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                          }`}
                        >
                          <span className="mr-1.5">→</span>
                          {dep.to}
                        </div>
                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded bg-zinc-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-zinc-700">
                          {dep.type === 'dependency' ? 'Dependency' : 'Dev Dependency'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-500">
                  No internal package dependencies
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Packages and their usage */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Packages ({packages.length})
        </h3>
        <div className="space-y-4">
          {packageUsage.map(({ package: pkg, usedBy }) => (
            <div
              key={pkg.name}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {pkg.name}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    {pkg.path}
                  </p>
                </div>
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  Package
                </span>
              </div>

              {usedBy.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Used by:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {usedBy.map((dep, idx) => (
                      <div
                        key={idx}
                        className="group relative"
                      >
                        <div
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            dep.type === 'dependency'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                          }`}
                        >
                          <span className="mr-1.5">←</span>
                          {dep.from}
                        </div>
                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded bg-zinc-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-zinc-700">
                          {dep.type === 'dependency' ? 'Dependency' : 'Dev Dependency'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-500">
                  Not used by any apps or packages
                </p>
              )}

              {/* Show if this package depends on other packages */}
              {(() => {
                const pkgDeps = dependencies.filter((dep) => dep.from === pkg.name);
                if (pkgDeps.length > 0) {
                  return (
                    <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Depends on:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {pkgDeps.map((dep, idx) => (
                          <div
                            key={idx}
                            className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                          >
                            <span className="mr-1.5">→</span>
                            {dep.to}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h4 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Legend
        </h4>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
              Dependency
            </div>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              Production dependency
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              Dev Dependency
            </div>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              Development dependency
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              App
            </div>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              Application
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              Package
            </div>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              Shared package
            </span>
          </div>
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
