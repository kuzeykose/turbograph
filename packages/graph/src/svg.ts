import type { GraphNode, GraphEdge } from "./types";
import { nodeColorsHex, edgeColorsHex } from "./colors";
import { GRAPH_NODE_CARD } from "./constants";

const DEFAULT_NODE_RADIUS = 36;
/** Inset from circle edge for arrow marker clearance (legacy circle routing). */
const ARROW_INSET_CIRCLE = 8;
/**
 * For rectangular nodes, the path end must sit on the card boundary (minus a
 * tiny epsilon for stroke). A large inset was drawing arrowheads deep inside the node.
 */
const BOUNDARY_EPS = 0.75;

/**
 * Options for SVG generation
 */
export interface SvgOptions {
  width?: number;
  height?: number;
  /** @deprecated Prefer halfWidth/halfHeight via generateEdgePath options */
  nodeRadius?: number;
  backgroundColor?: string;
  showGrid?: boolean;
}

/**
 * Edge routing: circle (legacy) or axis-aligned card bounds
 */
export type EdgePathOptions =
  | { nodeRadius: number }
  | { halfWidth: number; halfHeight: number };

function rayExitAABB(
  hw: number,
  hh: number,
  ux: number,
  uy: number
): number {
  let t = Infinity;
  if (ux > 1e-10) t = Math.min(t, hw / ux);
  if (ux < -1e-10) t = Math.min(t, -hw / ux);
  if (uy > 1e-10) t = Math.min(t, hh / uy);
  if (uy < -1e-10) t = Math.min(t, -hh / uy);
  return t;
}

const DEFAULT_RECT_OPTS: EdgePathOptions = {
  halfWidth: GRAPH_NODE_CARD.halfWidth,
  halfHeight: GRAPH_NODE_CARD.halfHeight,
};

/**
 * Generate a curved edge path between two nodes.
 * Uses rectangular card bounds by default (see GRAPH_NODE_CARD); pass `nodeRadius` for circle routing.
 */
export function generateEdgePath(
  source: GraphNode,
  target: GraphNode,
  options?: number | EdgePathOptions
): string {
  const opts: EdgePathOptions =
    typeof options === "number"
      ? { nodeRadius: options }
      : options ?? DEFAULT_RECT_OPTS;

  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 1e-10) return "";

  const ux = dx / dist;
  const uy = dy / dist;

  let sx: number;
  let sy: number;
  let tx: number;
  let ty: number;

  if ("halfWidth" in opts) {
    const hw = opts.halfWidth;
    const hh = opts.halfHeight;
    const ts = rayExitAABB(hw, hh, ux, uy);
    const tt = rayExitAABB(hw, hh, -ux, -uy);
    if (!Number.isFinite(ts) || !Number.isFinite(tt)) {
      return "";
    }
    // Exit source and enter target along the center line; endpoints on the box edges.
    sx = source.x + ux * ts;
    sy = source.y + uy * ts;
    const tEnd = Math.max(0, tt - BOUNDARY_EPS);
    tx = target.x - ux * tEnd;
    ty = target.y - uy * tEnd;
    // Straight segment — quadratic bulges were crossing into node interiors before the end.
    return `M ${sx} ${sy} L ${tx} ${ty}`;
  }

  const r = opts.nodeRadius ?? DEFAULT_NODE_RADIUS;
  sx = source.x + ux * r;
  sy = source.y + uy * r;
  tx = target.x - ux * (r + ARROW_INSET_CIRCLE);
  ty = target.y - uy * (r + ARROW_INSET_CIRCLE);

  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;
  const offset = dist * 0.1;
  const perpX = -dy / dist;
  const perpY = dx / dist;

  return `M ${sx} ${sy} Q ${midX + perpX * offset} ${midY + perpY * offset} ${tx} ${ty}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const halfW = GRAPH_NODE_CARD.halfWidth;
  const halfH = GRAPH_NODE_CARD.halfHeight;
  const rx = GRAPH_NODE_CARD.rx;
  const backgroundColor = options?.backgroundColor ?? "#0a0a0a";
  const showGrid = options?.showGrid ?? true;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const edgeOpts: EdgePathOptions = { halfWidth: halfW, halfHeight: halfH };

  const edgePaths = edges
    .map((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return "";

      const path = generateEdgePath(source, target, edgeOpts);
      const color = edgeColorsHex[edge.type];
      const dashArray =
        edge.type === "devDependency" || edge.type === "import"
          ? 'stroke-dasharray="6 4"'
          : "";

      return `    <path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" ${dashArray} marker-end="url(#arrow-${edge.type})"/>`;
    })
    .filter(Boolean)
    .join("\n");

  const nodeElements = nodes
    .map((node) => {
      const colors = nodeColorsHex[node.type];
      const shortName =
        node.name.split("/").pop() ?? node.name;
      const line1 = escapeXml(
        shortName.length > 26 ? `${shortName.slice(0, 24)}…` : shortName
      );
      let scope = "";
      if (node.name.startsWith("@") && node.name.includes("/")) {
        const idx = node.name.indexOf("/");
        scope = `${node.name.slice(0, idx + 1)}`;
      }
      const meta = `${node.dependencies}d / ${node.dependents}r`;
      const subRaw = [scope, meta].filter(Boolean).join(" · ");
      const line2 = escapeXml(
        subRaw.length > 46 ? `${subRaw.slice(0, 44)}…` : subRaw
      );

      const title = escapeXml(node.name);

      return `    <g transform="translate(${node.x}, ${node.y})">
      <title>${title}</title>
      <rect x="${-halfW}" y="${-halfH}" width="${GRAPH_NODE_CARD.width}" height="${GRAPH_NODE_CARD.height}" rx="${rx}" ry="${rx}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1"/>
      <text text-anchor="middle" x="0" y="-2" fill="#f5f5f5" font-size="12" font-weight="600" font-family="ui-sans-serif, system-ui, sans-serif">${line1}</text>
      <text text-anchor="middle" x="0" y="11" fill="#a3a3a3" font-size="9.5" font-family="ui-sans-serif, system-ui, sans-serif">${line2}</text>
    </g>`;
    })
    .join("\n");

  const gridPattern = showGrid
    ? `    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.1)"/>
    </pattern>
    <rect width="100%" height="100%" fill="url(#grid)"/>`
    : "";

  const legend = `    <g transform="translate(20, ${height - 50})">
      <rect x="0" y="0" width="220" height="40" rx="4" fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.2)"/>
      <rect x="12" y="12" width="16" height="16" rx="3" fill="${nodeColorsHex.app.fill}"/>
      <text x="34" y="24" fill="white" font-size="10" font-family="system-ui, sans-serif">App</text>
      <rect x="72" y="12" width="16" height="16" rx="3" fill="${nodeColorsHex.package.fill}"/>
      <text x="94" y="24" fill="white" font-size="10" font-family="system-ui, sans-serif">Package</text>
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
    <marker id="arrow-import" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${edgeColorsHex.import}"/>
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
