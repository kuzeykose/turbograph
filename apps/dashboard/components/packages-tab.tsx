import { TurborepoStructure, DependencyEdge } from "@/lib/utils/turborepo";
import { Archive } from "@workspace/ui/icons";

interface PackagesTabProps {
  turborepoStructure: TurborepoStructure;
  turborepoLoading: boolean;
  dependencyGraph: DependencyEdge[];
}

export function PackagesTab({
  turborepoStructure,
  turborepoLoading,
  dependencyGraph,
}: PackagesTabProps) {
  const { apps, packages } = turborepoStructure;

  if (turborepoLoading) {
    return (
      <div className="grid h-full place-items-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-50" />
      </div>
    );
  }

  if (apps.length === 0 && packages.length === 0) {
    return (
      <div className="grid h-full place-items-center py-12 text-zinc-400">
        <div className="text-center">
          <Archive className="mx-auto h-8 w-8" />
          <p className="mt-3 text-sm">No apps or packages found</p>
        </div>
      </div>
    );
  }

  const allItems = [
    ...apps.map((item) => ({ ...item, kind: "app" as const })),
    ...packages.map((item) => ({ ...item, kind: "package" as const })),
  ];

  return (
    <div className="min-h-0 overflow-y-auto p-4">
      <div className="mb-3 text-xs text-zinc-500">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500 align-middle" />
        {apps.length} {apps.length === 1 ? "app" : "apps"}
        <span className="mx-2 text-zinc-300 dark:text-zinc-700">|</span>
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-purple-500 align-middle" />
        {packages.length} {packages.length === 1 ? "package" : "packages"}
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        {allItems.map((item, index) => {
          const deps = dependencyGraph.filter((d) => d.from === item.name);
          const usedBy = dependencyGraph.filter((d) => d.to === item.name);
          const depNames = deps.map((d) => d.to);
          const usedByNames = usedBy.map((d) => d.from);
          const isApp = item.kind === "app";

          return (
            <div
              key={item.name}
              className={`h-14 px-4 py-2 ${
                isApp
                  ? "bg-blue-50/50 dark:bg-blue-950/20"
                  : "bg-purple-50/50 dark:bg-purple-950/20"
              } ${
                index !== allItems.length - 1
                  ? "border-b border-zinc-200 dark:border-zinc-800"
                  : ""
              }`}
            >
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <span
                  className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${
                    isApp ? "bg-blue-500" : "bg-purple-500"
                  }`}
                />
                {item.name}
                <span className="ml-2 text-xs font-normal text-zinc-400">
                  {item.path}
                </span>
              </p>
              <p className="mt-0.5 truncate pl-4 text-xs text-zinc-500">
                {depNames.length > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    depends on {depNames.join(", ")}
                  </span>
                )}
                {depNames.length > 0 && usedByNames.length > 0 && (
                  <span className="text-zinc-300 dark:text-zinc-700">
                    {" | "}
                  </span>
                )}
                {usedByNames.length > 0 && (
                  <span className="text-zinc-400">
                    used by {usedByNames.join(", ")}
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
