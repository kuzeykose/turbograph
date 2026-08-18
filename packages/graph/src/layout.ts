import type {
  PackageInfo,
  DependencyEdge,
  GraphNode,
  GraphEdge,
  TurborepoStructure,
} from "./types";
import {
  DEFAULT_MIN_LEVEL_WIDTH,
  DEFAULT_MIN_VERTICAL_GAP,
} from "./constants";

/**
 * Horizontal layer order for the hierarchical layout.
 * - `roots-first`: nodes nothing depends on (entries) on the left, dependencies flow right.
 * - `leaves-first`: workspace leaves (no workspace deps) on the left, dependents flow right.
 */
export type GraphLayerOrder = "roots-first" | "leaves-first";

/**
 * Options for the graph layout algorithm
 */
export interface LayoutOptions {
  width?: number;
  height?: number;
  padding?: number;
  /** Minimum vertical spacing between node centers in the same depth column */
  minVerticalGap?: number;
  /** Minimum horizontal spacing between adjacent depth columns */
  minLevelWidth?: number;
  /**
   * How columns are ordered left-to-right.
   * @default "roots-first"
   */
  layerOrder?: GraphLayerOrder;
}

const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 550;
const DEFAULT_PADDING = 80;

/**
 * Build dependency edges from a turborepo structure.
 * Accepts either a TurborepoStructure object or individual arguments.
 */
export function buildDependencyGraph(
  structure: TurborepoStructure
): DependencyEdge[];
export function buildDependencyGraph(
  apps: PackageInfo[],
  packages: PackageInfo[],
  workspacePackages: Set<string>
): DependencyEdge[];
export function buildDependencyGraph(
  appsOrStructure: PackageInfo[] | TurborepoStructure,
  packages?: PackageInfo[],
  workspacePackages?: Set<string>
): DependencyEdge[] {
  let apps: PackageInfo[];
  let pkgs: PackageInfo[];
  let wsPkgs: Set<string>;

  if (Array.isArray(appsOrStructure)) {
    apps = appsOrStructure;
    pkgs = packages!;
    wsPkgs = workspacePackages!;
  } else {
    apps = appsOrStructure.apps;
    pkgs = appsOrStructure.packages;
    wsPkgs = appsOrStructure.workspacePackages;
  }

  const edges: DependencyEdge[] = [];

  // Check which apps depend on which packages
  for (const app of apps) {
    // Check regular dependencies
    for (const depName of Object.keys(app.dependencies)) {
      if (wsPkgs.has(depName)) {
        edges.push({
          from: app.name,
          to: depName,
          type: "dependency",
        });
      }
    }

    // Check dev dependencies
    for (const depName of Object.keys(app.devDependencies)) {
      if (wsPkgs.has(depName)) {
        edges.push({
          from: app.name,
          to: depName,
          type: "devDependency",
        });
      }
    }
  }

  // Also check if packages depend on other packages
  for (const pkg of pkgs) {
    for (const depName of Object.keys(pkg.dependencies)) {
      if (wsPkgs.has(depName)) {
        edges.push({
          from: pkg.name,
          to: depName,
          type: "dependency",
        });
      }
    }

    for (const depName of Object.keys(pkg.devDependencies)) {
      if (wsPkgs.has(depName)) {
        edges.push({
          from: pkg.name,
          to: depName,
          type: "devDependency",
        });
      }
    }
  }

  return edges;
}

function computeNodeDepthRootsFirst(
  allNodeIds: Set<string>,
  dependsOn: Map<string, Set<string>>,
  dependedBy: Map<string, Set<string>>,
): Map<string, number> {
  const nodeDepth = new Map<string, number>();
  const indegreeMap = new Map<string, number>();
  allNodeIds.forEach((id) => {
    indegreeMap.set(id, dependedBy.get(id)?.size ?? 0);
  });

  const queue: string[] = [];
  allNodeIds.forEach((id) => {
    if (indegreeMap.get(id) === 0) {
      nodeDepth.set(id, 0);
      queue.push(id);
    }
  });

  while (queue.length > 0) {
    const u = queue.shift()!;
    const du = nodeDepth.get(u)!;
    for (const v of dependsOn.get(u) ?? []) {
      const next = du + 1;
      const prev = nodeDepth.get(v);
      if (prev === undefined || next > prev) {
        nodeDepth.set(v, next);
      }
      indegreeMap.set(v, (indegreeMap.get(v) ?? 0) - 1);
      if (indegreeMap.get(v) === 0) {
        queue.push(v);
      }
    }
  }

  allNodeIds.forEach((id) => {
    if (!nodeDepth.has(id)) {
      nodeDepth.set(id, 0);
    }
  });

  return nodeDepth;
}

