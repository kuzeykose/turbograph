import {
  calculateGraphLayout,
  type DependencyEdge,
  type PackageInfo,
} from "@workspace/graph";

function pkg(name: string): PackageInfo {
  return { name, path: `packages/${name}`, dependencies: {}, devDependencies: {} };
}

function dep(from: string, to: string): DependencyEdge {
  return { from, to, type: "dependency" };
}

/**
 * Depth is encoded along the flow axis, which runs top to bottom by default.
 * Recover each node's layer index from its position on that axis.
 */
function layersByY(nodes: { id: string; y: number }[]): Map<string, number> {
  const ys = [...new Set(nodes.map((n) => n.y))].sort((a, b) => a - b);
  const rank = new Map(ys.map((y, i) => [y, i]));
  return new Map(nodes.map((n) => [n.id, rank.get(n.y)!]));
}

describe("calculateGraphLayout depth ordering", () => {
  const apps = [pkg("app-web"), pkg("app-docs")];
  const packages = [pkg("ui"), pkg("utils")];
  const deps = [
    dep("app-web", "ui"),
    dep("app-web", "utils"),
    dep("app-docs", "ui"),
    dep("ui", "utils"),
  ];

  it("places entry points first in roots-first order", () => {
    const { nodes } = calculateGraphLayout(apps, packages, deps, {
      layerOrder: "roots-first",
    });
    const cols = layersByY(nodes);
    // Nothing depends on the apps, so they lead; utils is deepest.
    expect(cols.get("app-web")).toBe(0);
    expect(cols.get("app-docs")).toBe(0);
    expect(cols.get("ui")).toBe(1);
    expect(cols.get("utils")).toBe(2);
  });

  it("places workspace leaves first in leaves-first order", () => {
    const { nodes } = calculateGraphLayout(apps, packages, deps, {
      layerOrder: "leaves-first",
    });
    const cols = layersByY(nodes);
    // utils has no workspace deps, so it leads; consumers follow by longest path.
    expect(cols.get("utils")).toBe(0);
    expect(cols.get("ui")).toBe(1);
    expect(cols.get("app-web")).toBe(2);
    expect(cols.get("app-docs")).toBe(2);
  });

  it("terminates on a cycle that is reachable from a leaf", () => {
    // Minimal reproduction of the Imports-tab freeze. The old leaves-first pass
    // re-queued nodes whenever relaxation raised a depth, so the n0 -> n2 -> n0
    // import cycle (reachable from the leaf n5) incremented depths forever and
    // never terminated. Package graphs are acyclic, which is why only the
    // file-to-file Imports graph ever hung.
    const names = Array.from({ length: 9 }, (_, i) => `n${i}`);
    const cyclic = names.map(pkg);
    const cyclicDeps = (
      [
        ["n8", "n5"], ["n1", "n4"], ["n2", "n0"], ["n8", "n3"], ["n7", "n8"],
        ["n6", "n0"], ["n4", "n5"], ["n3", "n7"], ["n0", "n2"], ["n8", "n1"],
        ["n2", "n4"], ["n0", "n5"], ["n7", "n0"], ["n7", "n1"], ["n6", "n5"],
      ] as const
    ).map(([from, to]) => dep(from, to));

    const start = performance.now();
    const { nodes } = calculateGraphLayout([], cyclic, cyclicDeps, {
      layerOrder: "leaves-first",
    });
    const elapsed = performance.now() - start;

    expect(nodes).toHaveLength(9);
    expect(new Set(nodes.map((n) => n.id))).toEqual(new Set(names));
    for (const node of nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
    }
    expect(elapsed).toBeLessThan(250);
  });

  it("keeps every node in a cycle at a finite depth in both orders", () => {
    const cyclic = [pkg("a"), pkg("b"), pkg("c")];
    const cycleDeps = [dep("a", "b"), dep("b", "c"), dep("c", "a")];

    for (const layerOrder of ["roots-first", "leaves-first"] as const) {
      const { nodes } = calculateGraphLayout([], cyclic, cycleDeps, {
        layerOrder,
      });
      expect(nodes).toHaveLength(3);
      for (const node of nodes) {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
      }
    }
  });
});

