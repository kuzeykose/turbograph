"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeFitViewBox, type GraphNode } from "@workspace/graph";

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Zoom limits are expressed relative to the zoom that fits the whole graph
 * rather than as absolute viewBox widths. A file-level import graph lays out
 * across ~300,000px, so the previous fixed `200 < width < 2000` clamp rejected
 * every zoom step on it and left the controls inert.
 */
const MIN_SCALE_VS_FIT = 0.8;
const MAX_SCALE_VS_FIT = 400;
const ZOOM_FACTOR = 1.1;

const FALLBACK_WIDTH = 900;
const FALLBACK_HEIGHT = 550;

export interface UseGraphViewportOptions {
  nodes: readonly GraphNode[];
  /** Element the graph is painted into; used for size and client -> graph mapping. */
  surfaceRef: React.RefObject<Element | null>;
  /** Invoked inside requestAnimationFrame whenever the viewport moved. */
  onViewportChange: (viewport: Viewport) => void;
  /**
   * Width of the surface hidden behind an overlay on the right, currently the
   * details panel. Fitting and centring frame the graph inside what is left, so
   * the reader does not have to look past the panel to find the middle.
   */
  getRightInset?: () => number;
}

export interface GraphViewportApi {
  viewportRef: React.RefObject<Viewport>;
  /** Current scale, mirrored into React state only for the percentage readout. */
  zoom: number;
  zoomBy: (direction: number, centerX?: number, centerY?: number) => void;
  /** Pass an explicit node list to fit positions that React has not committed yet. */
  fitView: (nodeList?: readonly GraphNode[]) => void;
  /** Move the viewport so a graph point sits in the middle of the surface. */
  centerOn: (x: number, y: number) => void;
  toGraphPoint: (clientX: number, clientY: number) => { x: number; y: number };
  beginPan: (clientX: number, clientY: number) => void;
  panTo: (clientX: number, clientY: number) => void;
  requestRender: () => void;
}

