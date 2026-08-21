import type {
  PackageInfo,
  DependencyEdge,
  GraphNode,
  GraphEdge,
  TurborepoStructure,
} from "./types";
import {
  DEFAULT_MIN_LEVEL_HEIGHT,
  DEFAULT_MIN_LEVEL_WIDTH,
  DEFAULT_MIN_VERTICAL_GAP,
  GRAPH_NODE_CARD,
} from "./constants";

/**
 * Which end of the dependency chain the layout starts from.
 * - `roots-first`: nodes nothing depends on (entries) first, dependencies after.
 * - `leaves-first`: workspace leaves (no workspace deps) first, dependents after.
 *
 * `leaves-first` is the default because it puts the packages the workspace
 * leans on hardest at the top: a widely imported utility has many dependents
 * and few dependencies of its own, so it is a leaf, while an entry point that
 * nothing uses sinks to the bottom.
 */
export type GraphLayerOrder = "roots-first" | "leaves-first";

/**
 * Axis the depth layers advance along.
 * - `top-to-bottom`: layers stack downward, each spread across the width.
 * - `left-to-right`: layers march rightward, each spread down the height.
 */
export type GraphOrientation = "top-to-bottom" | "left-to-right";

/**
 * Options for the graph layout algorithm
 */
export interface LayoutOptions {
  width?: number;
  height?: number;
  padding?: number;
  /** Minimum vertical spacing between node centers stacked in a column */
  minVerticalGap?: number;
  /** Minimum horizontal spacing between node centers sitting side by side */
  minLevelWidth?: number;
  /** Minimum vertical spacing between adjacent depth layers */
  minLevelHeight?: number;
  /**
   * Which end of the chain the layers start from.
   * @default "leaves-first"
   */
  layerOrder?: GraphLayerOrder;
  /**
   * Axis the layers advance along.
   * @default "top-to-bottom"
   */
  orientation?: GraphOrientation;
  /**
   * Re-root the graph at this node: only it and the nodes one hop away are laid
   * out — what it depends on above it, what depends on it below. Ignored when
   * the node stands alone.
   */
  focus?: string | null;
}

/**
 * Layer per node in the one-hop neighbourhood of `focus`, or null when nothing
 * touches it.
 *
 * Clicking a node asks "what does this use, and who uses it" — so the answer is
 * the node itself, its direct dependencies one layer above it, and its direct
 * dependents one layer below, and nothing else. Anything further out is another
 * node's neighbourhood, one click away.
 */
function computeFocusDepths(
  focus: string,
  dependsOn: Map<string, Set<string>>,
  dependedBy: Map<string, Set<string>>
): Map<string, number> | null {
  const depths = new Map<string, number>([[focus, 0]]);

  // Dependencies sit above the focus, so the layout keeps reading downward from
  // "used by" to "uses". A node on both sides of a cycle keeps the first layer
  // it was given rather than being drawn twice.
  dependsOn.get(focus)?.forEach((dependency) => {
    if (!depths.has(dependency)) depths.set(dependency, -1);
  });
  dependedBy.get(focus)?.forEach((dependent) => {
    if (!depths.has(dependent)) depths.set(dependent, 1);
  });

  return depths.size > 1 ? depths : null;
}

/**
 * Nodes per track to lay each depth layer out in, chosen so the graph's
 * proportions land as close to the viewport's as the layer sizes allow.
 *
 * A layer drawn as one straight line is as long as the layer is large: 428 files
 * stacked at a 52px pitch is a ribbon 22,000px tall against a viewport a few
 * hundred px tall, which fits on screen at 4% and wastes everything either side.
 * Wrapping that layer into a block instead trades the cheap axis for the one
 * that was pushing the zoom down, and it works the same whichever way the layers
 * advance — which is why orientation is now a free choice rather than a tradeoff.
 */
