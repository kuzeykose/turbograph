import type { GraphNode, GraphEdge } from "./types";
import { nodeColorsHex, edgeColorsHex } from "./colors";

const DEFAULT_NODE_RADIUS = 36;

/**
 * Options for SVG generation
 */
export interface SvgOptions {
  width?: number;
  height?: number;
  nodeRadius?: number;
  backgroundColor?: string;
  showGrid?: boolean;
}

/**
 * Generate a curved edge path between two nodes
 */
export function generateEdgePath(
  source: GraphNode,
  target: GraphNode,
  nodeRadius: number = DEFAULT_NODE_RADIUS
): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) return "";

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
}

/**
 * Generate a complete SVG document from graph nodes and edges
 */
export function generateSvgDocument(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options?: SvgOptions
): string {
  const width = options?.width ?? 900;
  const height = options?.height ?? 550;
  const nodeRadius = options?.nodeRadius ?? DEFAULT_NODE_RADIUS;
  const backgroundColor = options?.backgroundColor ?? "#0a0a0a";
  const showGrid = options?.showGrid ?? true;

  // Create a node lookup map
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Generate edge paths
  const edgePaths = edges
    .map((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return "";

      const path = generateEdgePath(source, target, nodeRadius);
      const color = edgeColorsHex[edge.type];
      const dashArray =
        edge.type === "devDependency" ? 'stroke-dasharray="6 4"' : "";

      return `    <path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" ${dashArray} marker-end="url(#arrow-${edge.type})"/>`;
    })
    .filter(Boolean)
    .join("\n");

  // Generate node elements
  const nodeElements = nodes
    .map((node) => {
      const colors = nodeColorsHex[node.type];
      const displayName =
        node.name.split("/").pop()?.substring(0, 12) ??
        node.name.substring(0, 12);
      const icon = node.type === "app" ? "□" : "⊞";

      return `    <g transform="translate(${node.x}, ${node.y})">
      <circle r="${nodeRadius}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>
      <circle r="28" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
      <text text-anchor="middle" y="-8" fill="white" font-size="12" font-family="system-ui, sans-serif">${icon}</text>
      <text text-anchor="middle" y="6" fill="white" font-size="10" font-weight="600" font-family="system-ui, sans-serif">${displayName}</text>
      <text text-anchor="middle" y="18" fill="rgba(255,255,255,0.6)" font-size="8" font-family="system-ui, sans-serif">${node.dependencies}d / ${node.dependents}r</text>
    </g>`;
    })
    .join("\n");

  // Grid pattern
  const gridPattern = showGrid
    ? `    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.1)"/>
    </pattern>
    <rect width="100%" height="100%" fill="url(#grid)"/>`
    : "";

  // Legend
  const legend = `    <g transform="translate(20, ${height - 50})">
      <rect x="0" y="0" width="200" height="40" rx="4" fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.2)"/>
      <circle cx="20" cy="20" r="8" fill="${nodeColorsHex.app.fill}"/>
      <text x="35" y="24" fill="white" font-size="10" font-family="system-ui, sans-serif">App</text>
      <circle cx="80" cy="20" r="8" fill="${nodeColorsHex.package.fill}"/>
      <text x="95" y="24" fill="white" font-size="10" font-family="system-ui, sans-serif">Package</text>
      <line x1="140" y1="20" x2="160" y2="20" stroke="${edgeColorsHex.dependency}" stroke-width="2"/>
      <text x="165" y="24" fill="white" font-size="10" font-family="system-ui, sans-serif">Dep</text>
    </g>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <marker id="arrow-dependency" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${edgeColorsHex.dependency}"/>
    </marker>
    <marker id="arrow-devDependency" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${edgeColorsHex.devDependency}"/>
    </marker>
  </defs>
  
  <rect width="100%" height="100%" fill="${backgroundColor}"/>
${gridPattern}
  
  <g class="edges">
${edgePaths}
  </g>
  
  <g class="nodes">
${nodeElements}
  </g>
  
${legend}
</svg>`;
}