export function useGraphViewport({
  nodes,
  surfaceRef,
  onViewportChange,
  getRightInset,
}: UseGraphViewportOptions): GraphViewportApi {
  const viewportRef = useRef<Viewport>({
    x: 0,
    y: 0,
    width: FALLBACK_WIDTH,
    height: FALLBACK_HEIGHT,
  });
  /** Scale at which the whole graph fits, used to derive the zoom limits. */
  const fitScaleRef = useRef(1);
  const rectRef = useRef<DOMRect | null>(null);
  const frameRef = useRef<number | null>(null);
  const panOriginRef = useRef<{ x: number; y: number } | null>(null);

  const [zoom, setZoom] = useState(1);

  const changeRef = useRef(onViewportChange);
  // Held in a ref so `fitView` keeps a stable identity: it is a dependency of
  // the caller's layout effect, which is itself what replaces `nodes`.
  const nodesRef = useRef(nodes);

  const insetRef = useRef(getRightInset);

  useEffect(() => {
    changeRef.current = onViewportChange;
    nodesRef.current = nodes;
    insetRef.current = getRightInset;
  });

  const surfaceRect = useCallback(() => {
    const cached = rectRef.current;
    if (cached) return cached;
    const rect = surfaceRef.current?.getBoundingClientRect() ?? null;
    rectRef.current = rect;
    return rect;
  }, [surfaceRef]);

  /** Surface size, and how much of its width an overlay is covering. */
  const surfaceMetrics = useCallback(() => {
    const rect = surfaceRect();
    const width = rect?.width || FALLBACK_WIDTH;
    const height = rect?.height || FALLBACK_HEIGHT;
    const inset = Math.min(insetRef.current?.() ?? 0, width * 0.8);
    return { width, height, visibleWidth: Math.max(1, width - inset) };
  }, [surfaceRect]);

  /**
   * Coalesce every viewport mutation in a frame into a single paint. Panning
   * used to run through `setViewBox`, re-rendering the whole React tree — and
   * every SVG element with it — once per pointer event.
   */
  const requestRender = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      changeRef.current(viewportRef.current);
    });
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        // Cleared as well as cancelled. `requestRender` treats a handle here as
        // "a frame is already coming", and React re-runs mount effects on the
        // same hook instance in development — so a cancelled handle left behind
        // would make every later request schedule nothing, and panning, zooming
        // and hover would stop repainting for the rest of the session.
        frameRef.current = null;
      }
    },
    [],
  );

  // The cached rect must be dropped whenever the surface can have moved.
  useEffect(() => {
    const invalidate = () => {
      rectRef.current = null;
    };
    window.addEventListener("resize", invalidate);
    window.addEventListener("scroll", invalidate, true);

    const element = surfaceRef.current;
    const observer =
      element && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            invalidate();
            // Keep the viewport's aspect on the surface's, so `toGraphPoint`
            // stays the exact inverse of what the renderer paints.
            const rect = element.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              const view = viewportRef.current;
              view.height = view.width * (rect.height / rect.width);
            }
            requestRender();
          })
        : null;
    if (element && observer) observer.observe(element);

    return () => {
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("scroll", invalidate, true);
      observer?.disconnect();
    };
  }, [surfaceRef, requestRender]);

  const toGraphPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = surfaceRect();
      const viewport = viewportRef.current;
      if (!rect || rect.width === 0 || rect.height === 0) {
        return { x: viewport.x, y: viewport.y };
      }
      return {
        x: ((clientX - rect.left) / rect.width) * viewport.width + viewport.x,
        y: ((clientY - rect.top) / rect.height) * viewport.height + viewport.y,
      };
    },
    [surfaceRect],
  );

  const fitView = useCallback(
    (nodeList?: readonly GraphNode[]) => {
      const { width, height, visibleWidth } = surfaceMetrics();
      const box = computeFitViewBox(
        nodeList ?? nodesRef.current,
        visibleWidth,
        height,
      );
      if (!box) return;

      // The box frames the graph inside the visible strip; the surface itself is
      // wider, so the viewport grows to the right by exactly what the overlay
      // covers. The graph stays put and the hidden strip is what falls behind it.
      viewportRef.current = {
        x: box.x,
        y: box.y,
        width: box.width * (width / visibleWidth),
        height: box.height,
      };
      fitScaleRef.current = box.zoom;
      setZoom(box.zoom);
      requestRender();
    },
    [surfaceMetrics, requestRender],
  );

  const centerOn = useCallback(
    (x: number, y: number) => {
      const viewport = viewportRef.current;
      const { width, visibleWidth } = surfaceMetrics();
      // Centre of what the reader can see, not of the surface.
      const centreX = (visibleWidth / 2) * (viewport.width / width);
      viewportRef.current = {
        ...viewport,
        x: x - centreX,
        y: y - viewport.height / 2,
      };
      requestRender();
    },
    [surfaceMetrics, requestRender],
  );

  const zoomBy = useCallback(
    (direction: number, centerX?: number, centerY?: number) => {
      const rect = surfaceRect();
      const viewport = viewportRef.current;
      const factor = direction > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;

      const nextWidth = viewport.width * factor;
      const nextHeight = viewport.height * factor;

      const surfaceWidth = rect?.width || FALLBACK_WIDTH;
      const scale = surfaceWidth / nextWidth;
      const fitScale = fitScaleRef.current || 1;
      if (
        scale < fitScale * MIN_SCALE_VS_FIT ||
        scale > fitScale * MAX_SCALE_VS_FIT
      ) {
        return;
      }

      const cx = centerX ?? viewport.x + viewport.width / 2;
      const cy = centerY ?? viewport.y + viewport.height / 2;

      viewportRef.current = {
        x: cx - (cx - viewport.x) * factor,
        y: cy - (cy - viewport.y) * factor,
        width: nextWidth,
        height: nextHeight,
      };
      setZoom(scale);
      requestRender();
    },
    [surfaceRect, requestRender],
  );

  const beginPan = useCallback(
    (clientX: number, clientY: number) => {
      panOriginRef.current = toGraphPoint(clientX, clientY);
    },
    [toGraphPoint],
  );

  const panTo = useCallback(
    (clientX: number, clientY: number) => {
      const origin = panOriginRef.current;
      if (!origin) return;
      const current = toGraphPoint(clientX, clientY);
      const viewport = viewportRef.current;
      viewportRef.current = {
        ...viewport,
        x: viewport.x + (origin.x - current.x),
        y: viewport.y + (origin.y - current.y),
      };
      requestRender();
    },
    [toGraphPoint, requestRender],
  );

  // Memoized so consumers that depend on the whole api object (the canvas
  // layer's paint callback does) are not invalidated by every parent render.
  return useMemo(
    () => ({
      viewportRef,
      zoom,
      zoomBy,
      fitView,
      centerOn,
      toGraphPoint,
      beginPan,
      panTo,
      requestRender,
    }),
    [
      zoom,
      zoomBy,
      fitView,
      centerOn,
      toGraphPoint,
      beginPan,
      panTo,
      requestRender,
    ],
  );
}
