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
  X,
} from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib/utils";
import {
  type PackageInfo,
  type DependencyEdge,
  type GraphNode,
  type GraphEdge,
  type GraphLayerOrder,
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

function formatNodeLabel(fullName: string): {
  primary: string;
  secondary: string | null;
} {
  const segments = fullName.split("/");
  const primaryRaw = segments[segments.length - 1] ?? fullName;
  const primary =
    primaryRaw.length > 26 ? `${primaryRaw.slice(0, 24)}…` : primaryRaw;

  let secondary: string | null = null;
  if (fullName.startsWith("@") && fullName.includes("/")) {
    const i = fullName.indexOf("/");
    const scope = fullName.slice(0, i + 1);
    secondary = scope.length > 30 ? `${scope.slice(0, 28)}…` : scope;
  } else if (segments.length > 1) {
    const prefix = segments.slice(0, -1).join("/");
    secondary = prefix.length > 30 ? `${prefix.slice(0, 28)}…` : prefix;
  }

  return { primary, secondary };
}

type Edge = GraphEdge;

function computeFitViewBox(
  nodeList: Pick<GraphNode, "x" | "y">[],
  containerWidth: number,
  containerHeight: number,
): {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
} | null {
  if (nodeList.length === 0) return null;

  const padding = 80;
  const hw = GRAPH_NODE_CARD.halfWidth;
  const hh = GRAPH_NODE_CARD.halfHeight;

  const minX = Math.min(...nodeList.map((n) => n.x)) - hw - padding;
  const maxX = Math.max(...nodeList.map((n) => n.x)) + hw + padding;
  const minY = Math.min(...nodeList.map((n) => n.y)) - hh - padding;
  const maxY = Math.max(...nodeList.map((n) => n.y)) + hh + padding;

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  const cw = containerWidth || 900;
  const ch = containerHeight || 550;

  const scaleX = cw / contentWidth;
  const scaleY = ch / contentHeight;
  const scale = Math.min(scaleX, scaleY, 1);

  const viewWidth = cw / scale;
  const viewHeight = ch / scale;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    x: centerX - viewWidth / 2,
    y: centerY - viewHeight / 2,
    width: viewWidth,
    height: viewHeight,
    zoom: scale,
  };
}

/** When set, enables “Open on GitHub” for the selected workspace package path. */
export interface GraphGithubContext {
  owner: string;
  repo: string;
  branch?: string | null;
}

function githubTreeUrl(
  ctx: GraphGithubContext,
  relativePath: string,
): string {
  const branch = ctx.branch?.trim() || "HEAD";
  const p = relativePath.replace(/^\/+/, "");
  return `https://github.com/${ctx.owner}/${ctx.repo}/tree/${encodeURIComponent(branch)}/${p}`;
}

interface TurborepoGraphVisualProps {
  apps: PackageInfo[];
  packages: PackageInfo[];
  dependencies: DependencyEdge[];
  className?: string;
  github?: GraphGithubContext | null;
}