describe("calculateGraphLayout at import-graph scale", () => {
  /**
   * Long dependency chains with local skip edges — the shape a file-to-file import
   * graph actually takes, and the one that made `leaves-first` collapse into a
   * repeated-relaxation blowup (~1000x slower than `roots-first`) before the
   * depth pass was rewritten around dependency counters.
   */
  const NODE_COUNT = 1500;

  function buildDeepGraph() {
    // xorshift32, so the fixture is byte-identical across runs and platforms.
    let state = 2463534242;
    const rnd = (n: number) => {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state % n;
    };

    const packages = Array.from({ length: NODE_COUNT }, (_, i) => pkg(`n${i}`));
    const deps: DependencyEdge[] = [];
    const seen = new Set<string>();
    const add = (from: number, to: number) => {
      if (from === to || to < 0) return;
      const key = `${from}>${to}`;
      if (seen.has(key)) return;
      seen.add(key);
      deps.push(dep(`n${from}`, `n${to}`));
    };

    for (let i = 1; i < NODE_COUNT; i++) {
      add(i, i - 1);
      for (let f = 0; f < 3; f++) {
        add(i, i - 1 - rnd(Math.min(i, 40)));
      }
    }
    return { packages, deps };
  }

  it.each(["roots-first", "leaves-first"] as const)(
    "lays out 1500 deeply chained nodes quickly in %s order",
    (layerOrder) => {
      const { packages, deps } = buildDeepGraph();
      expect(deps.length).toBeGreaterThan(5000);

      const start = performance.now();
      const { nodes } = calculateGraphLayout([], packages, deps, { layerOrder });
      const elapsed = performance.now() - start;

      expect(nodes).toHaveLength(NODE_COUNT);
      expect(elapsed).toBeLessThan(250);
    },
  );

  it("gives both layer orders the same set of depths on a chain", () => {
    // A pure chain has one node per layer in either direction, just mirrored.
    const chain = Array.from({ length: 50 }, (_, i) => pkg(`c${i}`));
    const chainDeps = Array.from({ length: 49 }, (_, i) =>
      dep(`c${i + 1}`, `c${i}`),
    );

    const roots = calculateGraphLayout([], chain, chainDeps, {
      layerOrder: "roots-first",
    });
    const leaves = calculateGraphLayout([], chain, chainDeps, {
      layerOrder: "leaves-first",
    });

    const rootCols = layersByY(roots.nodes);
    const leafCols = layersByY(leaves.nodes);
    for (let i = 0; i < 50; i++) {
      // roots-first counts down the chain, leaves-first counts up it.
      expect(rootCols.get(`c${i}`)).toBe(49 - i);
      expect(leafCols.get(`c${i}`)).toBe(i);
    }
  });
});