function chooseTrackFill(
  layerSizes: number[],
  targetAspect: number,
  trackPitch: number,
  layerPitch: number,
  crossPitch: number,
  baseCross: number,
  vertical: boolean
): number {
  const largestLayer = Math.max(1, ...layerSizes);

  // A layer only wraps once one straight line of it would overrun the viewport
  // several times over; below that the layers read better as single lines.
  if (largestLayer * crossPitch <= 2 * baseCross) return largestLayer;

  let bestFill = largestLayer;
  let bestDistance = Infinity;

  for (let fill = 1; fill <= largestLayer; fill++) {
    // Tracks inside one layer sit at the tighter node pitch; only the step from
    // one layer to the next needs room for the edges crossing between them.
    let flow = 0;
    for (const size of layerSizes) {
      flow += (Math.ceil(size / fill) - 1) * trackPitch + layerPitch;
    }
    flow -= layerPitch;

    const cross = fill * crossPitch;
    const aspect = vertical ? cross / flow : flow / cross;
    // Compared in log space so "twice as wide as wanted" and "twice as tall"
    // count the same against each other.
    const distance = Math.abs(Math.log(aspect / targetAspect));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestFill = fill;
    }
  }

  return bestFill;
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

  // Head cursor instead of queue.shift(): shift() is O(n) on arrays.
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++]!;
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

  // Remaining unresolved dependencies per node. A node is only ready once every
  // node it depends on has a final depth, which makes each node dequeue exactly
  // once. The previous version re-queued nodes as depths were relaxed and paid a
  // linear `queue.includes` plus a full dependency re-scan per visit, which on
  // deeply chained import graphs degraded to roughly O(V*E).
  const pendingDeps = new Map<string, number>();
  const queue: string[] = [];

  allNodeIds.forEach((id) => {
    const pending = dependsOn.get(id)?.size ?? 0;
    pendingDeps.set(id, pending);
    if (pending === 0) {
      nodeDepth.set(id, 0);
      queue.push(id);
    }
  });

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++]!;
    const currentDepth = nodeDepth.get(current)!;

    dependedBy.get(current)?.forEach((parent) => {
      const existingDepth = nodeDepth.get(parent);
      const newDepth = currentDepth + 1;

      if (existingDepth === undefined || newDepth > existingDepth) {
        nodeDepth.set(parent, newDepth);
      }

      const pending = (pendingDeps.get(parent) ?? 0) - 1;
      pendingDeps.set(parent, pending);
      if (pending === 0) {
        queue.push(parent);
      }
    });
  }

  // Nodes inside a dependency cycle never reach a pending count of 0, so they
  // keep whatever depth relaxation gave them, or fall back to 0 like before.
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
): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Whether `focus` applied; false when it was absent or the node stood alone. */
  focused: boolean;
} {
  const baseWidth = options?.width ?? DEFAULT_WIDTH;
  const baseHeight = options?.height ?? DEFAULT_HEIGHT;
  const padding = options?.padding ?? DEFAULT_PADDING;
  const minVerticalGap =
    options?.minVerticalGap ?? DEFAULT_MIN_VERTICAL_GAP;
  const minLevelWidth = options?.minLevelWidth ?? DEFAULT_MIN_LEVEL_WIDTH;
  const minLevelHeight = options?.minLevelHeight ?? DEFAULT_MIN_LEVEL_HEIGHT;
  const layerOrder: GraphLayerOrder = options?.layerOrder ?? "leaves-first";
  const orientation: GraphOrientation = options?.orientation ?? "top-to-bottom";

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

  const focused = options?.focus
    ? computeFocusDepths(options.focus, dependsOn, dependedBy)
    : null;

  const nodeDepth =
    focused ??
    (layerOrder === "roots-first"
      ? computeNodeDepthRootsFirst(allNodeIds, dependsOn, dependedBy)
      : computeNodeDepthLeavesFirst(allNodeIds, dependsOn, dependedBy));

  // Group nodes by depth
  const nodesByDepth = new Map<number, string[]>();
  nodeDepth.forEach((depth, nodeId) => {
    if (!nodesByDepth.has(depth)) {
      nodesByDepth.set(depth, []);
    }
    nodesByDepth.get(depth)!.push(nodeId);
  });

  const maxDepth = Math.max(...nodeDepth.values(), 0);

  // Edges are emitted pointing down the layout, so the graph always reads as a
  // tree: whichever end sits higher is drawn pointing at the one below it. That
  // reverses the declared direction wherever a dependency is drawn above the
  // things that use it, so callers that need to know what imports what should
  // read the `DependencyEdge` list rather than these.
  const graphEdges: GraphEdge[] = [];
  dependencies.forEach((dep, idx) => {
    const fromDepth = nodeDepth.get(dep.from);
    const toDepth = nodeDepth.get(dep.to);
    // A focused layout leaves most of the graph out; its edges go with it.
    if (fromDepth === undefined || toDepth === undefined) return;

    const declaredPointsDown = fromDepth <= toDepth;
    graphEdges.push({
      id: `e${idx}`,
      source: declaredPointsDown ? dep.from : dep.to,
      target: declaredPointsDown ? dep.to : dep.from,
      type: dep.type,
      count: dep.count,
    });
  });

  // Most-depended-upon first inside each layer, so the widely used packages sit
  // in the layer's first track rather than wherever the traversal happened to
  // reach them. Stable, so equally used nodes keep their discovery order.
  nodesByDepth.forEach((ids) => {
    ids.sort(
      (a, b) => (dependentCount.get(b) ?? 0) - (dependentCount.get(a) ?? 0)
    );
  });

  const depths = [...nodesByDepth.keys()].sort((a, b) => a - b);
  const layerSizes = depths.map((depth) => nodesByDepth.get(depth)!.length);

  const vertical = orientation === "top-to-bottom";
  /** Flow-axis distance between wrapped tracks of the same layer. */
  const trackPitch = vertical ? minVerticalGap : minLevelWidth;
  /** Flow-axis distance between one layer and the next. */
  const layerPitch = vertical ? minLevelHeight : minLevelWidth;
  /** Distance between nodes sitting side by side within one track. */
  const crossPitch = vertical ? minLevelWidth : minVerticalGap;
  const baseFlow = vertical ? baseHeight : baseWidth;
  const baseCross = vertical ? baseWidth : baseHeight;

  // Wrap layers too long to read as one straight line.
  const trackFill = chooseTrackFill(
    layerSizes,
    baseWidth / baseHeight,
    trackPitch,
    layerPitch,
    crossPitch,
    baseCross,
    vertical
  );
  const layerTracks = layerSizes.map((size) =>
    Math.max(1, Math.ceil(size / trackFill))
  );
  const layerFill = layerSizes.map((size, i) =>
    Math.max(1, Math.ceil(size / layerTracks[i]!))
  );
  const maxFill = Math.max(1, ...layerFill);

  const crossExtent = Math.max(baseCross, 2 * padding + maxFill * crossPitch);

  /** Flow-axis offset of each layer's first track, before any stretch. */
  const offsetOfDepth = new Map<number, number>();
  let offset = 0;
  depths.forEach((depth, i) => {
    offsetOfDepth.set(depth, offset);
    offset += (layerTracks[i]! - 1) * trackPitch + layerPitch;
  });
  const rawFlow = Math.max(0, offset - layerPitch);

  const flowExtent = Math.max(baseFlow, 2 * padding + rawFlow);
  // Stretched only when the graph is smaller than the base box, so a layout that
  // already overflows keeps its natural pitches.
  const flowScale =
    rawFlow > 0 ? (flowExtent - 2 * padding) / rawFlow : 1;

  // Create nodes with hierarchical positions
  const graphNodes: GraphNode[] = [];
  const nodeTypeMap = new Map<string, "app" | "package">();
  apps.forEach((app) => nodeTypeMap.set(app.name, "app"));
  packages.forEach((pkg) => nodeTypeMap.set(pkg.name, "package"));

  depths.forEach((depth, layer) => {
    const nodesAtDepth = nodesByDepth.get(depth)!;
    const layerOffset = offsetOfDepth.get(depth)!;
    const fill = layerFill[layer]!;
    const crossSpacing = (crossExtent - 2 * padding) / fill;

    nodesAtDepth.forEach((nodeId, index) => {
      // Filled track by track, so the layer's first track holds its most used
      // nodes and the rest follow in order.
      const flow =
        padding +
        (layerOffset + Math.floor(index / fill) * trackPitch) * flowScale;
      const cross = padding + crossSpacing * ((index % fill) + 0.5);
      graphNodes.push({
        id: nodeId,
        name: nodeId,
        type: nodeTypeMap.get(nodeId) ?? "package",
        x: vertical ? cross : flow,
        y: vertical ? flow : cross,
        dependencies: dependencyCount.get(nodeId) ?? 0,
        dependents: dependentCount.get(nodeId) ?? 0,
      });
    });
  });

  return { nodes: graphNodes, edges: graphEdges, focused: focused !== null };
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

/**
 * Viewport that frames every node, preserving aspect ratio and never zooming past 1:1.
 * Returns null for an empty graph.
 *
 * Single pass over the nodes: the earlier spread form (`Math.min(...nodes.map(...))`)
 * allocated four intermediate arrays and would blow the argument limit past ~65k nodes.
 */
export function computeFitViewBox(
  nodeList: readonly Pick<GraphNode, "x" | "y">[],
  containerWidth: number,
  containerHeight: number,
  padding = 80,
): { x: number; y: number; width: number; height: number; zoom: number } | null {
  if (nodeList.length === 0) return null;

  const hw = GRAPH_NODE_CARD.halfWidth;
  const hh = GRAPH_NODE_CARD.halfHeight;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of nodeList) {
    if (node.x < minX) minX = node.x;
    if (node.x > maxX) maxX = node.x;
    if (node.y < minY) minY = node.y;
    if (node.y > maxY) maxY = node.y;
  }

  minX -= hw + padding;
  maxX += hw + padding;
  minY -= hh + padding;
  maxY += hh + padding;

  const cw = containerWidth || DEFAULT_WIDTH;
  const ch = containerHeight || DEFAULT_HEIGHT;

  const scale = Math.min(cw / (maxX - minX), ch / (maxY - minY), 1);
  const viewWidth = cw / scale;
  const viewHeight = ch / scale;

  return {
    x: (minX + maxX) / 2 - viewWidth / 2,
    y: (minY + maxY) / 2 - viewHeight / 2,
    width: viewWidth,
    height: viewHeight,
    zoom: scale,
  };
}
