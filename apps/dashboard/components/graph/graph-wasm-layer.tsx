"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@workspace/ui/lib/utils";
import {
  GRAPH_NODE_CARD,
  type GraphEdge,
  type GraphNode,
} from "@workspace/graph";
import {
  EDGE_TYPE_INDEX,
  GraphWasm,
  NODE_INSTANCE_STRIDE,
  loadGraphWasm,
} from "@/lib/graph-wasm";
import { WebglGraphRenderer, type RendererPalette } from "./webgl-renderer";
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

const DRAG_THRESHOLD_SQ = 36;

const LABEL_COLOR = "#f7f7f7";
const SUBLABEL_COLOR = "#b3b3b3";

const PALETTE: RendererPalette = {
  appFill: [0.298, 0.302, 0.471],
  packageFill: [0.184, 0.435, 0.4],
  appStroke: [0.118, 0.11, 0.216],
  packageStroke: [0.086, 0.216, 0.196],
  selectedStroke: [0.961, 0.961, 0.961],
  hoverStroke: [0.6, 0.6, 0.6],
  edge: [
    [0.486, 0.227, 0.929],
    [0.918, 0.702, 0.031],
    [0.859, 0.153, 0.467],
  ],
};

interface WasmNode extends GraphNode {
  fx?: number;
  fy?: number;
}

export interface GraphWasmLayerProps {
  nodes: WasmNode[];
  edges: GraphEdge[];
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
  /** Called when wasm or WebGL is unavailable, so the caller can fall back. */
  onUnavailable: (reason: string) => void;
  className?: string;
}

/**
 * Graph renderer backed by the Rust module and WebGL2.
 *
 * Per frame, JavaScript does no work proportional to the graph: it hands wasm a
 * viewport, wasm culls and writes vertex data into its own linear memory, and
 * the renderer uploads those views directly. Hover, selection and drag are index
 * arithmetic inside wasm — a drag frame is one `set_node_position` plus one
 * `build_frame`, together well under a tenth of a millisecond at 1500 nodes.
 *
 * Only the labels of nodes currently on screen are drawn, on a 2D canvas layered
 * above the WebGL surface, and only once the zoom makes them legible.
 */
