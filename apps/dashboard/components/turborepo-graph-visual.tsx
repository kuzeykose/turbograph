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
  MousePointer2,
  Move,
  Box,
  Boxes,
} from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib/utils";
import {
  type PackageInfo,
  type DependencyEdge,
  type GraphNode,
  type GraphEdge,
  calculateGraphLayout,
  nodeColors,
  edgeColors,
} from "@workspace/graph";

// Extended node type for React state (includes velocity for force simulation)
interface Node extends GraphNode {
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
}

type Edge = GraphEdge;

interface TurborepoGraphVisualProps {
  apps: PackageInfo[];
  packages: PackageInfo[];
  dependencies: DependencyEdge[];
  className?: string;
}

// Node type icons
const NodeIcon = ({ type }: { type: Node["type"] }) => {
  const iconProps = { size: 14, strokeWidth: 2 };
  switch (type) {
    case "app":
      return <Box {...iconProps} />;
    case "package":
      return <Boxes {...iconProps} />;
  }
};

export function TurborepoGraphVisual({
  apps,
  packages,
  dependencies,
  className,
}: TurborepoGraphVisualProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Initialize nodes and edges with hierarchical layout
  useEffect(() => {
    // Use shared layout calculation from @workspace/graph
    const { nodes: layoutNodes, edges: layoutEdges } = calculateGraphLayout(
      apps,
      packages,
      dependencies,
      { width: 900, height: 550, padding: 80 }
    );

    // Extend graph nodes with velocity properties for force simulation
    const newNodes: Node[] = layoutNodes.map((node) => ({
      ...node,
      vx: 0,
      vy: 0,
    }));

    setNodes(newNodes);
    setEdges(layoutEdges);
  }, [apps, packages, dependencies]);

  // Apply force simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    const animate = () => {
      setNodes((prevNodes) => {
        return prevNodes.map((node) => {
          if (node.fx !== undefined && node.fy !== undefined) {
            return { ...node, x: node.fx, y: node.fy };
          }

          let fx = 0;
          let fy = 0;

          prevNodes.forEach((other) => {
            if (other.id !== node.id) {
              const dx = node.x - other.x;
              const dy = node.y - other.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              const sameLayer = Math.abs(dx) < 100;
              const repulsionDistance = sameLayer ? 150 : 100;

              if (distance < repulsionDistance && distance > 0) {
                const force = (sameLayer ? 400 : 100) / (distance * distance);
                fx += (dx / distance) * force * 0.1;
                fy += (dy / distance) * force;
              }
            }
          });

          const fixedHeight = 550;
          fy += (fixedHeight / 2 - node.y) * 0.002;

          const damping = 0.7;
          const newVx = (node.vx + fx) * damping;
          const newVy = (node.vy + fy) * damping;

          const fixedWidth = 900;
          const newX = Math.max(
            50,
            Math.min(fixedWidth - 50, node.x + newVx * 0.3),
          );
          const newY = Math.max(50, Math.min(fixedHeight - 50, node.y + newVy));

          return { ...node, x: newX, y: newY, vx: newVx, vy: newVy };
        });
      });
    };

    // const interval = setInterval(animate, 50);
    // const timeout = setTimeout(() => clearInterval(interval), 2000);

    return () => {
      // clearInterval(interval);
      // clearTimeout(timeout);
    };
  }, [edges]);

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
        setIsPanning(true);
        setPanStart(getSvgPoint(e.clientX, e.clientY));
        setSelectedNode(null);
      }
    },
    [getSvgPoint],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const current = getSvgPoint(e.clientX, e.clientY);
        setViewBox((prev) => ({
          ...prev,
          x: prev.x + (panStart.x - current.x),
          y: prev.y + (panStart.y - current.y),
        }));
      } else if (draggedNode) {
        const point = getSvgPoint(e.clientX, e.clientY);
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
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === draggedNode
            ? { ...node, fx: undefined, fy: undefined }
            : node,
        ),
      );
    }
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
        setDragOffset({ x: point.x - node.x, y: point.y - node.y });
        setDraggedNode(nodeId);
      }
    },
    [getSvgPoint, nodes],
  );

  const handleNodeClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
    if (nodes.length === 0 || !svgRef.current) return;

    const padding = 80;
    const nodeRadius = 36;

    // Calculate bounding box of all nodes
    const minX = Math.min(...nodes.map((n) => n.x)) - nodeRadius - padding;
    const maxX = Math.max(...nodes.map((n) => n.x)) + nodeRadius + padding;
    const minY = Math.min(...nodes.map((n) => n.y)) - nodeRadius - padding;
    const maxY = Math.max(...nodes.map((n) => n.y)) + nodeRadius + padding;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Get the SVG container dimensions
    const rect = svgRef.current.getBoundingClientRect();
    const containerWidth = rect.width || 900;
    const containerHeight = rect.height || 550;

    // Calculate scale to fit content while maintaining aspect ratio
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

    // Calculate the viewBox dimensions
    const viewWidth = containerWidth / scale;
    const viewHeight = containerHeight / scale;

    // Center the content
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const finalX = centerX - viewWidth / 2;
    const finalY = centerY - viewHeight / 2;

    setViewBox({
      x: finalX,
      y: finalY,
      width: viewWidth,
      height: viewHeight,
    });
    setZoom(scale);
  }, [nodes]);

  const hasFittedRef = useRef(false);
  useEffect(() => {
    if (nodes.length > 0 && !hasFittedRef.current) {
      hasFittedRef.current = true;
      fitView();
    }
  }, [nodes, fitView]);

  // Calculate edge path with curve
  const getEdgePath = useCallback(
    (edge: Edge) => {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);
      if (!source || !target) return "";

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist === 0) return "";

      const nodeRadius = 36;
      const sourceX = source.x + (dx / dist) * nodeRadius;
      const sourceY = source.y + (dy / dist) * nodeRadius;
      const targetX = target.x - (dx / dist) * (nodeRadius + 8);
      const targetY = target.y - (dy / dist) * (nodeRadius + 8);

      const midX = (sourceX + targetX) / 2;
      const midY = (sourceY + targetY) / 2;
      const offset = dist * 0.1;
      const perpX = -dy / dist;
      const perpY = dx / dist;

      return `M ${sourceX} ${sourceY} Q ${midX + perpX * offset} ${midY + perpY * offset} ${targetX} ${targetY}`;
    },
    [nodes],
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

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex flex-col overflow-hidden h-full",
        className,
        isFullscreen && "h-screen w-screen rounded-none",
      )}
    >
      {/* Header with controls */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            Dependency Graph
          </h3>
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
          <div className="mx-2 h-4 w-px bg-border" />
          <span className="text-xs text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Graph canvas */}
      <div className="relative flex-1">
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          className={cn(
            "w-full h-full",
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
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColors.dependency} />
            </marker>
            <marker
              id="arrow-devDependency"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColors.devDependency} />
            </marker>
            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
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

          {/* Edges */}
          <g className="edges">
            {edges.map((edge) => {
              const isConnected = connectedEdges.has(edge.id);
              const hasSelection = selectedNode || hoveredNode;
              const isDragging = !!draggedNode;
              return (
                <path
                  key={edge.id}
                  d={getEdgePath(edge)}
                  fill="none"
                  stroke={edgeColors[edge.type]}
                  strokeWidth={isConnected ? 2.5 : 1.5}
                  strokeOpacity={hasSelection ? (isConnected ? 1 : 0.15) : 0.6}
                  strokeDasharray={
                    edge.type === "devDependency" ? "6 4" : "none"
                  }
                  markerEnd={`url(#arrow-${edge.type})`}
                  className={isDragging ? "" : "transition-all duration-200"}
                />
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

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                  onClick={(e) => handleNodeClick(node.id, e)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer"
                  style={{
                    opacity: hasSelection && !isConnected ? 0.25 : 1,
                    transition: "opacity 0.2s ease",
                  }}
                  filter={isSelected || isHovered ? "url(#glow)" : undefined}
                >
                  {/* Node circle */}
                  <circle
                    r={isSelected ? 40 : isHovered ? 38 : 36}
                    fill={colors.fill}
                    stroke={isSelected ? "oklch(0.95 0 0)" : colors.stroke}
                    strokeWidth={isSelected ? 3 : 2}
                    className="transition-all duration-150"
                  />

                  {/* Inner ring */}
                  <circle
                    r={28}
                    fill="none"
                    stroke="oklch(0.95 0 0 / 0.15)"
                    strokeWidth={1}
                  />

                  {/* Icon */}
                  <foreignObject
                    x={-7}
                    y={-18}
                    width={14}
                    height={14}
                    className="pointer-events-none"
                  >
                    <div className="flex h-full items-center justify-center text-foreground/90">
                      <NodeIcon type={node.type} />
                    </div>
                  </foreignObject>

                  {/* Label */}
                  <text
                    textAnchor="middle"
                    y={4}
                    fill="oklch(0.95 0 0)"
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="system-ui, sans-serif"
                    className="pointer-events-none select-none"
                  >
                    {node.name.split("/").pop()?.substring(0, 12) ||
                      node.name.substring(0, 12)}
                  </text>

                  {/* Stats */}
                  <text
                    textAnchor="middle"
                    y={17}
                    fill="oklch(0.95 0 0 / 0.6)"
                    fontSize="8"
                    fontFamily="system-ui, sans-serif"
                    className="pointer-events-none select-none"
                  >
                    {node.dependencies}d / {node.dependents}r
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Instructions overlay */}
        <div className="absolute bottom-4 left-4 flex items-center gap-4 rounded-lg border border-border bg-card/90 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
          <div className="flex items-center gap-1.5">
            <MousePointer2 size={12} />
            <span>Click to select</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Move size={12} />
            <span>Drag to move</span>
          </div>
          <div className="h-3 w-px bg-border" />
          <span>Scroll to zoom</span>
        </div>

        {/* Selected node details */}
        {selectedNodeData && (
          <div className="absolute right-4 top-4 w-64 rounded-lg border border-border bg-card p-4 shadow-lg">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: nodeColors[selectedNodeData.type].fill,
                    }}
                  >
                    <NodeIcon type={selectedNodeData.type} />
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {selectedNodeData.name.split("/").pop()}
                  </span>
                </div>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {selectedNodeData.name}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-secondary p-2">
                <div className="text-lg font-semibold text-foreground">
                  {selectedNodeData.dependencies}
                </div>
                <div className="text-xs text-muted-foreground">
                  Dependencies
                </div>
              </div>
              <div className="rounded-md bg-secondary p-2">
                <div className="text-lg font-semibold text-foreground">
                  {selectedNodeData.dependents}
                </div>
                <div className="text-xs text-muted-foreground">Dependents</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                style={{
                  backgroundColor: `color-mix(in oklch, ${nodeColors[selectedNodeData.type].fill}, transparent 80%)`,
                  color: nodeColors[selectedNodeData.type].fill,
                }}
              >
                {selectedNodeData.type}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between border-t border-border bg-card px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-xs font-medium text-muted-foreground">
            Nodes
          </span>
          {(["app", "package"] as const).map((type) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{ backgroundColor: nodeColors[type].fill }}
              >
                <NodeIcon type={type} />
              </div>
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
            <span className="text-xs text-muted-foreground">Dependency</span>
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
  );
}
