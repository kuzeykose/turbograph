"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Github,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib/utils";
import { GraphCanvasLayer } from "./graph/graph-canvas-layer";
import { GraphWasmLayer } from "./graph/graph-wasm-layer";
import { formatNodeLabel, formatTabLabel } from "./graph/node-label";
import { searchNodes, type SearchableNode } from "./graph/node-search";
import { useGraphViewport } from "./graph/use-graph-viewport";
import {
  type PackageInfo,
  type DependencyEdge,
  type GraphNode,
  type GraphEdge,
  calculateGraphLayout,
  generateEdgePath,
  GRAPH_NODE_CARD,
  nodeColors,
  edgeColors,
} from "@workspace/graph";

interface Node extends GraphNode {
  fx?: number;
  fy?: number;
}

type Edge = GraphEdge;

/**
 * Node count above which the graph is painted to a canvas. Package dependency
 * graphs sit in the tens; a file-to-file import graph reaches ~1500 nodes and
 * several thousand edges, which as SVG is roughly 17,500 live elements.
 */
const CANVAS_NODE_THRESHOLD = 300;

const FNV_OFFSET = 2166136261;

/** FNV-1a over one string, continuing from `seed` so keys can be chained. */
function mixString(value: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash;
}

/**
 * Cheap fingerprint of the layout inputs.
 *
 * The layout effect keys on this rather than on array identity, so a caller that
 * rebuilds `apps`/`packages`/`dependencies` inline does not trigger a re-layout
 * and viewport refit on every render. It replaces an earlier fingerprint that
 * sorted and JSON-stringified every edge — O(n log n) plus a multi-megabyte
 * string — with a single O(n) pass and no allocation.
 *
 * Per-entry hashes are summed rather than chained, which makes the result
 * independent of array order: the same workspace re-fetched with its packages in
 * a different order is the same graph, and re-laying it out would shuffle every
 * node on screen and discard the positions the user dragged them to.
 */
function graphSignature(
  apps: PackageInfo[],
  packages: PackageInfo[],
  dependencies: DependencyEdge[],
): number {
  let hash = 0;

  for (const app of apps)
    hash = (hash + mixString(app.name, FNV_OFFSET ^ 1)) | 0;
  for (const pkg of packages)
    hash = (hash + mixString(pkg.name, FNV_OFFSET ^ 2)) | 0;
  for (const dep of dependencies) {
    let edge = mixString(dep.from, FNV_OFFSET ^ 3);
    edge = mixString(dep.to, edge);
    edge = mixString(dep.type, edge);
    hash = (hash + edge) | 0;
  }
  return hash;
}

/** A position the user dragged a node to. */
interface Placement {
  x: number;
  y: number;
}

/**
 * Node positions placed by dragging, held outside React.
 *
 * Dragging writes to `nodes`, which is state, and the graph is unmounted every
 * time the page switches tabs — so on its own a manual arrangement lives only
 * until the user looks at something else. Keying by graph and layer order means
 * a different workspace, or the other layer direction, still starts from its
 * computed layout.
 */
const placementCache = new Map<string, Map<string, Placement>>();
/** Only the graphs a user has looked at recently are worth remembering. */
const PLACEMENT_CACHE_LIMIT = 8;

function placementsFor(key: string): Map<string, Placement> {
  let placements = placementCache.get(key);
  if (!placements) {
    placements = new Map();
    placementCache.set(key, placements);
    if (placementCache.size > PLACEMENT_CACHE_LIMIT) {
      const oldest = placementCache.keys().next().value;
      if (oldest !== undefined) placementCache.delete(oldest);
    }
  }
  return placements;
}

/** When set, enables “Open on GitHub” for the selected workspace package path. */
export interface GraphGithubContext {
  owner: string;
  repo: string;
  branch?: string | null;
}

function githubContentUrl(
  ctx: GraphGithubContext,
  relativePath: string,
): string {
  const branch = ctx.branch?.trim() || "HEAD";
  const p = relativePath.replace(/^\/+/, "");
  const kind = /\.[^./]+$/.test(p) ? "blob" : "tree";
  return `https://github.com/${ctx.owner}/${ctx.repo}/${kind}/${encodeURIComponent(branch)}/${p}`;
}

interface TurborepoGraphVisualProps {
  apps: PackageInfo[];
  packages: PackageInfo[];
  dependencies: DependencyEdge[];
  className?: string;
  github?: GraphGithubContext | null;
  /** Which edge legend to show. Defaults to declared package.json deps. */
  edgeMode?: "declared" | "imports";
}

