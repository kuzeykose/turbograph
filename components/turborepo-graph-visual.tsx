'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { DependencyEdge, PackageInfo } from '@/lib/utils/turborepo';

interface Node {
  id: string;
  name: string;
  type: 'app' | 'package';
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
}

interface Edge {
  source: string;
  target: string;
  type: 'dependency' | 'devDependency';
}

interface TurborepoGraphVisualProps {
  apps: PackageInfo[];
  packages: PackageInfo[];
  dependencies: DependencyEdge[];
}

export function TurborepoGraphVisual({ apps, packages, dependencies }: TurborepoGraphVisualProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 0, height: 800 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const initialViewBoxRef = useRef({ width: 0, height: 800 });

  // Initialize viewBox based on actual SVG dimensions
  useLayoutEffect(() => {
    const updateViewBox = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const width = rect.width || 1200;
        const height = 800;
        
        // Only update initialViewBoxRef if it's the first time (width is 0)
        if (initialViewBoxRef.current.width === 0) {
          initialViewBoxRef.current = { width, height };
        }
        
        setViewBox((prev) => {
          // Maintain the same zoom level and pan position
          const scaleX = width / (prev.width || width);
          const scaleY = height / (prev.height || height);
          
          return {
            x: prev.x * scaleX,
            y: prev.y * scaleY,
            width,
            height,
          };
        });
      }
    };

    // Initial update
    updateViewBox();

    // Add resize listener
    window.addEventListener('resize', updateViewBox);

    return () => {
      window.removeEventListener('resize', updateViewBox);
    };
  }, []);

  // Initialize nodes and edges with hierarchical layout
  useEffect(() => {
    const width = 1200;
    const height = 800;
    const padding = 100;

    // Create edges first (needed for depth calculation)
    const newEdges: Edge[] = dependencies.map((dep) => ({
      source: dep.from,
      target: dep.to,
      type: dep.type,
    }));

    // Build adjacency list for dependency graph (reverse direction for depth calc)
    // If A depends on B, then B should be at a lower depth (leftmost)
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
      // dep.from depends on dep.to
      dependsOn.get(dep.from)?.add(dep.to);
      dependedBy.get(dep.to)?.add(dep.from);
    });

    // Calculate depth using BFS from leaf nodes (nodes with no dependencies)
    const nodeDepth = new Map<string, number>();
    const queue: string[] = [];

    // Find leaf nodes (packages/apps that don't depend on anything)
    allNodeIds.forEach((id) => {
      if (dependsOn.get(id)?.size === 0) {
        nodeDepth.set(id, 0);
        queue.push(id);
      }
    });

    // BFS to calculate depths
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDepth = nodeDepth.get(current)!;

      dependedBy.get(current)?.forEach((parent) => {
        const existingDepth = nodeDepth.get(parent);
        const newDepth = currentDepth + 1;

        if (existingDepth === undefined || newDepth > existingDepth) {
          nodeDepth.set(parent, newDepth);
        }

        // Check if all dependencies of parent have been processed
        const parentDeps = dependsOn.get(parent);
        const allDepsProcessed = [...(parentDeps || [])].every((dep) => nodeDepth.has(dep));

        if (allDepsProcessed && !queue.includes(parent)) {
          queue.push(parent);
        }
      });
    }

    // Handle any remaining nodes (cycles or disconnected)
    allNodeIds.forEach((id) => {
      if (!nodeDepth.has(id)) {
        nodeDepth.set(id, 0);
      }
    });

    // Group nodes by depth
    const nodesByDepth = new Map<number, string[]>();
    nodeDepth.forEach((depth, nodeId) => {
      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }
      nodesByDepth.get(depth)!.push(nodeId);
    });

    const maxDepth = Math.max(...nodeDepth.values(), 0);
    const levelWidth = (width - 2 * padding) / Math.max(1, maxDepth);

    // Create nodes with hierarchical positions
    const newNodes: Node[] = [];
    const nodeTypeMap = new Map<string, 'app' | 'package'>();
    apps.forEach((app) => nodeTypeMap.set(app.name, 'app'));
    packages.forEach((pkg) => nodeTypeMap.set(pkg.name, 'package'));

    nodesByDepth.forEach((nodesAtDepth, depth) => {
      const x = padding + depth * levelWidth;
      const verticalSpacing = (height - 2 * padding) / Math.max(1, nodesAtDepth.length);

      nodesAtDepth.forEach((nodeId, index) => {
        const y = padding + verticalSpacing * (index + 0.5);
        newNodes.push({
          id: nodeId,
          name: nodeId,
          type: nodeTypeMap.get(nodeId) || 'package',
          x,
          y,
          vx: 0,
          vy: 0,
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [apps, packages, dependencies]);

  // Apply force simulation (primarily vertical to maintain hierarchical layers)
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

          // Vertical repulsion between nodes (stronger for nodes at same x-level)
          prevNodes.forEach((other) => {
            if (other.id !== node.id) {
              const dx = node.x - other.x;
              const dy = node.y - other.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              // Strong vertical repulsion for nodes at similar x positions (same layer)
              const sameLayer = Math.abs(dx) < 100;
              const repulsionDistance = sameLayer ? 150 : 100;

              if (distance < repulsionDistance && distance > 0) {
                const force = (sameLayer ? 400 : 100) / (distance * distance);
                // Primarily apply vertical force to maintain layers
                fx += (dx / distance) * force * 0.1;
                fy += (dy / distance) * force;
              }
            }
          });

          // Weak vertical centering to keep nodes within view
          const fixedHeight = 800;
          fy += (fixedHeight / 2 - node.y) * 0.002;

          // Apply damping
          const damping = 0.7;
          const newVx = (node.vx + fx) * damping;
          const newVy = (node.vy + fy) * damping;

          // Update position - keep x mostly stable, allow y to adjust
          const fixedWidth = 1200;
          const newX = Math.max(50, Math.min(fixedWidth - 50, node.x + newVx * 0.3));
          const newY = Math.max(50, Math.min(fixedHeight - 50, node.y + newVy));

          return { ...node, x: newX, y: newY, vx: newVx, vy: newVy };
        });
      });
    };

    const interval = setInterval(animate, 50);
    const timeout = setTimeout(() => clearInterval(interval), 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [edges]);

  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedNode(nodeId);
    setSelectedNode(nodeId);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggedNode) {
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;

      const x = viewBox.x + (e.clientX - rect.left) * scaleX;
      const y = viewBox.y + (e.clientY - rect.top) * scaleY;

      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === draggedNode
            ? { ...node, x, y, fx: x, fy: y, vx: 0, vy: 0 }
            : node
        )
      );
    } else if (isPanning) {
      const dx = (e.clientX - panStart.x) * -1;
      const dy = (e.clientY - panStart.y) * -1;
      
      setViewBox((prev) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
      }));
      
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    if (draggedNode) {
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === draggedNode
            ? { ...node, fx: undefined, fy: undefined }
            : node
        )
      );
    }
    setDraggedNode(null);
    setIsPanning(false);
  };

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 0 && !draggedNode) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9;
    
    setViewBox((prev) => ({
      ...prev,
      width: prev.width * scaleFactor,
      height: prev.height * scaleFactor,
    }));
  };

  const resetView = () => {
    setViewBox({ x: 0, y: 0, ...initialViewBoxRef.current });
  };

  const getNodeColor = (type: 'app' | 'package') => {
    return type === 'app' ? '#3b82f6' : '#a855f7';
  };

  const getEdgeColor = (type: 'dependency' | 'devDependency') => {
    return type === 'dependency' ? '#10b981' : '#f59e0b';
  };

  // Get connected nodes for highlighting
  const getConnectedNodes = (nodeId: string): Set<string> => {
    const connected = new Set<string>([nodeId]);
    edges.forEach((edge) => {
      if (edge.source === nodeId) connected.add(edge.target);
      if (edge.target === nodeId) connected.add(edge.source);
    });
    return connected;
  };

  const connectedNodes = selectedNode ? getConnectedNodes(selectedNode) : new Set<string>();

  return (
    <div className="relative">
      {/* Controls */}
      <div className="absolute left-4 top-4 z-10 flex gap-2">
        <button
          onClick={resetView}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          Reset View
        </button>
        <button
          onClick={() => setSelectedNode(null)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          Clear Selection
        </button>
      </div>

      {/* Instructions */}
      <div className="absolute right-4 top-4 z-10 rounded-lg border border-zinc-200 bg-white/90 p-3 text-xs text-zinc-600 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-400">
        <p className="font-semibold">Controls:</p>
        <ul className="mt-1 space-y-0.5">
          <li>• Drag nodes to reposition</li>
          <li>• Click node to highlight connections</li>
          <li>• Drag background to pan</li>
          <li>• Scroll to zoom</li>
        </ul>
      </div>

      {/* Graph */}
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        className="h-[800px] w-full cursor-move rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Define arrow markers */}
        <defs>
          <marker
            id="arrowhead-dependency"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#10b981" />
          </marker>
          <marker
            id="arrowhead-devDependency"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#f59e0b" />
          </marker>
        </defs>

        {/* Draw edges */}
        <g className="edges">
          {edges.map((edge, i) => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);
            
            if (!sourceNode || !targetNode) return null;

            const isHighlighted =
              selectedNode &&
              (edge.source === selectedNode || edge.target === selectedNode);

            return (
              <line
                key={i}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke={getEdgeColor(edge.type)}
                strokeWidth={isHighlighted ? 3 : 2}
                strokeOpacity={selectedNode && !isHighlighted ? 0.2 : 0.6}
                markerEnd={`url(#arrowhead-${edge.type})`}
              />
            );
          })}
        </g>

        {/* Draw nodes */}
        <g className="nodes">
          {nodes.map((node) => {
            const isHighlighted = connectedNodes.has(node.id);
            const isSelected = selectedNode === node.id;
            
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseDown={(e) => handleMouseDown(node.id, e)}
                className="cursor-pointer"
                style={{ opacity: selectedNode && !isHighlighted ? 0.3 : 1 }}
              >
                {/* Node circle */}
                <circle
                  r={isSelected ? 50 : 40}
                  fill={getNodeColor(node.type)}
                  stroke={isSelected ? '#fbbf24' : 'white'}
                  strokeWidth={isSelected ? 4 : 2}
                  className="transition-all duration-200"
                />
                
                {/* Node label */}
                <text
                  textAnchor="middle"
                  dy=".35em"
                  fill="white"
                  fontSize="12"
                  fontWeight="600"
                  className="pointer-events-none select-none"
                >
                  {node.name.length > 15
                    ? node.name.substring(0, 12) + '...'
                    : node.name}
                </text>
                
                {/* Type badge */}
                <text
                  textAnchor="middle"
                  y="55"
                  fill={getNodeColor(node.type)}
                  fontSize="10"
                  fontWeight="600"
                  className="pointer-events-none select-none"
                >
                  {node.type}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h4 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Legend
        </h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-blue-500" />
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              Application
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-purple-500" />
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              Package
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-6 bg-green-500" />
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              Dependency
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-6 bg-orange-500" />
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              Dev Dependency
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
