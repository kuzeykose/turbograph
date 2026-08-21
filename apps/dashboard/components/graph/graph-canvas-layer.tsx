"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@workspace/ui/lib/utils";
import {
  computeEdgeEndpoints,
  edgeColors,
  edgeColorsHex,
  nodeColors,
  nodeColorsHex,
  GRAPH_NODE_CARD,
  type DependencyEdgeType,
  type GraphEdge,
  type GraphNode,
} from "@workspace/graph";
import { formatNodeLabel, formatNodeSubline } from "./node-label";
import {
  SUBLABEL_MIN_SCALE,
  fitLabel,
  labelBaselines,
  labelFontPx,
  labelRoom,
  sublabelFontPx,
} from "./label-placement";
import type { GraphViewportApi } from "./use-graph-viewport";
/** Arrowheads are sub-pixel below this and only cost fill time. */
const ARROW_MIN_SCALE = 0.35;
/**
 * Dash segments a single edge batch may cost before it is stroked solid.
 *
 * Canvas charges for dashing per segment over the whole path, off-screen length
 * included, so a file-to-file import graph — thousands of long edges under a
 * 5px pattern — reaches millions of segments and freezes the tab for seconds a
 * frame. At that density the pattern is unreadable anyway; the legend is what
 * tells the two edge kinds apart.
 */
const DASH_SEGMENT_BUDGET = 50000;
const ARROW_LENGTH = 9;
const ARROW_HALF_WIDTH = 4;

const EDGE_TYPES: DependencyEdgeType[] = [
  "dependency",
  "devDependency",
  "import",
];

const EDGE_DASH: Record<DependencyEdgeType, number[]> = {
  dependency: [],
  devDependency: [6, 4],
  import: [2, 3],
};

const LABEL_COLOR = "oklch(0.97 0 0)";
const LABEL_COLOR_HEX = "#f7f7f7";
const SUBLABEL_COLOR = "oklch(0.72 0 0)";
const SUBLABEL_COLOR_HEX = "#b3b3b3";
const SELECTED_STROKE = "oklch(0.96 0 0 / 0.85)";
const SELECTED_STROKE_HEX = "rgba(245,245,245,0.85)";
const HOVER_STROKE = "oklch(0.96 0 0 / 0.35)";
const HOVER_STROKE_HEX = "rgba(245,245,245,0.35)";

const DIM_ALPHA = 0.08;
const BASE_EDGE_ALPHA = 0.6;

/** Distance in graph units a pointer may move before a click counts as a drag. */
const DRAG_THRESHOLD_SQ = 36;

interface CanvasNode extends GraphNode {
  fx?: number;
  fy?: number;
}

/** Edge with its endpoints already clipped to both node cards. */
interface EdgeGeometry {
  id: string;
  type: DependencyEdgeType;
  source: string;
  target: string;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

export interface GraphCanvasLayerProps {
  nodes: CanvasNode[];
  edges: GraphEdge[];
  nodeById: Map<string, CanvasNode>;
  selectedNode: string | null;
  /**
   * Whether nodes away from the active one fade back. A focused graph already
   * holds nothing but the selection's tree, so there is nothing to fade.
   */
  dimUnrelated?: boolean;
  onSelectNode: (id: string | null) => void;
  onNodeMoved: (id: string, x: number, y: number) => void;
  viewport: GraphViewportApi;
  /** Registers this layer's paint function; returns its unregister. */
  registerRender: (render: () => void) => () => void;
  className?: string;
}

/**
 * Canvas renderer for graphs too large to express as live DOM.
 *
 * A file-to-file import graph reaches ~1500 nodes and several thousand edges,
 * which as SVG is roughly 17,500 elements that the browser must re-layout on
 * every hover, pan and drag. Here the whole graph is a single element: hover and
 * pan mutate refs and repaint inside one animation frame, and only selection —
 * which the details panel needs — is lifted into React state.
 */
export function GraphCanvasLayer({
  nodes,
  edges,
  nodeById,
  selectedNode,
  dimUnrelated = true,
  onSelectNode,
  onNodeMoved,
  viewport,
  registerRender,
  className,
}: GraphCanvasLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const paletteRef = useRef<ReturnType<typeof buildPalette> | null>(null);

  const panningRef = useRef(false);
  const draggedRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const pointerDownRef = useRef<{
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);

  /**
   * Edge endpoints are derived once per layout. Resolving them per frame was the
   * single most expensive thing the SVG renderer did.
   */
  const edgeGeometry = useMemo<EdgeGeometry[]>(() => {
    const opts = {
      halfWidth: GRAPH_NODE_CARD.halfWidth,
      halfHeight: GRAPH_NODE_CARD.halfHeight,
    };
    const result: EdgeGeometry[] = [];
    for (const edge of edges) {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) continue;
      const ends = computeEdgeEndpoints(source, target, opts);
      if (!ends) continue;
      result.push({
        id: edge.id,
        type: edge.type,
        source: edge.source,
        target: edge.target,
        ...ends,
      });
    }
    return result;
  }, [edges, nodeById]);