export function TurborepoGraphVisual({
  apps,
  packages,
  dependencies,
  className,
  github = null,
  edgeMode = "declared",
}: TurborepoGraphVisualProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Wraps whichever renderer is active; the viewport measures against it. */
  const surfaceRef = useRef<HTMLDivElement>(null);
  /** Pointer-down position (SVG coords) for node drag; used to distinguish click vs drag. */
  const nodePointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const nodeDragDidMoveRef = useRef(false);
  /** Latest position of the node being dragged in the SVG renderer. */
  const nodeDragPosRef = useRef<{ x: number; y: number } | null>(null);
  /** After a real node drag, skip the following click so selection does not jump to the dragged node. */
  const suppressNextNodeClickRef = useRef(false);
  /** Pan started on empty graph: deselect only if pointer barely moved (click), not after a real pan. */
  const panFromBgRef = useRef(false);
  const panClientStartRef = useRef<{ x: number; y: number } | null>(null);
  const panDragDidMoveRef = useRef(false);

  const [nodes, setNodes] = useState<Node[]>([]);
  /**
   * Whether the layout on screen is re-rooted at a node. Reported by the layout
   * rather than inferred from the node count, which reads as "not focused" on a
   * tree that happens to reach every node.
   */
  const [isFocused, setIsFocused] = useState(false);
  const [edges, setEdges] = useState<Edge[]>([]);
  /**
   * Nodes with a tab open in the header, in the order they were opened. The
   * main graph is always the first tab and is never in this list.
   */
  const [nodeTabs, setNodeTabs] = useState<string[]>([]);
  /** Node whose tab is showing, or null for the main graph. */
  const [activeTab, setActiveTab] = useState<string | null>(null);
  /** A node tab is a view of one node, so the tab is the selection. */
  const selectedNode = activeTab;
  /**
   * The tab strip scrolls once enough tabs are open, so a tab that just became
   * active can be off-screen — including the one a click on the graph opened.
   */
  const activeTabRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // jsdom has no layout, and so no scrollIntoView.
    activeTabRef.current?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeTab]);

  /**
   * A strip that scrolls without saying so reads as a strip with tabs missing.
   * Arrows on the side that has more tabs are the whole of the affordance, so
   * they have to track the strip's actual scroll position.
   */
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [tabOverflow, setTabOverflow] = useState({ left: false, right: false });
  const syncTabOverflow = useCallback(() => {
    const strip = tabStripRef.current;
    if (!strip) return;
    const { scrollLeft, scrollWidth, clientWidth } = strip;
    // A fraction of a pixel of overflow is rounding, not a hidden tab.
    setTabOverflow((prev) => {
      const left = scrollLeft > 1;
      const right = scrollLeft + clientWidth < scrollWidth - 1;
      return prev.left === left && prev.right === right
        ? prev
        : { left, right };
    });
  }, []);

  useEffect(() => {
    syncTabOverflow();
    const strip = tabStripRef.current;
    // Neither the tab count nor the strip's own width moves alone: closing a
    // tab and dragging the window narrower both change what is reachable.
    if (!strip || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncTabOverflow);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [nodeTabs, syncTabOverflow]);

  /** One arrow press should uncover roughly a screenful of tabs. */
  const scrollTabStrip = useCallback((direction: -1 | 1) => {
    const strip = tabStripRef.current;
    if (!strip) return;
    strip.scrollBy?.({
      left: direction * Math.max(120, strip.clientWidth * 0.6),
      behavior: "smooth",
    });
  }, []);

  /**
   * Clicking a node opens its tab rather than changing the graph under the
   * reader: the main graph keeps its own view, and every node they opened stays
   * one click away in the header.
   */
  const openNodeTab = useCallback((nodeId: string | null) => {
    // Background clicks land here as null; they must not close the tab.
    if (nodeId === null) return;
    setNodeTabs((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
    setActiveTab(nodeId);
  }, []);

  const closeNodeTab = useCallback((nodeId: string) => {
    setNodeTabs((prev) => prev.filter((id) => id !== nodeId));
    setActiveTab((current) => (current === nodeId ? null : current));
  }, []);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  /**
   * Past this size the graph is drawn to a canvas instead of SVG. Smaller graphs
   * — every package-level dependency graph — keep the DOM renderer, which stays
   * inspectable and testable.
   */
  const useCanvas = nodes.length > CANVAS_NODE_THRESHOLD;

  /**
   * The Rust + WebGL renderer is the default for large graphs; if the module or
   * a WebGL2 context is unavailable we drop to the Canvas 2D renderer rather
   * than to the DOM one, which is what struggles at this size.
   */
  const [wasmUnavailable, setWasmUnavailable] = useState<string | null>(null);
  const handleWasmUnavailable = useCallback((reason: string) => {
    console.warn(`Graph WebGL renderer unavailable, using canvas: ${reason}`);
    setWasmUnavailable(reason);
  }, []);
  const useWasm = useCanvas && wasmUnavailable === null;

  /**
   * The active renderer publishes its paint function here, so viewport changes
   * repaint through one animation frame instead of a React render per event.
   */
  const renderRef = useRef<(() => void) | null>(null);
  /**
   * Returns its own unregister rather than taking a later `null`, so a layer
   * being torn down cannot clear the registration its replacement just made.
   * The SVG effect's cleanup and a canvas layer's mount both fire when the graph
   * crosses the canvas threshold, and only one of them owns the slot.
   */
  const registerRender = useCallback((render: () => void) => {
    renderRef.current = render;
    return () => {
      if (renderRef.current === render) renderRef.current = null;
    };
  }, []);
  const handleViewportChange = useCallback(() => {
    renderRef.current?.();
  }, []);

  const layoutSignature = useMemo(
    () => graphSignature(apps, packages, dependencies),
    [apps, packages, dependencies],
  );

  /**
   * Selecting a node cuts the graph down to it and its direct neighbours. Held
   * separately from `selectedNode` so the details panel can open on a node with
   * no edges at all without the layout collapsing to a single card.
   */
  const focusNode = selectedNode;

  /** Where this graph's dragged nodes are remembered, across re-layout and remount. */
  const placementKey = `${layoutSignature}:${focusNode ?? ""}`;

  const totalNodeCount = apps.length + packages.length;
  /** The Imports tab graphs source files, not workspace packages. */
  const nodeNoun = edgeMode === "imports" ? "files" : "packages";

  // --- search ---------------------------------------------------------------
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  /**
   * Searched over the props rather than the laid-out nodes, so a node tab —
   * which shows only one subtree — can still reach anything in the workspace.
   */
  const searchable = useMemo<SearchableNode[]>(
    () => [
      ...apps.map((app) => ({
        id: app.name,
        name: app.name,
        type: "app" as const,
      })),
      ...packages.map((pkg) => ({
        id: pkg.name,
        name: pkg.name,
        type: "package" as const,
      })),
    ],
    [apps, packages],
  );

  const results = useMemo(
    () => searchNodes(searchable, query),
    [searchable, query],
  );

  const openResult = useCallback(
    (nodeId: string) => {
      openNodeTab(nodeId);
      setQuery("");
      setHighlighted(0);
    },
    [openNodeTab],
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setQuery("");
        return;
      }
      if (results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((i) => (i + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((i) => (i - 1 + results.length) % results.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const picked = results[Math.min(highlighted, results.length - 1)];
        if (picked) openResult(picked.id);
      }
    },
    [results, highlighted, openResult],
  );

  /**
   * Node the highlight/dim pass works from.
   *
   * A focused graph is already nothing but the selected node and its direct
   * neighbours, so dimming everything more than one hop away would leave it
   * unchanged. There, only hovering dims.
   */
  const dimFrom = isFocused ? hoveredNode : (selectedNode ?? hoveredNode);

  /** Measured rather than assumed, so the panel's width stays in one place. */
  const detailsPanelRef = useRef<HTMLElement>(null);
  const getRightInset = useCallback(
    () => detailsPanelRef.current?.offsetWidth ?? 0,
    [],
  );

  const viewport = useGraphViewport({
    nodes,
    surfaceRef,
    onViewportChange: handleViewportChange,
    getRightInset,
  });
  const { zoom, zoomBy, fitView, centerOn, toGraphPoint, viewportRef } =
    viewport;

  // SVG paints the viewport straight onto the element's attribute.
  useEffect(() => {
    if (useCanvas) return;
    const apply = () => {
      const view = viewportRef.current;
      svgRef.current?.setAttribute(
        "viewBox",
        `${view.x} ${view.y} ${view.width} ${view.height}`,
      );
    };
    const unregister = registerRender(apply);
    apply();
    return unregister;
  }, [useCanvas, registerRender, viewportRef]);

  /** Backdrop bounds, generously padded so panning never runs off the grid. */
  const gridExtent = useMemo(() => {
    const pad = 2000;
    if (nodes.length === 0) {
      return { x: -pad, y: -pad, width: pad * 2, height: pad * 2 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      if (node.x < minX) minX = node.x;
      if (node.x > maxX) maxX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.y > maxY) maxY = node.y;
    }
    return {
      x: minX - pad,
      y: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }, [nodes]);

  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  // Get connected nodes for highlighting
  const connectedNodes = useMemo(() => {
    if (!dimFrom) return new Set<string>();
    const activeNode = dimFrom;
    const connected = new Set<string>();
    connected.add(activeNode);
    edges.forEach((edge) => {
      if (edge.source === activeNode) connected.add(edge.target);
      if (edge.target === activeNode) connected.add(edge.source);
    });
    return connected;
  }, [dimFrom, edges]);

  // Get connected edges for highlighting
  const connectedEdges = useMemo(() => {
    if (!dimFrom) return new Set<string>();
    const activeNode = dimFrom;
    const connected = new Set<string>();
    edges.forEach((edge) => {
      if (edge.source === activeNode || edge.target === activeNode) {
        connected.add(edge.id);
      }
    });
    return connected;
  }, [dimFrom, edges]);

  const getSvgPoint = toGraphPoint;

  const handleZoom = useCallback(
    (delta: number, centerX?: number, centerY?: number) => {
      zoomBy(delta, centerX, centerY);
    },
    [zoomBy],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const point = getSvgPoint(e.clientX, e.clientY);
      handleZoom(e.deltaY, point.x, point.y);
    },
    [getSvgPoint, handleZoom],
  );

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (
        e.target === svgRef.current ||
        (e.target as Element).classList.contains("graph-bg")
      ) {
        panFromBgRef.current = true;
        panClientStartRef.current = { x: e.clientX, y: e.clientY };
        panDragDidMoveRef.current = false;
        setIsPanning(true);
        viewport.beginPan(e.clientX, e.clientY);
      }
    },
    [viewport],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const pc = panClientStartRef.current;
        if (pc) {
          const dx = e.clientX - pc.x;
          const dy = e.clientY - pc.y;
          if (dx * dx + dy * dy > 36) {
            panDragDidMoveRef.current = true;
          }
        }
        viewport.panTo(e.clientX, e.clientY);
      } else if (draggedNode) {
        const point = getSvgPoint(e.clientX, e.clientY);
        const start = nodePointerStartRef.current;
        if (start) {
          const dx = point.x - start.x;
          const dy = point.y - start.y;
          if (dx * dx + dy * dy > 36) {
            nodeDragDidMoveRef.current = true;
          }
        }
        const x = point.x - dragOffset.x;
        const y = point.y - dragOffset.y;
        nodeDragPosRef.current = { x, y };
        setNodes((prev) =>
          prev.map((node) =>
            node.id === draggedNode ? { ...node, x, y, fx: x, fy: y } : node,
          ),
        );
      }
    },
    [isPanning, viewport, getSvgPoint, draggedNode, dragOffset],
  );

  const handleMouseUp = useCallback(() => {
    if (draggedNode) {
      const dropped = nodeDragPosRef.current;
      if (nodeDragDidMoveRef.current) {
        suppressNextNodeClickRef.current = true;
        // Remember the drop so a re-layout or a tab switch does not undo it.
        if (dropped) placementsFor(placementKey).set(draggedNode, dropped);
      }
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === draggedNode
            ? { ...node, fx: undefined, fy: undefined }
            : node,
        ),
      );
    }
    if (panFromBgRef.current && !panDragDidMoveRef.current) {
      setActiveTab(null);
    }
    panFromBgRef.current = false;
    panClientStartRef.current = null;
    panDragDidMoveRef.current = false;
    nodePointerStartRef.current = null;
    nodeDragDidMoveRef.current = false;
    nodeDragPosRef.current = null;
    setIsPanning(false);
    setDraggedNode(null);
  }, [draggedNode, placementKey]);

  // Node drag handlers
  const handleNodeMouseDown = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const point = getSvgPoint(e.clientX, e.clientY);
      const node = nodeById.get(nodeId);
      if (node) {
        nodePointerStartRef.current = { x: point.x, y: point.y };
        nodeDragDidMoveRef.current = false;
        setDragOffset({ x: point.x - node.x, y: point.y - node.y });
        setDraggedNode(nodeId);
      }
    },
    [getSvgPoint, nodeById],
  );

  /** Commit a canvas drag once, on release, rather than per pointer event. */
  const handleNodeMoved = useCallback(
    (id: string, x: number, y: number) => {
      placementsFor(placementKey).set(id, { x, y });
      setNodes((prev) =>
        prev.map((node) => (node.id === id ? { ...node, x, y } : node)),
      );
    },
    [placementKey],
  );

  const handleNodeClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (suppressNextNodeClickRef.current) {
      suppressNextNodeClickRef.current = false;
      return;
    }
    openNodeTab(nodeId);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Hierarchical layout + fit in one pass so viewBox uses the new positions (avoids stale-node race).
  useLayoutEffect(() => {
    const {
      nodes: layoutNodes,
      edges: layoutEdges,
      focused,
    } = calculateGraphLayout(apps, packages, dependencies, {
      width: 900,
      height: 550,
      padding: 80,
      focus: focusNode,
    });

    // Nodes the user placed by hand win over the computed layout, so a remount
    // — every tab switch unmounts this component — restores the arrangement.
    const placements = placementsFor(placementKey);
    if (placements.size > 0) {
      for (const node of layoutNodes) {
        const placed = placements.get(node.id);
        if (placed) {
          node.x = placed.x;
          node.y = placed.y;
        }
      }
    }

    setNodes(layoutNodes);
    setEdges(layoutEdges);
    setIsFocused(focused);

    if (layoutNodes.length === 0) return;
    // Fit against the fresh positions; React has not committed `nodes` yet.
    fitView(layoutNodes);

    // A node whose tab is open but which has no neighbours to show leaves the
    // whole graph on screen, so bring the viewport to it rather than dropping
    // the reader somewhere in the middle of everything.
    if (!focused && focusNode) {
      const opened = layoutNodes.find((node) => node.id === focusNode);
      if (opened) centerOn(opened.x, opened.y);
    }
    // `layoutSignature` stands in for apps/packages/dependencies so that unstable
    // prop identities cannot loop this effect. `placementKey` is derived from it
    // and `focusNode`, so it adds no re-runs of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutSignature, focusNode, placementKey, fitView, centerOn]);

  /**
   * Edge geometry is derived once per layout rather than per render. Resolving
   * endpoints with `nodes.find()` inside the render loop was O(edges x nodes) —
   * roughly 15M comparisons per frame on a 1500-file import graph, repaid on
   * every hover, pan and drag.
   */
  const edgePaths = useMemo(() => {
    const opts = {
      halfWidth: GRAPH_NODE_CARD.halfWidth,
      halfHeight: GRAPH_NODE_CARD.halfHeight,
    };
    return edges.map((edge) => {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      return {
        edge,
        d: source && target ? generateEdgePath(source, target, opts) : "",
      };
    });
  }, [edges, nodeById]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveTab(null);
      } else if (e.key === "+" || e.key === "=") {
        handleZoom(1);
      } else if (e.key === "-") {
        handleZoom(-1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoom]);

  const selectedNodeData = selectedNode
    ? (nodeById.get(selectedNode) ?? null)
    : null;

  const selectedPackageMeta = useMemo(() => {
    if (!selectedNode) return null;
    const app = apps.find((a) => a.name === selectedNode);
    if (app) return { path: app.path, kind: "app" as const };
    const pkg = packages.find((p) => p.name === selectedNode);
    if (pkg) return { path: pkg.path, kind: "package" as const };
    return null;
  }, [selectedNode, apps, packages]);

  /**
   * Read from the declared dependencies rather than the drawn edges: the layout
   * points edges down its flow axis, which reverses them in leaves-first order,
   * and these lists must keep saying which file imports which.
   */
  const selectedEdgeLists = useMemo(() => {
    const outgoing: Edge[] = [];
    const incoming: Edge[] = [];
    if (!selectedNode) return { outgoing, incoming };

    dependencies.forEach((dep, index) => {
      if (dep.from !== selectedNode && dep.to !== selectedNode) return;
      const edge: Edge = {
        id: `e${index}`,
        source: dep.from,
        target: dep.to,
        type: dep.type,
        count: dep.count,
      };
      if (dep.from === selectedNode) outgoing.push(edge);
      else incoming.push(edge);
    });
    return { outgoing, incoming };
  }, [selectedNode, dependencies]);

  const githubHref =
    github && selectedPackageMeta
      ? githubContentUrl(github, selectedPackageMeta.path)
      : null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-none",
        className,
        isFullscreen && "h-screen w-screen rounded-none",
      )}
    >
      {/* Header with controls */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Main graph first, then a tab per node the reader opened. */}
          <div
            className="flex min-w-0 flex-1 items-center gap-0.5"
            role="tablist"
            aria-label="Open graph views"
          >
            {/* The way back to the whole graph never scrolls out of reach. */}
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === null}
              onClick={() => setActiveTab(null)}
              title={`The whole graph, ${totalNodeCount} ${nodeNoun}`}
              className={cn(
                "shrink-0 rounded px-2 py-1 text-xs transition-colors",
                activeTab === null
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Graph
            </button>

            {tabOverflow.left ? (
              <button
                type="button"
                onClick={() => scrollTabStrip(-1)}
                aria-label="Scroll tabs left"
                className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ChevronLeft size={14} />
              </button>
            ) : null}

            <div role="presentation" className="relative flex min-w-0 flex-1">
              <div
                ref={tabStripRef}
                role="presentation"
                onScroll={syncTabOverflow}
                className="scrollbar-none flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
              >
                {nodeTabs.map((nodeId) => {
                  const label = formatTabLabel(nodeId, nodeTabs);
                  const isActive = activeTab === nodeId;
                  return (
                    <span
                      key={nodeId}
                      ref={
                        isActive
                          ? (activeTabRef as React.RefObject<HTMLSpanElement>)
                          : null
                      }
                      className={cn(
                        "flex shrink-0 items-center rounded transition-colors",
                        isActive ? "bg-secondary" : "hover:bg-secondary/50",
                      )}
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveTab(nodeId)}
                        title={nodeId}
                        className={cn(
                          "max-w-40 truncate py-1 pl-2 pr-1 text-xs transition-colors",
                          isActive
                            ? "font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {label}
                      </button>
                      <button
                        type="button"
                        onClick={() => closeNodeTab(nodeId)}
                        aria-label={`Close ${label}`}
                        className="rounded-r py-1 pl-0.5 pr-1.5 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  );
                })}
              </div>

              {/* Tabs fade out where they run under the arrow. */}
              {tabOverflow.left ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-card to-transparent"
                />
              ) : null}
              {tabOverflow.right ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-card to-transparent"
                />
              ) : null}
            </div>

            {tabOverflow.right ? (
              <button
                type="button"
                onClick={() => scrollTabStrip(1)}
                aria-label="Scroll tabs right"
                className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ChevronRight size={14} />
              </button>
            ) : null}
          </div>

          <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {isFocused
              ? `${nodes.length} of ${totalNodeCount}`
              : `${nodes.length} ${nodeNoun}`}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Finding one node by eye is hopeless past a few hundred of them. */}
          <div className="relative shrink-0">
            <Search
              size={13}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlighted(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={`Search ${nodeNoun}`}
              aria-label={`Search ${nodeNoun}`}
              className="h-7 w-44 rounded-md border border-border bg-background pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />

            {results.length > 0 ? (
              <ul
                role="listbox"
                aria-label="Search results"
                className="absolute right-0 top-full z-30 mt-1 max-h-72 w-80 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg"
              >
                {results.map((result, index) => {
                  const { primary, secondary } = formatNodeLabel(result.name);
                  return (
                    <li key={result.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === highlighted}
                        onMouseEnter={() => setHighlighted(index)}
                        onClick={() => openResult(result.id)}
                        className={cn(
                          "flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left transition-colors",
                          index === highlighted
                            ? "bg-secondary"
                            : "hover:bg-secondary/60",
                        )}
                      >
                        <span className="w-full truncate text-xs font-medium text-foreground">
                          {primary}
                        </span>
                        {secondary ? (
                          <span className="w-full truncate font-mono text-[10px] text-muted-foreground">
                            {secondary}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div className="mx-1 h-4 w-px bg-border" />

          <button
            onClick={() => handleZoom(1)}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => handleZoom(-1)}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => fitView()}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="Fit View"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <div className="ml-2 h-4 w-px bg-border" />
          <span className="text-xs text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* The renderers paint transparently, so this is the graph's background. */}
        <div ref={surfaceRef} className="relative min-h-0 flex-1 bg-card">
          {useWasm ? (
            <GraphWasmLayer
              nodes={nodes}
              edges={edges}
              selectedNode={selectedNode}
              dimUnrelated={!isFocused}
              onSelectNode={openNodeTab}
              onNodeMoved={handleNodeMoved}
              viewport={viewport}
              registerRender={registerRender}
              onUnavailable={handleWasmUnavailable}
              className={isPanning ? "cursor-grabbing" : "cursor-grab"}
            />
          ) : useCanvas ? (
            <GraphCanvasLayer
              nodes={nodes}
              edges={edges}
              nodeById={nodeById}
              selectedNode={selectedNode}
              dimUnrelated={!isFocused}
              onSelectNode={openNodeTab}
              onNodeMoved={handleNodeMoved}
              viewport={viewport}
              registerRender={registerRender}
              className={isPanning ? "cursor-grabbing" : "cursor-grab"}
            />
          ) : (
            <svg
              ref={svgRef}
              className={cn(
                "absolute inset-0 h-full w-full",
                isPanning
                  ? "cursor-grabbing"
                  : draggedNode
                    ? "cursor-move"
                    : "cursor-grab",
              )}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              {/* Background pattern */}
              <defs>
                <pattern
                  id="grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1" cy="1" r="1" fill="oklch(0.25 0 0)" />
                </pattern>
                {/* Arrow markers */}
                <marker
                  id="arrow-dependency"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto"
                >
                  <path
                    d="M 0 0 L 10 5 L 0 10 z"
                    fill={edgeColors.dependency}
                  />
                </marker>
                <marker
                  id="arrow-devDependency"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto"
                >
                  <path
                    d="M 0 0 L 10 5 L 0 10 z"
                    fill={edgeColors.devDependency}
                  />
                </marker>
                <marker
                  id="arrow-import"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColors.import} />
                </marker>
              </defs>

              {/* Grid background — sized to the layout, since the viewBox is now
              written imperatively and no longer re-renders this element. */}
              <rect
                className="graph-bg"
                x={gridExtent.x}
                y={gridExtent.y}
                width={gridExtent.width}
                height={gridExtent.height}
                fill="url(#grid)"
              />

              {/* Edges — opacity on <g> so stroke AND marker-end arrows dim together (markers ignore path strokeOpacity). */}
              <g className="edges">
                {edgePaths.map(({ edge, d }) => {
                  const isConnected = connectedEdges.has(edge.id);
                  const hasSelection = dimFrom;
                  const isDragging = !!draggedNode;
                  const edgeOpacity = hasSelection
                    ? isConnected
                      ? 1
                      : 0.02
                    : 0.6;
                  return (
                    <g
                      key={edge.id}
                      opacity={edgeOpacity}
                      className={
                        isDragging ? "" : "transition-opacity duration-200"
                      }
                    >
                      <path
                        d={d}
                        fill="none"
                        stroke={edgeColors[edge.type]}
                        strokeWidth={1}
                        strokeDasharray={
                          edge.type === "devDependency"
                            ? "6 4"
                            : edge.type === "import"
                              ? "2 3"
                              : "none"
                        }
                        markerEnd={`url(#arrow-${edge.type})`}
                      />
                    </g>
                  );
                })}
              </g>

              {/* Nodes */}
              <g className="nodes">
                {nodes.map((node) => {
                  const isSelected = selectedNode === node.id;
                  const isHovered = hoveredNode === node.id;
                  const isConnected = connectedNodes.has(node.id);
                  const hasSelection = dimFrom;
                  const colors = nodeColors[node.type];
                  const { primary, secondary } = formatNodeLabel(node.name);
                  const hw = GRAPH_NODE_CARD.halfWidth;
                  const hh = GRAPH_NODE_CARD.halfHeight;
                  const isDimmed = !!(hasSelection && !isConnected);
                  const shellOpacity = isDimmed ? 0.12 : 1;
                  const labelOpacity = isDimmed ? 0.28 : 1;

                  const meta = `${node.dependencies}d / ${node.dependents}r`;
                  const subRaw = [secondary, meta].filter(Boolean).join(" · ");
                  const subline =
                    subRaw.length > 46 ? `${subRaw.slice(0, 44)}…` : subRaw;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                      onClick={(e) => handleNodeClick(node.id, e)}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      className="cursor-pointer"
                    >
                      <title>{node.name}</title>
                      <g
                        style={{
                          opacity: shellOpacity,
                          transition: "opacity 0.2s ease",
                        }}
                      >
                        <rect
                          x={-hw}
                          y={-hh}
                          width={GRAPH_NODE_CARD.width}
                          height={GRAPH_NODE_CARD.height}
                          rx={GRAPH_NODE_CARD.rx}
                          ry={GRAPH_NODE_CARD.rx}
                          fill={colors.fill}
                          stroke={
                            isSelected
                              ? "oklch(0.96 0 0 / 0.85)"
                              : isHovered
                                ? "oklch(0.96 0 0 / 0.35)"
                                : colors.stroke
                          }
                          strokeWidth={isSelected ? 1.5 : 1}
                          className="transition-all duration-150"
                        />
                      </g>

                      <g
                        style={{
                          opacity: labelOpacity,
                          transition: "opacity 0.2s ease",
                        }}
                      >
                        <text
                          textAnchor="middle"
                          y={-2}
                          fill="oklch(0.97 0 0)"
                          fontSize="12"
                          fontWeight="600"
                          fontFamily="ui-sans-serif, system-ui, sans-serif"
                          className="pointer-events-none select-none"
                        >
                          {primary}
                        </text>

                        <text
                          textAnchor="middle"
                          y={11}
                          fill="oklch(0.82 0 0)"
                          fontSize="9.5"
                          fontFamily="ui-sans-serif, system-ui, sans-serif"
                          className="pointer-events-none select-none"
                        >
                          {subline}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}

          {selectedNodeData ? (
            <aside
              ref={detailsPanelRef}
              className="absolute inset-y-0 right-0 z-20 flex w-80 flex-col overflow-hidden border-l border-border bg-card shadow-lg"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Details
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveTab(null)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Close selection"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 h-9 w-9 shrink-0 rounded-md"
                    style={{
                      backgroundColor: nodeColors[selectedNodeData.type].fill,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold leading-tight text-foreground">
                      {selectedNodeData.name.split("/").pop()}
                    </p>
                    <p className="mt-1.5 break-all font-mono text-xs leading-snug text-muted-foreground">
                      {selectedNodeData.name}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <span
                    className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${nodeColors[selectedNodeData.type].fill}, transparent 82%)`,
                      color: nodeColors[selectedNodeData.type].fill,
                    }}
                  >
                    {selectedNodeData.type}
                  </span>
                </div>

                {selectedPackageMeta ? (
                  <div className="mt-5 space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Monorepo path
                    </p>
                    <code className="block rounded-md bg-secondary px-2.5 py-2 text-xs text-foreground">
                      {selectedPackageMeta.path}
                    </code>
                  </div>
                ) : null}

                {githubHref ? (
                  <a
                    href={githubHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    <Github size={16} />
                    Open on GitHub
                  </a>
                ) : null}

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-secondary/80 px-3 py-3">
                    <div className="text-xl font-semibold tabular-nums text-foreground">
                      {selectedNodeData.dependencies}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Dependencies
                    </div>
                  </div>
                  <div className="rounded-lg bg-secondary/80 px-3 py-3">
                    <div className="text-xl font-semibold tabular-nums text-foreground">
                      {selectedNodeData.dependents}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Dependents
                    </div>
                  </div>
                </div>

                {(selectedEdgeLists.outgoing.length > 0 ||
                  selectedEdgeLists.incoming.length > 0) && (
                  <div className="mt-6 space-y-5 border-t border-border pt-6">
                    {selectedEdgeLists.outgoing.length > 0 ? (
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {edgeMode === "imports" ? "Imports" : "Depends on"}
                        </p>
                        <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                          {selectedEdgeLists.outgoing.map((e) => (
                            <li
                              key={e.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="truncate font-mono text-xs text-foreground">
                                {e.target}
                              </span>
                              <span className="shrink-0 text-[10px] capitalize text-muted-foreground">
                                {e.type === "import"
                                  ? "imports"
                                  : e.type === "devDependency"
                                    ? "dev"
                                    : "prod"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {selectedEdgeLists.incoming.length > 0 ? (
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {edgeMode === "imports"
                            ? "Imported by"
                            : "Depended on by"}
                        </p>
                        <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                          {selectedEdgeLists.incoming.map((e) => (
                            <li
                              key={e.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="truncate font-mono text-xs text-foreground">
                                {e.source}
                              </span>
                              <span className="shrink-0 text-[10px] capitalize text-muted-foreground">
                                {e.type === "import"
                                  ? "imports"
                                  : e.type === "devDependency"
                                    ? "dev"
                                    : "prod"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </aside>
          ) : null}
        </div>

        {/* Legend */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border bg-card px-2 py-2">
          <div className="flex items-center gap-6">
            <span className="text-xs font-medium text-muted-foreground">
              Nodes
            </span>
            {(["app", "package"] as const).map((type) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="h-3.5 w-3.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: nodeColors[type].fill }}
                  title={type}
                />
                <span className="text-xs capitalize text-muted-foreground">
                  {type === "app"
                    ? edgeMode === "imports"
                      ? "App file"
                      : "Application"
                    : edgeMode === "imports"
                      ? "Package file"
                      : "Package"}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6">
            <span className="text-xs font-medium text-muted-foreground">
              Edges
            </span>
            {edgeMode === "imports" ? (
              <div className="flex items-center gap-2">
                <div
                  className="h-0.5 w-5 rounded-full"
                  style={{
                    backgroundColor: edgeColors.import,
                    backgroundImage:
                      "repeating-linear-gradient(90deg, transparent, transparent 2px, oklch(0.09 0 0) 2px, oklch(0.09 0 0) 4px)",
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  File import
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div
                    className="h-0.5 w-5 rounded-full"
                    style={{ backgroundColor: edgeColors.dependency }}
                  />
                  <span className="text-xs text-muted-foreground">
                    Dependency
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-0.5 w-5 rounded-full"
                    style={{
                      backgroundColor: edgeColors.devDependency,
                      backgroundImage:
                        "repeating-linear-gradient(90deg, transparent, transparent 3px, oklch(0.09 0 0) 3px, oklch(0.09 0 0) 5px)",
                    }}
                  />
                  <span className="text-xs text-muted-foreground">Dev</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