export function GraphWasmLayer({
  nodes,
  edges,
  selectedNode,
  dimUnrelated = true,
  onSelectNode,
  onNodeMoved,
  viewport,
  registerRender,
  onUnavailable,
  className,
}: GraphWasmLayerProps) {
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<WebglGraphRenderer | null>(null);
  const wasmRef = useRef<GraphWasm | null>(null);

  const hoveredRef = useRef(-1);
  const panningRef = useRef(false);
  const dragRef = useRef<{
    index: number;
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

  const [ready, setReady] = useState(false);

  /** Node index is the wasm identity; names stay on this side. */
  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    nodes.forEach((node, i) => map.set(node.id, i));
    return map;
  }, [nodes]);

  const selectedIndex = selectedNode ? (indexById.get(selectedNode) ?? -1) : -1;

  // --- module + renderer lifecycle -----------------------------------------
  useEffect(() => {
    let cancelled = false;

    loadGraphWasm()
      .then((wasm) => {
        if (cancelled) return;
        wasmRef.current = wasm;
        const canvas = glCanvasRef.current;
        if (!canvas) return;
        rendererRef.current = new WebglGraphRenderer(canvas, PALETTE);
        setReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onUnavailable(
          error instanceof Error
            ? error.message
            : "graph module failed to load",
        );
      });

    return () => {
      cancelled = true;
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [onUnavailable]);

  // --- upload the graph whenever the layout changes -------------------------
  useEffect(() => {
    const wasm = wasmRef.current;
    if (!ready || !wasm) return;

    const kinds = new Uint8Array(nodes.length);
    const x = new Float32Array(nodes.length);
    const y = new Float32Array(nodes.length);
    nodes.forEach((node, i) => {
      kinds[i] = node.type === "app" ? 0 : 1;
      x[i] = node.x;
      y[i] = node.y;
    });

    const src = new Uint32Array(edges.length);
    const dst = new Uint32Array(edges.length);
    const types = new Uint8Array(edges.length);
    let kept = 0;
    for (const edge of edges) {
      const s = indexById.get(edge.source);
      const t = indexById.get(edge.target);
      if (s === undefined || t === undefined) continue;
      src[kept] = s;
      dst[kept] = t;
      types[kept] = EDGE_TYPE_INDEX[edge.type] ?? EDGE_TYPE_INDEX.dependency;
      kept++;
    }

    wasm.setGraph(
      kinds,
      src.subarray(0, kept),
      dst.subarray(0, kept),
      types.subarray(0, kept),
    );
    wasm.setPositions(x, y);
    viewport.requestRender();
  }, [ready, nodes, edges, indexById, viewport]);

  // --- painting -------------------------------------------------------------
  const draw = useCallback(() => {
    const wasm = wasmRef.current;
    const renderer = rendererRef.current;
    const glCanvas = glCanvasRef.current;
    const labelCanvas = labelCanvasRef.current;
    if (!wasm || !renderer || !glCanvas || !labelCanvas) return;

    const cssWidth = glCanvas.clientWidth;
    const cssHeight = glCanvas.clientHeight;
    if (cssWidth === 0 || cssHeight === 0) return;

    const dpr = window.devicePixelRatio || 1;
    renderer.resize(Math.round(cssWidth * dpr), Math.round(cssHeight * dpr));

    const view = viewport.viewportRef.current;
    const scale = cssWidth / view.width;

    const drag = dragRef.current;
    if (drag) wasm.setNodePosition(drag.index, drag.x, drag.y);

    const hovered = hoveredRef.current;
    const active = dimUnrelated
      ? selectedIndex >= 0
        ? selectedIndex
        : hovered
      : hovered;
    // Every node on screen is named at every zoom, so wasm always gathers the
    // on-screen set.
    wasm.buildFrame(view, active, selectedIndex, hovered, true);

    renderer.draw({
      view,
      scale,
      edges: [wasm.edgeBucket(0), wasm.edgeBucket(1), wasm.edgeBucket(2)],
      nodeInstances: wasm.nodeInstances(),
      cardHalf: [GRAPH_NODE_CARD.halfWidth, GRAPH_NODE_CARD.halfHeight],
      cardRadius: GRAPH_NODE_CARD.rx,
    });

    // --- label overlay: only what is on screen, only when legible ---
    const labelCtx = labelCanvas.getContext("2d");
    if (!labelCtx) return;
    const pixelWidth = Math.round(cssWidth * dpr);
    const pixelHeight = Math.round(cssHeight * dpr);
    if (
      labelCanvas.width !== pixelWidth ||
      labelCanvas.height !== pixelHeight
    ) {
      labelCanvas.width = pixelWidth;
      labelCanvas.height = pixelHeight;
    }
    labelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    labelCtx.clearRect(0, 0, cssWidth, cssHeight);
    labelCtx.textAlign = "center";
    labelCtx.textBaseline = "alphabetic";

    const scaleY = cssHeight / view.height;
    const { x: px, y: py } = wasm.positions();
    const fontPx = labelFontPx(scale);
    const subFontPx = sublabelFontPx(scale);
    const nameFont = `600 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
    const sublabelFont = `400 ${subFontPx}px ui-monospace, SFMono-Regular, monospace`;
    const room = labelRoom(scale, GRAPH_NODE_CARD.width);
    const showSublabels = scale >= SUBLABEL_MIN_SCALE;
    const baseline = labelBaselines(fontPx, showSublabels);

    // `label_nodes` is the on-screen set, and it and the instance buffer are
    // emitted in the same order, so the per-node alpha wasm already computed
    // drives label dimming too.
    const labels = wasm.labelNodes();
    const instances = wasm.nodeInstances();

    for (let i = 0; i < labels.length; i++) {
      const index = labels[i]!;
      const node = nodes[index];
      if (!node) continue;
      const alpha = instances[i * NODE_INSTANCE_STRIDE + 4] ?? 1;
      labelCtx.globalAlpha = alpha < 1 ? 0.25 : 1;

      // Positions are in graph space; the label canvas is not.
      const screenX = (px[index]! - view.x) * scale;
      const screenY = (py[index]! - view.y) * scaleY;

      const { primary, secondary } = formatNodeLabel(node.name);
      const name = fitLabel(primary, fontPx, room);
      if (!name) continue;

      labelCtx.font = nameFont;
      labelCtx.fillStyle = LABEL_COLOR;
      labelCtx.fillText(name, screenX, screenY + baseline.name, room);

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
          labelCtx.font = sublabelFont;
          labelCtx.fillStyle = SUBLABEL_COLOR;
          labelCtx.fillText(subline, screenX, screenY + baseline.subline, room);
        }
      }
    }
    labelCtx.globalAlpha = 1;
  }, [dimUnrelated, nodes, selectedIndex, viewport]);

  useEffect(() => registerRender(draw), [draw, registerRender]);

  useEffect(() => {
    if (ready) draw();
  }, [ready, draw]);

  useEffect(() => {
    const canvas = glCanvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  // --- interaction ----------------------------------------------------------
  const hitTest = useCallback(
    (clientX: number, clientY: number) => {
      const wasm = wasmRef.current;
      if (!wasm) return -1;
      const point = viewport.toGraphPoint(clientX, clientY);
      return wasm.hitTest(point.x, point.y);
    },
    [viewport],
  );

  /**
   * Set imperatively rather than through state: the parent's `cursor-grab` class
   * is the resting style, and a pointer event must not cost a React render.
   */
  const setCursor = useCallback((cursor: string) => {
    const canvas = labelCanvasRef.current;
    if (canvas) canvas.style.cursor = cursor;
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const wasm = wasmRef.current;
      if (!wasm) return;
      pointerDownRef.current = { x: e.clientX, y: e.clientY, moved: false };
      const hit = hitTest(e.clientX, e.clientY);

      if (hit >= 0) {
        const point = viewport.toGraphPoint(e.clientX, e.clientY);
        const { x, y } = wasm.positions();
        dragRef.current = {
          index: hit,
          offsetX: point.x - x[hit]!,
          offsetY: point.y - y[hit]!,
          x: x[hit]!,
          y: y[hit]!,
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

      const drag = dragRef.current;
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
      if (hit !== hoveredRef.current) {
        hoveredRef.current = hit;
        viewport.requestRender();
      }
    },
    [hitTest, viewport],
  );

  const endInteraction = useCallback(() => {
    const drag = dragRef.current;
    const down = pointerDownRef.current;

    if (drag) {
      const node = nodes[drag.index];
      if (node) {
        if (drag.moved) {
          onNodeMoved(node.id, drag.x, drag.y);
        } else {
          onSelectNode(node.id === selectedNode ? null : node.id);
        }
      }
    } else if (panningRef.current && down && !down.moved) {
      onSelectNode(null);
    }

    dragRef.current = null;
    panningRef.current = false;
    pointerDownRef.current = null;
    setCursor("");
    viewport.requestRender();
  }, [nodes, onNodeMoved, onSelectNode, selectedNode, setCursor, viewport]);

  const handleMouseLeave = useCallback(() => {
    hoveredRef.current = -1;
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
    <div className={cn("absolute inset-0 select-none", className)}>
      <canvas ref={glCanvasRef} className="absolute inset-0 h-full w-full" />
      <canvas
        ref={labelCanvasRef}
        className="absolute inset-0 h-full w-full"
        aria-label={`Dependency graph with ${nodes.length} nodes`}
        role="img"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endInteraction}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      />
    </div>
  );
}