  /** Neighbour sets for the highlight/dim pass, built once instead of per frame. */
  const neighbours = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of edges) {
      let from = map.get(edge.source);
      if (!from) map.set(edge.source, (from = new Set()));
      from.add(edge.target);
      let to = map.get(edge.target);
      if (!to) map.set(edge.target, (to = new Set()));
      to.add(edge.source);
    }
    return map;
  }, [edges]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!paletteRef.current) paletteRef.current = buildPalette(ctx);
    const palette = paletteRef.current;

    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (cssWidth === 0 || cssHeight === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(cssWidth * dpr);
    const pixelHeight = Math.round(cssHeight * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const view = viewport.viewportRef.current;
    const scaleX = cssWidth / view.width;
    const scaleY = cssHeight / view.height;

    // Cleared rather than filled: the themed surface behind the canvas is the
    // background, so the graph follows light and dark without a palette entry.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(
      scaleX * dpr,
      0,
      0,
      scaleY * dpr,
      -view.x * scaleX * dpr,
      -view.y * scaleY * dpr,
    );

    const scale = scaleX;
    const drag = draggedRef.current;
    const activeId = dimUnrelated ? (selectedNode ?? hoveredRef.current) : null;
    const connected = activeId ? neighbours.get(activeId) : undefined;

    const positionOf = (node: CanvasNode) =>
      drag && drag.id === node.id ? { x: drag.x, y: drag.y } : node;

    // Visible window in graph coordinates, padded by one card so partially
    // visible nodes and their edges still paint.
    const minX = view.x - GRAPH_NODE_CARD.width;
    const maxX = view.x + view.width + GRAPH_NODE_CARD.width;
    const minY = view.y - GRAPH_NODE_CARD.height;
    const maxY = view.y + view.height + GRAPH_NODE_CARD.height;

    drawEdges(ctx, {
      edgeGeometry,
      nodeById,
      drag,
      palette,
      scale,
      activeId,
      minX,
      maxX,
      minY,
      maxY,
    });

    // Nodes
    const hw = GRAPH_NODE_CARD.halfWidth;
    const hh = GRAPH_NODE_CARD.halfHeight;

    for (const node of nodes) {
      const pos = positionOf(node);
      if (
        pos.x + hw < minX ||
        pos.x - hw > maxX ||
        pos.y + hh < minY ||
        pos.y - hh > maxY
      ) {
        continue;
      }

      const isActive = activeId === node.id;
      const isConnected = isActive || (connected?.has(node.id) ?? false);
      const dimmed = activeId !== null && !isConnected;

      ctx.globalAlpha = dimmed ? DIM_ALPHA : 1;

      const colors = palette.node[node.type];
      ctx.fillStyle = colors.fill;
      roundRectPath(
        ctx,
        pos.x - hw,
        pos.y - hh,
        GRAPH_NODE_CARD.width,
        GRAPH_NODE_CARD.height,
        GRAPH_NODE_CARD.rx,
      );
      ctx.fill();

      ctx.lineWidth = (selectedNode === node.id ? 1.5 : 1) / scale;
      ctx.strokeStyle =
        selectedNode === node.id
          ? palette.selectedStroke
          : hoveredRef.current === node.id
            ? palette.hoverStroke
            : colors.stroke;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // --- labels, in screen space ---------------------------------------------
    // Drawn after the transform is dropped, so a name keeps a readable size at
    // any zoom instead of shrinking with the card it belongs to.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    const fontPx = labelFontPx(scale);
    const subFontPx = sublabelFontPx(scale);
    const nameFont = `600 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
    const sublabelFont = `400 ${subFontPx}px ui-monospace, SFMono-Regular, monospace`;
    const room = labelRoom(scale, GRAPH_NODE_CARD.width);
    const showSublabels = scale >= SUBLABEL_MIN_SCALE;
    const baseline = labelBaselines(fontPx, showSublabels);

    for (const node of nodes) {
      const pos = positionOf(node);
      const screenX = (pos.x - view.x) * scaleX;
      const screenY = (pos.y - view.y) * scaleY;
      // A name whose node is off screen has nothing to name, but one whose
      // node is just past the edge still shows, so the margin is a card wide.
      if (
        screenX < -hw ||
        screenX > cssWidth + hw ||
        screenY < -hh ||
        screenY > cssHeight + hh
      ) {
        continue;
      }

      const isActive = activeId === node.id;
      const dimmed =
        activeId !== null && !(isActive || (connected?.has(node.id) ?? false));
      ctx.globalAlpha = dimmed ? DIM_ALPHA * 2 : 1;

      const { primary, secondary } = formatNodeLabel(node.name);
      const name = fitLabel(primary, fontPx, room);
      if (!name) continue;

      ctx.font = nameFont;
      ctx.fillStyle = palette.label;
      ctx.fillText(name, screenX, screenY + baseline.name, room);

      // The subline is card detail; there is only a card to put it on once the
      // graph is close enough for the card to be more than a mark. It is cut
      // to the card the same way the name is.
      if (showSublabels) {
        const subline = fitLabel(
          formatNodeSubline(secondary, node.dependencies, node.dependents),
          subFontPx,
          room,
        );
        if (subline) {
          ctx.font = sublabelFont;
          ctx.fillStyle = palette.sublabel;
          ctx.fillText(subline, screenX, screenY + baseline.subline, room);
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [
    dimUnrelated,
    edgeGeometry,
    neighbours,
    nodes,
    nodeById,
    selectedNode,
    viewport,
  ]);

  // Publish the paint function so viewport changes can drive it without React.
  useEffect(() => registerRender(draw), [draw, registerRender]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const hitTest = useCallback(
    (clientX: number, clientY: number): CanvasNode | null => {
      const point = viewport.toGraphPoint(clientX, clientY);
      const hw = GRAPH_NODE_CARD.halfWidth;
      const hh = GRAPH_NODE_CARD.halfHeight;
      // Reverse order so the topmost drawn card wins, matching SVG paint order.
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i]!;
        const drag = draggedRef.current;
        const x = drag && drag.id === node.id ? drag.x : node.x;
        const y = drag && drag.id === node.id ? drag.y : node.y;
        if (
          point.x >= x - hw &&
          point.x <= x + hw &&
          point.y >= y - hh &&
          point.y <= y + hh
        ) {
          return node;
        }
      }
      return null;
    },
    [nodes, viewport],
  );

  /**
   * Set imperatively rather than through state: the parent's `cursor-grab` class
   * is the resting style, and a pointer event must not cost a React render.
   */
  const setCursor = useCallback((cursor: string) => {
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = cursor;
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const hit = hitTest(e.clientX, e.clientY);
      pointerDownRef.current = { x: e.clientX, y: e.clientY, moved: false };

      if (hit) {
        const point = viewport.toGraphPoint(e.clientX, e.clientY);
        draggedRef.current = {
          id: hit.id,
          offsetX: point.x - hit.x,
          offsetY: point.y - hit.y,
          x: hit.x,
          y: hit.y,
          moved: false,
        };
        setCursor("move");
      } else {
        panningRef.current = true;
        viewport.beginPan(e.clientX, e.clientY);
        setCursor("grabbing");
      }
    },
    [hitTest, setCursor, viewport],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const down = pointerDownRef.current;
      if (down) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (dx * dx + dy * dy > DRAG_THRESHOLD_SQ) down.moved = true;
      }

      const drag = draggedRef.current;
      if (drag) {
        const point = viewport.toGraphPoint(e.clientX, e.clientY);
        drag.x = point.x - drag.offsetX;
        drag.y = point.y - drag.offsetY;
        drag.moved = down?.moved ?? false;
        viewport.requestRender();
        return;
      }

      if (panningRef.current) {
        viewport.panTo(e.clientX, e.clientY);
        return;
      }

      const hit = hitTest(e.clientX, e.clientY);
      const nextHover = hit?.id ?? null;
      if (nextHover !== hoveredRef.current) {
        hoveredRef.current = nextHover;
        viewport.requestRender();
      }
    },
    [hitTest, viewport],
  );

  const endInteraction = useCallback(() => {
    const drag = draggedRef.current;
    const down = pointerDownRef.current;

    if (drag) {
      if (drag.moved) {
        onNodeMoved(drag.id, drag.x, drag.y);
      } else {
        onSelectNode(drag.id === selectedNode ? null : drag.id);
      }
    } else if (panningRef.current && down && !down.moved) {
      onSelectNode(null);
    }

    draggedRef.current = null;
    panningRef.current = false;
    pointerDownRef.current = null;
    setCursor("");
    viewport.requestRender();
  }, [onNodeMoved, onSelectNode, selectedNode, setCursor, viewport]);

  const handleMouseLeave = useCallback(() => {
    if (hoveredRef.current !== null) hoveredRef.current = null;
    endInteraction();
  }, [endInteraction]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const point = viewport.toGraphPoint(e.clientX, e.clientY);
      viewport.zoomBy(e.deltaY, point.x, point.y);
    },
    [viewport],
  );

  return (
    <canvas
      ref={canvasRef}
      // `select-none`: a drag that starts here must not begin a text selection
      // across the toolbar and legend around the graph.
      className={cn("absolute inset-0 h-full w-full select-none", className)}
      aria-label={`Dependency graph with ${nodes.length} nodes`}
      role="img"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endInteraction}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    />
  );
}

type Palette = {
  label: string;
  sublabel: string;
  selectedStroke: string;
  hoverStroke: string;
  node: Record<"app" | "package", { fill: string; stroke: string }>;
  edge: Record<DependencyEdgeType, string>;
};

/**
 * Canvas has no CSS fallback chain, so pick the oklch palette only when the
 * context actually parses it and drop to the hex set otherwise.
 */
function buildPalette(ctx: CanvasRenderingContext2D): Palette {
  const previous = ctx.fillStyle;
  ctx.fillStyle = "#000000";
  ctx.fillStyle = "oklch(0.62 0.14 330)";
  const supportsOklch = ctx.fillStyle !== "#000000";
  ctx.fillStyle = previous;

  return supportsOklch
    ? {
        label: LABEL_COLOR,
        sublabel: SUBLABEL_COLOR,
        selectedStroke: SELECTED_STROKE,
        hoverStroke: HOVER_STROKE,
        node: nodeColors,
        edge: edgeColors,
      }
    : {
        label: LABEL_COLOR_HEX,
        sublabel: SUBLABEL_COLOR_HEX,
        selectedStroke: SELECTED_STROKE_HEX,
        hoverStroke: HOVER_STROKE_HEX,
        node: nodeColorsHex,
        edge: edgeColorsHex,
      };
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
}

/** Reused so clipping several thousand edges a frame allocates nothing. */
const clippedSegment = new Float64Array(4);

/**
 * Liang-Barsky clip of an edge against the padded view rect, into
 * `clippedSegment`. Returns false when the edge misses the view entirely.
 *
 * Canvas charges for the whole path it is handed, off-screen length included,
 * and dashing charges per segment over that length — so a long edge that merely
 * crosses the viewport costs far more than the few pixels of it on screen.
 */
function clipToView(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  const dx = tx - sx;
  const dy = ty - sy;
  let enter = 0;
  let exit = 1;

  for (let side = 0; side < 4; side++) {
    const p = side === 0 ? -dx : side === 1 ? dx : side === 2 ? -dy : dy;
    const q =
      side === 0
        ? sx - minX
        : side === 1
          ? maxX - sx
          : side === 2
            ? sy - minY
            : maxY - sy;

    if (p === 0) {
      // Parallel to this side: either wholly inside it or wholly outside.
      if (q < 0) return false;
      continue;
    }

    const t = q / p;
    if (p < 0) {
      if (t > exit) return false;
      if (t > enter) enter = t;
    } else {
      if (t < enter) return false;
      if (t < exit) exit = t;
    }
  }

  clippedSegment[0] = sx + enter * dx;
  clippedSegment[1] = sy + enter * dy;
  clippedSegment[2] = sx + exit * dx;
  clippedSegment[3] = sy + exit * dy;
  return true;
}

interface DrawEdgesContext {
  edgeGeometry: EdgeGeometry[];
  nodeById: Map<string, CanvasNode>;
  drag: { id: string; x: number; y: number } | null;
  palette: Palette;
  scale: number;
  activeId: string | null;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Edges are stroked in at most six batches (three types x highlighted/dimmed)
 * rather than one path per edge, so style changes cost six state transitions a
 * frame instead of several thousand.
 */
function drawEdges(ctx: CanvasRenderingContext2D, o: DrawEdgesContext) {
  const { palette, scale, activeId, minX, maxX, minY, maxY } = o;
  const drawArrows = scale >= ARROW_MIN_SCALE;
  const opts = {
    halfWidth: GRAPH_NODE_CARD.halfWidth,
    halfHeight: GRAPH_NODE_CARD.halfHeight,
  };

  for (const type of EDGE_TYPES) {
    const dash = EDGE_DASH[type];
    const dashPeriod = dash.reduce((total, segment) => total + segment, 0);

    for (const highlighted of activeId ? [false, true] : [true]) {
      let started = false;
      const arrows: number[] = [];
      /** Length of this batch, in graph units, only tracked when it is dashed. */
      let pathLength = 0;

      for (const edge of o.edgeGeometry) {
        if (edge.type !== type) continue;

        const touchesActive =
          activeId !== null &&
          (edge.source === activeId || edge.target === activeId);
        if (activeId !== null && touchesActive !== highlighted) continue;

        let { sx, sy, tx, ty } = edge;
        // A dragged node invalidates the cached endpoints of its own edges only.
        if (
          o.drag &&
          (edge.source === o.drag.id || edge.target === o.drag.id)
        ) {
          const source =
            edge.source === o.drag.id ? o.drag : o.nodeById.get(edge.source);
          const target =
            edge.target === o.drag.id ? o.drag : o.nodeById.get(edge.target);
          if (!source || !target) continue;
          const ends = computeEdgeEndpoints(source, target, opts);
          if (!ends) continue;
          ({ sx, sy, tx, ty } = ends);
        }

        if (!clipToView(sx, sy, tx, ty, minX, minY, maxX, maxY)) continue;

        const cx0 = clippedSegment[0]!;
        const cy0 = clippedSegment[1]!;
        const cx1 = clippedSegment[2]!;
        const cy1 = clippedSegment[3]!;

        if (!started) {
          ctx.beginPath();
          started = true;
        }
        ctx.moveTo(cx0, cy0);
        ctx.lineTo(cx1, cy1);
        if (dashPeriod > 0) pathLength += Math.hypot(cx1 - cx0, cy1 - cy0);
        // The head sits at the true target, so it only earns its fill time when
        // that end is on screen.
        if (
          drawArrows &&
          tx >= minX &&
          tx <= maxX &&
          ty >= minY &&
          ty <= maxY
        ) {
          arrows.push(sx, sy, tx, ty);
        }
      }

      if (!started) continue;

      ctx.globalAlpha =
        activeId === null ? BASE_EDGE_ALPHA : highlighted ? 1 : DIM_ALPHA / 2;
      ctx.strokeStyle = palette.edge[type];
      ctx.lineWidth = 1 / scale;
      // `pathLength` is in graph units and the pattern is sized in screen px, so
      // this is the number of dashes the rasterizer would have to generate.
      const affordable =
        dashPeriod > 0 &&
        (pathLength * scale) / dashPeriod <= DASH_SEGMENT_BUDGET;
      if (affordable) {
        ctx.setLineDash(dash.map((segment) => segment / scale));
      }
      ctx.stroke();
      if (affordable) ctx.setLineDash([]);

      if (!drawArrows) continue;

      ctx.fillStyle = palette.edge[type];
      ctx.beginPath();
      for (let i = 0; i < arrows.length; i += 4) {
        addArrowHead(
          ctx,
          arrows[i]!,
          arrows[i + 1]!,
          arrows[i + 2]!,
          arrows[i + 3]!,
          scale,
        );
      }
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

/** Filled triangle at the target end, sized in screen pixels via `scale`. */
function addArrowHead(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  scale: number,
) {
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return;

  const ux = dx / dist;
  const uy = dy / dist;
  const length = ARROW_LENGTH / scale;
  const half = ARROW_HALF_WIDTH / scale;

  const baseX = tx - ux * length;
  const baseY = ty - uy * length;

  ctx.moveTo(tx, ty);
  ctx.lineTo(baseX - uy * half, baseY + ux * half);
  ctx.lineTo(baseX + uy * half, baseY - ux * half);
  ctx.closePath();
}