describe("oversized layer wrapping", () => {
  /** Every file at the same depth: what a cyclic import graph collapses to. */
  function oneLayer(count: number) {
    const packages = Array.from({ length: count }, (_, i) => pkg(`file-${i}`));
    const dependencies: DependencyEdge[] = [];
    for (let i = 0; i < count; i++) {
      const target = (i * 7 + 131) % count;
      if (target !== i) dependencies.push(dep(`file-${i}`, `file-${target}`));
    }
    return { packages, dependencies };
  }

  const extent = (nodes: { x: number; y: number }[]) => ({
    width: Math.max(...nodes.map((n) => n.x)) - Math.min(...nodes.map((n) => n.x)) + 160,
    height: Math.max(...nodes.map((n) => n.y)) - Math.min(...nodes.map((n) => n.y)) + 44,
  });

  /**
   * A layer drawn as one column is a straight line as long as the layer is
   * large, and a 400-file line is 20,000px tall against a viewport a few
   * hundred px tall — it fits on screen at about 4%.
   */
  it("wraps a large layer into a block instead of one straight line", () => {
    const { packages, dependencies } = oneLayer(400);
    const { nodes } = calculateGraphLayout([], packages, dependencies, {
      width: 900,
      height: 550,
      padding: 80,
    });

    // One depth spread over more than one track is the wrap.
    expect(new Set(nodes.map((n) => n.y)).size).toBeGreaterThan(1);

    const { width, height } = extent(nodes);
    // Proportioned like a screen rather than a ribbon.
    expect(height / width).toBeLessThan(3);
    expect(width / height).toBeLessThan(3);
  });

  it("gives every node in a wrapped layer its own position", () => {
    const { packages, dependencies } = oneLayer(400);
    const { nodes } = calculateGraphLayout([], packages, dependencies, {
      width: 900,
      height: 550,
      padding: 80,
    });

    const positions = new Set(nodes.map((n) => `${n.x},${n.y}`));
    expect(positions.size).toBe(nodes.length);
  });

  /** Package graphs are small enough to read as single lines, and stay that way. */
  it("leaves a small graph as one line per depth", () => {
    const packages = [pkg("a"), pkg("b"), pkg("c"), pkg("d"), pkg("e")];
    const dependencies = [dep("a", "b"), dep("b", "c"), dep("c", "d"), dep("d", "e")];
    const { nodes } = calculateGraphLayout([], packages, dependencies, {
      width: 900,
      height: 550,
      padding: 80,
    });

    // A chain of five is five depths, so five rows of one node each.
    expect(new Set(nodes.map((n) => n.y)).size).toBe(5);
    expect(new Set(nodes.map((n) => n.x)).size).toBe(1);
  });
});

describe("most used first", () => {
  const apps = [pkg("web"), pkg("docs"), pkg("admin")];
  const packages = [pkg("ui"), pkg("utils"), pkg("config")];
  const deps = [
    dep("web", "ui"),
    dep("docs", "ui"),
    dep("admin", "ui"),
    dep("web", "utils"),
    dep("ui", "utils"),
    dep("docs", "config"),
  ];

  /** Reading order: down the layers, then across each one. */
  function readingOrder(nodes: { id: string; x: number; y: number }[]) {
    return [...nodes].sort((a, b) => a.y - b.y || a.x - b.x).map((n) => n.id);
  }

  it("puts the most depended-upon node first within its layer", () => {
    const { nodes } = calculateGraphLayout(apps, packages, deps, {
      layerOrder: "roots-first",
    });

    // ui (3 dependents) and config (1) share a layer; ui leads it.
    const layer = nodes
      .filter((n) => n.id === "ui" || n.id === "config")
      .sort((a, b) => a.x - b.x);
    expect(layer[0]!.y).toBe(layer[1]!.y);
    expect(layer[0]!.id).toBe("ui");
  });

  /** An entry point nothing depends on is the least used thing on screen. */
  it("does not lead with nodes that have no dependents", () => {
    const { nodes } = calculateGraphLayout(apps, packages, deps);
    const order = readingOrder(nodes);
    const byId = new Map(nodes.map((n) => [n.id, n]));

    expect(byId.get(order[0]!)!.dependents).toBeGreaterThan(0);
    // The apps, used by nothing, end up in the last layer.
    const lastY = Math.max(...nodes.map((n) => n.y));
    for (const id of ["web", "docs", "admin"]) {
      expect(byId.get(id)!.y).toBe(lastY);
    }
  });
});

