import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { TurborepoGraphVisual } from "@/components/turborepo-graph-visual";
import { GraphCanvasLayer } from "@/components/graph/graph-canvas-layer";
import { PackageInfo, DependencyEdge } from "@/lib/utils/turborepo";
import { GRAPH_NODE_CARD } from "@workspace/graph";

/**
 * Records the 2D calls the canvas renderer makes, so the batching and
 * level-of-detail behaviour can be asserted rather than assumed.
 */
/** Every point the edge/card paths were built from, in graph coordinates. */
const points: Array<[number, number]> = [];

function installCanvasSpy() {
  const calls = {
    stroke: 0,
    fill: 0,
    fillText: 0,
    /** Round rects that are not node cards, so the card count stays honest. */
    otherRects: 0,
    moveTo: 0,
    beginPath: 0,
    setLineDash: 0,
    roundRect: 0,
    /** Strokes issued before the first node card, i.e. the edge batches. */
    edgeStrokes: 0,
    /** Edge batches that were handed a non-empty dash pattern. */
    dashedStrokes: 0,
  };

  const ctx = {
    canvas: null as unknown as HTMLCanvasElement,
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    setTransform: (a: number, ...rest: number[]) => {
      // The scaled transform opens a frame; drop the previous frame's geometry
      // so `points` always holds just the last one painted.
      if (rest.length === 5 && a !== 1) points.length = 0;
    },
    clearRect: () => {},
    fillRect: () => {},
    rect: (_x: number, _y: number, width: number) => {
      countRoundRect(width);
    },
    roundRect: (_x: number, _y: number, width: number) => {
      countRoundRect(width);
    },
    beginPath: () => {
      calls.beginPath++;
    },
    moveTo: (x: number, y: number) => {
      calls.moveTo++;
      points.push([x, y]);
    },
    lineTo: (x: number, y: number) => {
      points.push([x, y]);
    },
    closePath: () => {},
    stroke: () => {
      calls.stroke++;
      if (calls.roundRect === 0) calls.edgeStrokes++;
    },
    fill: () => {
      calls.fill++;
    },
    fillText: () => {
      calls.fillText++;
    },

    setLineDash: (pattern: number[]) => {
      calls.setLineDash++;
      if (pattern.length > 0) calls.dashedStrokes++;
    },
  };

  /** Only a node card is exactly one card wide; a plate is sized to its text. */
  function countRoundRect(width: number) {
    if (width === GRAPH_NODE_CARD.width) calls.roundRect++;
    else calls.otherRects++;
  }

  points.length = 0;

  jest
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(function (this: HTMLCanvasElement) {
      ctx.canvas = this;
      return ctx as unknown as CanvasRenderingContext2D;
    });

  // jsdom reports a zero-sized canvas, which the renderer skips.
  Object.defineProperty(HTMLCanvasElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 900,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 550,
  });

  return calls;
}

function chainGraph(count: number) {
  const packages: PackageInfo[] = Array.from({ length: count }, (_, i) => ({
    name: `pkg-${i}`,
    path: `packages/pkg-${i}`,
    dependencies: {},
    devDependencies: {},
  }));
  const dependencies: DependencyEdge[] = Array.from(
    { length: count - 1 },
    (_, i) => ({
      from: `pkg-${i + 1}`,
      to: `pkg-${i}`,
      type: "dependency" as const,
    }),
  );
  return { packages, dependencies };
}