function computeNodeDepthLeavesFirst(
  allNodeIds: Set<string>,
  dependsOn: Map<string, Set<string>>,
  dependedBy: Map<string, Set<string>>,
): Map<string, number> {
  const nodeDepth = new Map<string, number>();
  const queue: string[] = [];

  allNodeIds.forEach((id) => {
    if (dependsOn.get(id)?.size === 0) {
      nodeDepth.set(id, 0);
      queue.push(id);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = nodeDepth.get(current)!;

    dependedBy.get(current)?.forEach((parent) => {
      const existingDepth = nodeDepth.get(parent);
      const newDepth = currentDepth + 1;

      if (existingDepth === undefined || newDepth > existingDepth) {
        nodeDepth.set(parent, newDepth);
      }

      const parentDeps = dependsOn.get(parent);
      const allDepsProcessed = [...(parentDeps ?? [])].every((dep) =>
        nodeDepth.has(dep),
      );

      if (allDepsProcessed && !queue.includes(parent)) {
        queue.push(parent);
      }
    });
  }

  allNodeIds.forEach((id) => {
    if (!nodeDepth.has(id)) {
      nodeDepth.set(id, 0);
    }
  });

  return nodeDepth;
}

/**
 * Calculate the graph layout using a hierarchical layered algorithm.
 * Default (`roots-first`): entry packages on the left, shared dependencies to the right.
 * `leaves-first`: workspace leaves on the left, consumers to the right.
 */
export function calculateGraphLayout(
  apps: PackageInfo[],
  packages: PackageInfo[],
  dependencies: DependencyEdge[],
  options?: LayoutOptions
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const baseWidth = options?.width ?? DEFAULT_WIDTH;
  const baseHeight = options?.height ?? DEFAULT_HEIGHT;
  const padding = options?.padding ?? DEFAULT_PADDING;
  const minVerticalGap =
    options?.minVerticalGap ?? DEFAULT_MIN_VERTICAL_GAP;
  const minLevelWidth = options?.minLevelWidth ?? DEFAULT_MIN_LEVEL_WIDTH;
  const layerOrder: GraphLayerOrder = options?.layerOrder ?? "roots-first";

  // Create edges
  const graphEdges: GraphEdge[] = dependencies.map((dep, idx) => ({
    id: `e${idx}`,
    source: dep.from,
    target: dep.to,
    type: dep.type,
    count: dep.count,
  }));

  // Build adjacency lists for dependency graph
  const dependsOn = new Map<string, Set<string>>();
  const dependedBy = new Map<string, Set<string>>();

  const allNodeIds = new Set<string>();
  apps.forEach((app) => allNodeIds.add(app.name));
  packages.forEach((pkg) => allNodeIds.add(pkg.name));

  allNodeIds.forEach((id) => {
    dependsOn.set(id, new Set());
    dependedBy.set(id, new Set());
  });

  dependencies.forEach((dep) => {
    dependsOn.get(dep.from)?.add(dep.to);
    dependedBy.get(dep.to)?.add(dep.from);
  });

  // Calculate dependency and dependent counts
  const dependencyCount = new Map<string, number>();
  const dependentCount = new Map<string, number>();
  allNodeIds.forEach((id) => {
    dependencyCount.set(id, dependsOn.get(id)?.size ?? 0);
    dependentCount.set(id, dependedBy.get(id)?.size ?? 0);
  });

  const nodeDepth =
    layerOrder === "roots-first"
      ? computeNodeDepthRootsFirst(allNodeIds, dependsOn, dependedBy)
      : computeNodeDepthLeavesFirst(allNodeIds, dependsOn, dependedBy);

  // Group nodes by depth
  const nodesByDepth = new Map<number, string[]>();
  nodeDepth.forEach((depth, nodeId) => {
    if (!nodesByDepth.has(depth)) {
      nodesByDepth.set(depth, []);
    }
    nodesByDepth.get(depth)!.push(nodeId);
  });

  const maxDepth = Math.max(...nodeDepth.values(), 0);

  const layerSizes = [...nodesByDepth.values()].map((ids) => ids.length);
  const maxNodesInLayer = Math.max(1, ...layerSizes);

  const layoutHeight = Math.max(
    baseHeight,
    2 * padding + maxNodesInLayer * minVerticalGap
  );
  const layoutWidth = Math.max(
    baseWidth,
    2 * padding + maxDepth * minLevelWidth
  );

  const levelWidth =
    (layoutWidth - 2 * padding) / Math.max(1, maxDepth);

  // Create nodes with hierarchical positions
  const graphNodes: GraphNode[] = [];
  const nodeTypeMap = new Map<string, "app" | "package">();
  apps.forEach((app) => nodeTypeMap.set(app.name, "app"));
  packages.forEach((pkg) => nodeTypeMap.set(pkg.name, "package"));

  nodesByDepth.forEach((nodesAtDepth, depth) => {
    const x = padding + depth * levelWidth;
    const verticalSpacing =
      (layoutHeight - 2 * padding) / Math.max(1, nodesAtDepth.length);

    nodesAtDepth.forEach((nodeId, index) => {
      const y = padding + verticalSpacing * (index + 0.5);
      graphNodes.push({
        id: nodeId,
        name: nodeId,
        type: nodeTypeMap.get(nodeId) ?? "package",
        x,
        y,
        dependencies: dependencyCount.get(nodeId) ?? 0,
        dependents: dependentCount.get(nodeId) ?? 0,
      });
    });
  });

  return { nodes: graphNodes, edges: graphEdges };
}

/**
 * Get affected packages based on changed file paths.
 * Accepts either a TurborepoStructure or individual arrays.
 */
export function getAffectedPackages(
  changedFiles: string[],
  structure: TurborepoStructure
): string[];
export function getAffectedPackages(
  changedFiles: string[],
  apps: PackageInfo[],
  packages: PackageInfo[]
): string[];
export function getAffectedPackages(
  changedFiles: string[],
  appsOrStructure: PackageInfo[] | TurborepoStructure,
  packages?: PackageInfo[]
): string[] {
  let apps: PackageInfo[];
  let pkgs: PackageInfo[];

  if (Array.isArray(appsOrStructure)) {
    apps = appsOrStructure;
    pkgs = packages!;
  } else {
    apps = appsOrStructure.apps;
    pkgs = appsOrStructure.packages;
  }

  const affectedPackages = new Set<string>();

  for (const file of changedFiles) {
    // Check if file is in apps folder
    for (const app of apps) {
      if (file.startsWith(`${app.path}/`)) {
        affectedPackages.add(app.name);
      }
    }

    // Check if file is in packages folder
    for (const pkg of pkgs) {
      if (file.startsWith(`${pkg.path}/`)) {
        affectedPackages.add(pkg.name);
      }
    }
  }

  return Array.from(affectedPackages);
}

/**
 * Get all packages that depend on the affected packages (downstream dependents)
 */
export function getDownstreamDependents(
  affectedPackages: string[],
  dependencyGraph: DependencyEdge[]
): string[] {
  const dependents = new Set<string>();

  // Find all packages that depend on any of the affected packages
  for (const edge of dependencyGraph) {
    if (affectedPackages.includes(edge.to)) {
      dependents.add(edge.from);
    }
  }

  // Recursively find dependents of dependents (transitive dependencies)
  const currentDependents = Array.from(dependents);
  for (const dependent of currentDependents) {
    const transitives = getDownstreamDependents([dependent], dependencyGraph);
    transitives.forEach((d) => dependents.add(d));
  }

  return Array.from(dependents);
}