describe("arrows follow the layout downward", () => {
  const apps = [pkg("web")];
  const packages = [pkg("ui"), pkg("utils")];
  // web imports ui, ui imports utils.
  const deps = [dep("web", "ui"), dep("ui", "utils")];

  /** Every edge must point from the higher node to the lower one. */
  function assertPointsDown(
    nodes: { id: string; y: number }[],
    edges: { source: string; target: string }[]
  ) {
    const y = new Map(nodes.map((n) => [n.id, n.y]));
    for (const edge of edges) {
      expect(y.get(edge.source)!).toBeLessThan(y.get(edge.target)!);
    }
  }

  it("points from dependent down to dependency in roots-first order", () => {
    const { nodes, edges } = calculateGraphLayout(apps, packages, deps, {
      layerOrder: "roots-first",
    });
    assertPointsDown(nodes, edges);
    // web sits above ui, so the arrow reads "web imports ui".
    expect(edges.find((e) => e.source === "web")!.target).toBe("ui");
  });

  it("points from dependency down to dependent in leaves-first order", () => {
    const { nodes, edges } = calculateGraphLayout(apps, packages, deps, {
      layerOrder: "leaves-first",
    });
    assertPointsDown(nodes, edges);
    // utils sits above ui, so the arrow reads "utils is used by ui".
    expect(edges.find((e) => e.source === "utils")!.target).toBe("ui");
  });
});

describe("focus reduces the graph to one node's neighbours", () => {
  /** A shared module, what it uses, who uses it, and who uses those. */
  const hub = "hub";
  const ownDeps = ["dep-a", "dep-b"];
  const users = ["user-a", "user-b", "user-c"];
  const secondHop = ["outer-a", "outer-b"];
  const unrelated = ["other-a", "other-b"];

  const packages = [hub, ...ownDeps, ...users, ...secondHop, ...unrelated].map(pkg);
  const deps = [
    ...ownDeps.map((d) => dep(hub, d)),
    ...users.map((u) => dep(u, hub)),
    dep("outer-a", "user-a"),
    dep("outer-b", "user-b"),
    dep("other-b", "other-a"),
  ];

  it("keeps only the focused node and its direct neighbours", () => {
    const { nodes } = calculateGraphLayout([], packages, deps, { focus: hub });

    expect(new Set(nodes.map((n) => n.id))).toEqual(
      new Set([hub, ...ownDeps, ...users])
    );
  });

  it("puts what the node uses above it and what uses it below", () => {
    const { nodes } = calculateGraphLayout([], packages, deps, { focus: hub });
    const y = new Map(nodes.map((n) => [n.id, n.y]));

    for (const dependency of ownDeps) {
      expect(y.get(dependency)!).toBeLessThan(y.get(hub)!);
    }
    for (const user of users) {
      expect(y.get(user)!).toBeGreaterThan(y.get(hub)!);
    }
  });

  it("still points every edge downward when focused", () => {
    const { nodes, edges } = calculateGraphLayout([], packages, deps, { focus: hub });
    const y = new Map(nodes.map((n) => [n.id, n.y]));

    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      expect(y.get(edge.source)!).toBeLessThan(y.get(edge.target)!);
    }
  });

  it("reports the node's full counts, not just the focused neighbourhood", () => {
    const { nodes } = calculateGraphLayout([], packages, deps, { focus: hub });
    const node = nodes.find((n) => n.id === hub)!;

    expect(node.dependents).toBe(users.length);
    expect(node.dependencies).toBe(ownDeps.length);
  });

  /** A node that only uses things still gets those things, not the whole graph. */
  it("shows the neighbours of a node nothing else uses", () => {
    const { nodes } = calculateGraphLayout([], packages, deps, {
      focus: "outer-a",
    });

    expect(new Set(nodes.map((n) => n.id))).toEqual(
      new Set(["outer-a", "user-a"])
    );
  });

  /** Focusing something with no edges at all would collapse the view to one card. */
  it("leaves the layout whole when the focused node stands alone", () => {
    const lonely = [...packages, pkg("island")];
    const { nodes } = calculateGraphLayout([], lonely, deps, {
      focus: "island",
    });

    expect(nodes).toHaveLength(lonely.length);
  });
});