describe("GraphCanvasLayer", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("strokes edges in batches instead of once per edge", async () => {
    const calls = installCanvasSpy();
    const { packages, dependencies } = chainGraph(600);

    render(
      <TurborepoGraphVisual
        apps={[]}
        packages={packages}
        dependencies={dependencies}
      />,
    );

    await waitFor(() => {
      expect(calls.moveTo).toBeGreaterThan(0);
    });

    // Every edge is queued into the path...
    expect(calls.moveTo).toBeGreaterThan(100);
    // ...but all 599 of them are stroked as a single batch, not one draw each.
    expect(calls.edgeStrokes).toBeLessThanOrEqual(3);
    // Node cards still stroke individually; that is the per-node border.
    expect(calls.roundRect).toBeGreaterThan(100);
  });

  it("draws only the nodes inside the viewport once zoomed in", async () => {
    const calls = installCanvasSpy();
    const { packages, dependencies } = chainGraph(600);

    const { container } = render(
      <TurborepoGraphVisual
        apps={[]}
        packages={packages}
        dependencies={dependencies}
      />,
    );

    await waitFor(() => {
      expect(calls.roundRect).toBeGreaterThan(0);
    });
    const fitted = calls.roundRect;

    expect(fitted).toBe(600);

    const canvas = container.querySelector("canvas")!;
    // Positive deltaY zooms in, matching the original wheel handling.
    for (let i = 0; i < 25; i++) {
      fireEvent.wheel(canvas, { deltaY: 100, clientX: 450, clientY: 275 });
    }
    await new Promise((resolve) => setTimeout(resolve, 80));

    const before = calls.roundRect;
    await new Promise((resolve) => setTimeout(resolve, 80));
    const drawnAfterZoom = calls.roundRect - before;

    // The chain spans ~126,000px; zoomed in, only a slice of it is on screen.
    expect(drawnAfterZoom).toBeLessThan(200);
  });

  /**
   * Canvas charges for dashing per segment over the whole path it is handed, so
   * a dense import graph under a 5px pattern reached millions of segments and
   * froze the tab for seconds a frame.
   */
  it("stops dashing an edge batch that would cost more than the budget", async () => {
    const calls = installCanvasSpy();
    const count = 700;
    const packages: PackageInfo[] = Array.from({ length: count }, (_, i) => ({
      name: `pkg-${i}`,
      path: `packages/pkg-${i}`,
      dependencies: {},
      devDependencies: {},
    }));
    // Dense, long-range imports: the shape that made the renderer unusable.
    const dependencies: DependencyEdge[] = [];
    for (let i = 0; i < count; i++) {
      for (let k = 1; k <= 4; k++) {
        dependencies.push({
          from: `pkg-${i}`,
          to: `pkg-${(i * 7 + k * 131) % count}`,
          type: "import" as const,
        });
      }
    }

    render(
      <TurborepoGraphVisual
        apps={[]}
        packages={packages}
        dependencies={dependencies}
      />,
    );

    await waitFor(() => {
      expect(calls.moveTo).toBeGreaterThan(0);
    });

    expect(calls.dashedStrokes).toBe(0);
  });

  it("keeps the dash pattern on a graph small enough to afford it", async () => {
    const calls = installCanvasSpy();
    const count = 320;
    const packages: PackageInfo[] = Array.from({ length: count }, (_, i) => ({
      name: `pkg-${i}`,
      path: `packages/pkg-${i}`,
      dependencies: {},
      devDependencies: {},
    }));
    const dependencies: DependencyEdge[] = Array.from(
      { length: count - 1 },
      (_, i) => ({
        from: `pkg-${i + 1}`,
        to: `pkg-${i}`,
        type: "import" as const,
      }),
    );

    render(
      <TurborepoGraphVisual
        apps={[]}
        packages={packages}
        dependencies={dependencies}
      />,
    );

    await waitFor(() => {
      expect(calls.moveTo).toBeGreaterThan(0);
    });

    expect(calls.dashedStrokes).toBeGreaterThan(0);
  });

  it("clips a long edge to the viewport instead of stroking it in full", () => {
    installCanvasSpy();

    // Two nodes 100,000px apart: only the first is anywhere near the viewport.
    const nodes = [
      {
        id: "a",
        name: "a",
        type: "package" as const,
        path: "p/a",
        x: 200,
        y: 200,
        level: 0,
        dependencies: 1,
        dependents: 0,
      },
      {
        id: "b",
        name: "b",
        type: "package" as const,
        path: "p/b",
        x: 100_200,
        y: 200,
        level: 1,
        dependencies: 0,
        dependents: 1,
      },
    ];
    const edges = [
      { id: "a->b", source: "a", target: "b", type: "dependency" as const },
    ];

    function Harness() {
      const renderRef = React.useRef<(() => void) | null>(null);
      const viewportRef = React.useRef({ x: 0, y: 0, width: 900, height: 550 });
      const viewport = {
        viewportRef,
        zoom: 1,
        zoomBy: () => {},
        fitView: () => {},
        toGraphPoint: (x: number, y: number) => ({ x, y }),
        beginPan: () => {},
        panTo: () => {},
        requestRender: () => renderRef.current?.(),
      };
      return (
        <GraphCanvasLayer
          nodes={nodes}
          edges={edges}
          nodeById={new Map(nodes.map((n) => [n.id, n]))}
          selectedNode={null}
          onSelectNode={() => {}}
          onNodeMoved={() => {}}
          viewport={viewport as never}
          registerRender={(r) => {
            renderRef.current = r;
            return () => {
              renderRef.current = null;
            };
          }}
        />
      );
    }

    render(<Harness />);

    // The card outline contributes no path points, so these are the edge only.
    expect(points.length).toBeGreaterThan(0);
    const far = points.find(([x]) => x > 2000);
    expect(far).toBeUndefined();
  });

  /**
   * The graph mounts empty while a repository page waits on its import scan, so
   * the DOM renderer registers first and the canvas one replaces it. If that
   * handover leaves the wrong paint function registered — or leaves a cancelled
   * frame behind — viewport changes stop repainting while node drops, which go
   * through a React render, keep working.
   */
  it("still repaints on wheel after the graph arrives and swaps renderer", async () => {
    const calls = installCanvasSpy();

    function Deferred() {
      const [data, setData] = React.useState<{
        packages: PackageInfo[];
        dependencies: DependencyEdge[];
      }>({ packages: [], dependencies: [] });
      React.useEffect(() => {
        const timer = setTimeout(() => setData(chainGraph(400)), 20);
        return () => clearTimeout(timer);
      }, []);
      return (
        <TurborepoGraphVisual
          apps={[]}
          packages={data.packages}
          dependencies={data.dependencies}
        />
      );
    }

    const { container } = render(<Deferred />);

    await waitFor(() => {
      expect(container.querySelector("canvas")).not.toBeNull();
    });
    await waitFor(() => {
      expect(calls.roundRect).toBeGreaterThan(0);
    });
    await new Promise((resolve) => setTimeout(resolve, 120));

    const canvas = container.querySelector("canvas")!;
    const before = calls.roundRect;
    fireEvent.wheel(canvas, { deltaY: 100, clientX: 450, clientY: 275 });
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(calls.roundRect).toBeGreaterThan(before);
  });

  it("says nothing where a card is too small to hold a name", async () => {
    const calls = installCanvasSpy();
    const { packages, dependencies } = chainGraph(600);

    render(
      <TurborepoGraphVisual
        apps={[]}
        packages={packages}
        dependencies={dependencies}
      />,
    );

    await waitFor(() => {
      expect(calls.moveTo).toBeGreaterThan(0);
    });

    // A 600-node chain fits at a scale where a card is a couple of pixels
    // wide. Nothing readable goes inside that, and a two-letter stub over a
    // mark says less than the mark alone, so the cards are left bare.
    // `fitLabel` covers the sizes either side of the switch.
    expect(calls.fillText).toBe(0);
  });
});
