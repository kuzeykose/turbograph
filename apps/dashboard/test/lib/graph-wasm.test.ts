import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calculateGraphLayout,
  type DependencyEdge,
  type GraphLayerOrder,
  type PackageInfo,
} from "@workspace/graph";

/**
 * The Rust layout in `packages/graph-wasm` is a port of the TypeScript one and
 * must stay positionally identical, otherwise the graph would visibly jump when
 * the renderer falls back. These tests drive the committed artifact directly.
 */

const WASM_PATH = join(__dirname, "../../public/graph.wasm");
const EDGE_TYPES = ["dependency", "devDependency", "import"] as const;
const ORDERS: Record<GraphLayerOrder, number> = {
  "roots-first": 0,
  "leaves-first": 1,
};

interface WasmExports {
  memory: WebAssembly.Memory;
  wasm_alloc(size: number): number;
  wasm_free(ptr: number, size: number): void;
  set_graph(
    nodeCount: number,
    kindPtr: number,
    srcPtr: number,
    dstPtr: number,
    typePtr: number,
    edgeCount: number,
  ): void;
  compute_layout(
    order: number,
    w: number,
    h: number,
    padding: number,
    gap: number,
    levelWidth: number,
    levelHeight: number,
    vertical: number,
  ): void;
  positions_x_ptr(): number;
  positions_y_ptr(): number;
  hit_test(x: number, y: number): number;
  set_node_position(index: number, x: number, y: number): void;
}

async function loadWasm(): Promise<WasmExports> {
  const { instance } = await WebAssembly.instantiate(
    readFileSync(WASM_PATH),
    {},
  );
  return instance.exports as unknown as WasmExports;
}

function wasmLayout(
  w: WasmExports,
  names: string[],
  kinds: number[],
  edges: DependencyEdge[],
  order: number,
) {
  const index = new Map(names.map((name, i) => [name, i]));
  const n = names.length;
  const e = edges.length;

  const kindBytes = Math.max(8, n);
  const idxBytes = Math.max(8, e * 4);
  const typeBytes = Math.max(8, e);
  const kindPtr = w.wasm_alloc(kindBytes);
  const srcPtr = w.wasm_alloc(idxBytes);
  const dstPtr = w.wasm_alloc(idxBytes);
  const typePtr = w.wasm_alloc(typeBytes);

  new Uint8Array(w.memory.buffer, kindPtr, n).set(kinds);
  const src = new Uint32Array(w.memory.buffer, srcPtr, e);
  const dst = new Uint32Array(w.memory.buffer, dstPtr, e);
  const types = new Uint8Array(w.memory.buffer, typePtr, e);
  edges.forEach((edge, i) => {
    src[i] = index.get(edge.from)!;
    dst[i] = index.get(edge.to)!;
    types[i] = EDGE_TYPES.indexOf(edge.type);
  });

  w.set_graph(n, kindPtr, srcPtr, dstPtr, typePtr, e);
  w.compute_layout(order, 900, 550, 80, 52, 210, 110, 1);

  const x = new Float32Array(w.memory.buffer, w.positions_x_ptr(), n).slice();
  const y = new Float32Array(w.memory.buffer, w.positions_y_ptr(), n).slice();

  w.wasm_free(kindPtr, kindBytes);
  w.wasm_free(srcPtr, idxBytes);
  w.wasm_free(dstPtr, idxBytes);
  w.wasm_free(typePtr, typeBytes);
  return { x, y };
}

const pkg = (name: string): PackageInfo => ({
  name,
  path: `packages/${name}`,
  dependencies: {},
  devDependencies: {},
});
const dep = (from: string, to: string): DependencyEdge => ({
  from,
  to,
  type: "import",
});

function expectParity(
  w: WasmExports,
  apps: PackageInfo[],
  packages: PackageInfo[],
  edges: DependencyEdge[],
) {
  const names = [...apps, ...packages].map((p) => p.name);
  const kinds = [...apps.map(() => 0), ...packages.map(() => 1)];

  for (const order of ["roots-first", "leaves-first"] as GraphLayerOrder[]) {
    const js = calculateGraphLayout(apps, packages, edges, {
      layerOrder: order,
    });
    const byId = new Map(js.nodes.map((node) => [node.id, node]));
    const wasm = wasmLayout(w, names, kinds, edges, ORDERS[order]);

    names.forEach((name, i) => {
      const expected = byId.get(name)!;
      expect(wasm.x[i]).toBeCloseTo(expected.x, 2);
      expect(wasm.y[i]).toBeCloseTo(expected.y, 2);
    });
  }
}

describe("graph-wasm layout parity", () => {
  let w: WasmExports;

  beforeAll(async () => {
    w = await loadWasm();
  });

  it("matches the TypeScript layout on a small workspace", () => {
    expectParity(
      w,
      [pkg("app-web"), pkg("app-docs")],
      [pkg("ui"), pkg("utils")],
      [
        dep("app-web", "ui"),
        dep("app-web", "utils"),
        dep("app-docs", "ui"),
        dep("ui", "utils"),
      ],
    );
  });

  it("matches on a graph containing an import cycle", () => {
    const nodes = Array.from({ length: 9 }, (_, i) => pkg(`n${i}`));
    const edges = (
      [
        [8, 5], [1, 4], [2, 0], [8, 3], [7, 8], [6, 0], [4, 5], [3, 7],
        [0, 2], [8, 1], [2, 4], [0, 5], [7, 0], [7, 1], [6, 5],
      ] as const
    ).map(([a, b]) => dep(`n${a}`, `n${b}`));

    expectParity(w, [], nodes, edges);
  });

  it("matches at import-graph scale", () => {
    let state = 2463534242;
    const rnd = (n: number) => {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state % n;
    };
    const count = 1500;
    const nodes = Array.from({ length: count }, (_, i) => pkg(`n${i}`));
    const edges: DependencyEdge[] = [];
    const seen = new Set<string>();
    const add = (from: number, to: number) => {
      if (from === to || to < 0) return;
      const key = `${from}>${to}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push(dep(`n${from}`, `n${to}`));
    };
    for (let i = 1; i < count; i++) {
      add(i, i - 1);
      for (let f = 0; f < 3; f++) add(i, i - 1 - rnd(Math.min(i, 40)));
    }

    expect(edges.length).toBeGreaterThan(5000);
    expectParity(w, [], nodes, edges);
  });

  it("hit-tests the card under a point and moves nodes on drag", () => {
    const nodes = [pkg("a"), pkg("b"), pkg("c")];
    const edges = [dep("b", "a"), dep("c", "b")];
    const names = nodes.map((n) => n.name);
    const { x, y } = wasmLayout(w, names, [1, 1, 1], edges, 0);

    // Dead centre of a card hits it; far outside hits nothing.
    expect(w.hit_test(x[1]!, y[1]!)).toBe(1);
    expect(w.hit_test(x[1]! + 5000, y[1]!)).toBe(-1);

    w.set_node_position(1, 4321, 1234);
    expect(w.hit_test(4321, 1234)).toBe(1);
  });
});