export function TurborepoGraphVisual({
  apps,
  packages,
  dependencies,
  className,
  github = null,
}: TurborepoGraphVisualProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Pointer-down position (SVG coords) for node drag; used to distinguish click vs drag. */
  const nodePointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const nodeDragDidMoveRef = useRef(false);
  /** After a real node drag, skip the following click so selection does not jump to the dragged node. */
  const suppressNextNodeClickRef = useRef(false);
  /** Pan started on empty graph: deselect only if pointer barely moved (click), not after a real pan. */
  const panFromBgRef = useRef(false);
  const panClientStartRef = useRef<{ x: number; y: number } | null>(null);
  const panDragDidMoveRef = useRef(false);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [viewBox, setViewBox] = useState({
    x: 0,
    y: 0,
    width: 900,
    height: 550,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layerOrder, setLayerOrder] = useState<GraphLayerOrder>("roots-first");

  const graphInputsKey = useMemo(
    () =>
      JSON.stringify({
        appNames: apps.map((a) => a.name).sort(),
        packageNames: packages.map((p) => p.name).sort(),
        deps: dependencies
          .map((d) => `${d.from}\0${d.to}\0${d.type}`)
          .sort()
          .join("|"),
      }),
    [apps, packages, dependencies],
  );

  // Initialize viewBox based on actual SVG dimensions
  useLayoutEffect(() => {
    const updateViewBox = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const width = rect.width || 900;
        const height = isFullscreen ? rect.height : 500;

        setViewBox((prev) => ({
          ...prev,
          width: width || 900,
          height: height || 550,
        }));
      }
    };

    updateViewBox();
    window.addEventListener("resize", updateViewBox);
    return () => window.removeEventListener("resize", updateViewBox);
  }, [isFullscreen]);

  // Get connected nodes for highlighting
  const connectedNodes = useMemo(() => {
    if (!selectedNode && !hoveredNode) return new Set<string>();
    const activeNode = selectedNode || hoveredNode;
    const connected = new Set<string>();
    connected.add(activeNode!);
    edges.forEach((edge) => {
      if (edge.source === activeNode) connected.add(edge.target);
      if (edge.target === activeNode) connected.add(edge.source);
    });
    return connected;
  }, [selectedNode, hoveredNode, edges]);

  // Get connected edges for highlighting
  const connectedEdges = useMemo(() => {
    if (!selectedNode && !hoveredNode) return new Set<string>();
    const activeNode = selectedNode || hoveredNode;
    const connected = new Set<string>();
    edges.forEach((edge) => {
      if (edge.source === activeNode || edge.target === activeNode) {
        connected.add(edge.id);
      }
    });
    return connected;
  }, [selectedNode, hoveredNode, edges]);

  // SVG coordinate conversion
  const getSvgPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const x =
        ((clientX - rect.left) / rect.width) * viewBox.width + viewBox.x;
      const y =
        ((clientY - rect.top) / rect.height) * viewBox.height + viewBox.y;
      return { x, y };
    },
    [viewBox],
  );

  // Zoom handlers
  const handleZoom = useCallback(
    (delta: number, centerX?: number, centerY?: number) => {
      setViewBox((prev) => {
        const factor = delta > 0 ? 0.9 : 1.1;
        const newWidth = prev.width * factor;
        const newHeight = prev.height * factor;

        if (newWidth < 200 || newWidth > 2000) return prev;

        const cx = centerX ?? prev.x + prev.width / 2;
        const cy = centerY ?? prev.y + prev.height / 2;

        const newX = cx - (cx - prev.x) * factor;
        const newY = cy - (cy - prev.y) * factor;

        setZoom(900 / newWidth);
        return { x: newX, y: newY, width: newWidth, height: newHeight };
      });
    },
    [],
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
        setPanStart(getSvgPoint(e.clientX, e.clientY));
      }
    },
    [getSvgPoint],
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
        const current = getSvgPoint(e.clientX, e.clientY);
        setViewBox((prev) => ({
          ...prev,
          x: prev.x + (panStart.x - current.x),
          y: prev.y + (panStart.y - current.y),
        }));
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
        setNodes((prev) =>
          prev.map((node) =>
            node.id === draggedNode
              ? {
                ...node,
                x: point.x - dragOffset.x,
                y: point.y - dragOffset.y,
                fx: point.x - dragOffset.x,
                fy: point.y - dragOffset.y,
              }
              : node,
          ),
        );
      }
    },
    [isPanning, panStart, getSvgPoint, draggedNode, dragOffset],
  );

  const handleMouseUp = useCallback(() => {
    if (draggedNode) {
      if (nodeDragDidMoveRef.current) {
        suppressNextNodeClickRef.current = true;
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
      setSelectedNode(null);
    }
    panFromBgRef.current = false;
    panClientStartRef.current = null;
    panDragDidMoveRef.current = false;
    nodePointerStartRef.current = null;
    nodeDragDidMoveRef.current = false;
    setIsPanning(false);
    setDraggedNode(null);
  }, [draggedNode]);

  // Node drag handlers
  const handleNodeMouseDown = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const point = getSvgPoint(e.clientX, e.clientY);
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        nodePointerStartRef.current = { x: point.x, y: point.y };
        nodeDragDidMoveRef.current = false;
        setDragOffset({ x: point.x - node.x, y: point.y - node.y });
        setDraggedNode(nodeId);
      }
    },
    [getSvgPoint, nodes],
  );

  const handleNodeClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (suppressNextNodeClickRef.current) {
      suppressNextNodeClickRef.current = false;
      return;
    }
    setSelectedNode((prev) => (prev === nodeId ? null : nodeId));
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

  const fitView = useCallback(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const box = computeFitViewBox(
      nodes,
      rect.width || 900,
      rect.height || 550,
    );
    if (!box) return;
    setViewBox({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
    setZoom(box.zoom);
  }, [nodes]);

  // Hierarchical layout + fit in one pass so viewBox uses the new positions (avoids stale-node race).
  useLayoutEffect(() => {
    const { nodes: layoutNodes, edges: layoutEdges } = calculateGraphLayout(
      apps,
      packages,
      dependencies,
      { width: 900, height: 550, padding: 80, layerOrder },
    );

    setNodes(layoutNodes);
    setEdges(layoutEdges);

    if (!svgRef.current || layoutNodes.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const box = computeFitViewBox(
      layoutNodes,
      rect.width || 900,
      rect.height || 550,
    );
    if (!box) return;
    setViewBox({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
    setZoom(box.zoom);
    // graphInputsKey fingerprints apps/packages/dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphInputsKey, layerOrder]);

  const edgePathOpts = useMemo(
    () => ({
      halfWidth: GRAPH_NODE_CARD.halfWidth,
      halfHeight: GRAPH_NODE_CARD.halfHeight,
    }),
    [],
  );

  const getEdgePath = useCallback(
    (edge: Edge) => {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);
      if (!source || !target) return "";
      return generateEdgePath(source, target, edgePathOpts);
    },
    [nodes, edgePathOpts],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedNode(null);
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
    ? nodes.find((n) => n.id === selectedNode)
    : null;

  const selectedPackageMeta = useMemo(() => {
    if (!selectedNode) return null;
    const app = apps.find((a) => a.name === selectedNode);
    if (app) return { path: app.path, kind: "app" as const };
    const pkg = packages.find((p) => p.name === selectedNode);
    if (pkg) return { path: pkg.path, kind: "package" as const };
    return null;
  }, [selectedNode, apps, packages]);

  const selectedEdgeLists = useMemo(() => {
    if (!selectedNode) {
      return { outgoing: [] as Edge[], incoming: [] as Edge[] };
    }
    return {
      outgoing: edges.filter((e) => e.source === selectedNode),
      incoming: edges.filter((e) => e.target === selectedNode),
    };
  }, [selectedNode, edges]);

  const githubHref =
    github && selectedPackageMeta
      ? githubTreeUrl(github, selectedPackageMeta.path)
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
      <div className="flex items-center justify-between border-b border-border bg-card px-2 py-1.5">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-0.5 rounded-md border border-border p-0.5"
            role="group"
            aria-label="Graph column order"
          >
            <button
              type="button"
              title="Entry packages on the left, dependencies to the right"
              onClick={() => setLayerOrder("roots-first")}
              className={cn(
                "rounded px-2 py-1 text-xs transition-colors",
                layerOrder === "roots-first"
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Roots
            </button>
            <button
              type="button"
              title="Workspace leaves on the left, dependents to the right"
              onClick={() => setLayerOrder("leaves-first")}
              className={cn(
                "rounded px-2 py-1 text-xs transition-colors",
                layerOrder === "leaves-first"
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Leaves
            </button>
          </div>
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {nodes.length} packages
          </span>
        </div>
        <div className="flex items-center gap-1">
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
            onClick={fitView}
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
        <div className="relative min-h-0 flex-1">
            <svg
              ref={svgRef}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
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
              <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColors.dependency} />
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
              <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColors.devDependency} />
            </marker>
          </defs>

          {/* Grid background */}
          <rect
            className="graph-bg"
            x={viewBox.x - 500}
            y={viewBox.y - 500}
            width={viewBox.width + 1000}
            height={viewBox.height + 1000}
            fill="url(#grid)"
          />

          {/* Edges — opacity on <g> so stroke AND marker-end arrows dim together (markers ignore path strokeOpacity). */}
          <g className="edges">
            {edges.map((edge) => {
              const isConnected = connectedEdges.has(edge.id);
              const hasSelection = selectedNode || hoveredNode;
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
                  className={isDragging ? "" : "transition-opacity duration-200"}
                >
                  <path
                    d={getEdgePath(edge)}
                    fill="none"
                    stroke={edgeColors[edge.type]}
                    strokeWidth={1}
                    strokeDasharray={
                      edge.type === "devDependency" ? "6 4" : "none"
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
              const hasSelection = selectedNode || hoveredNode;
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

            {selectedNodeData ? (
              <aside className="absolute inset-y-0 right-0 z-20 flex w-80 flex-col overflow-hidden border-l border-border bg-card shadow-lg">
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Details
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
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
                      <div className="text-xs text-muted-foreground">Dependents</div>
                    </div>
                  </div>

                  {(selectedEdgeLists.outgoing.length > 0 ||
                    selectedEdgeLists.incoming.length > 0) && (
                    <div className="mt-6 space-y-5 border-t border-border pt-6">
                      {selectedEdgeLists.outgoing.length > 0 ? (
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Depends on
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
                                  {e.type === "devDependency" ? "dev" : "prod"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {selectedEdgeLists.incoming.length > 0 ? (
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Depended on by
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
                                  {e.type === "devDependency" ? "dev" : "prod"}
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
                    {type === "app" ? "Application" : "Package"}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-6">
              <span className="text-xs font-medium text-muted-foreground">
                Edges
              </span>
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
            </div>
          </div>
      </div>
    </div>
  );
}
