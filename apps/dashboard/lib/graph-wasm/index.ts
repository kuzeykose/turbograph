/**
 * Thin typed wrapper over the Rust graph module (`packages/graph-wasm`).
 *
 * The module is loaded as a plain asset from `/graph.wasm` rather than through
 * the bundler: Turbopack does not compile worker/wasm entry points reliably, and
 * a committed artifact also means Vercel needs no Rust toolchain.
 *
 * Every accessor rebuilds its typed-array view because wasm memory can grow
 * during `set_graph`, which detaches any view taken before it.
 */

export const EDGE_TYPE_INDEX = {
  dependency: 0,
  devDependency: 1,
  import: 2,
} as const;

export type EdgeTypeName = keyof typeof EDGE_TYPE_INDEX;

export const LAYER_ORDER_INDEX = {
  "roots-first": 0,
  "leaves-first": 1,
} as const;

interface Exports {
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
    baseWidth: number,
    baseHeight: number,
    padding: number,
    minVerticalGap: number,
    minLevelWidth: number,
    minLevelHeight: number,
    vertical: number,
  ): void;
  set_positions(xPtr: number, yPtr: number): void;
  positions_x_ptr(): number;
  positions_y_ptr(): number;
  depth_ptr(): number;
  dep_count_ptr(): number;
  dependent_count_ptr(): number;
  node_count(): number;
  hit_test(x: number, y: number): number;
  set_node_position(index: number, x: number, y: number): void;
  build_frame(
    viewX: number,
    viewY: number,
    viewW: number,
    viewH: number,
    active: number,
    selected: number,
    hovered: number,
    emitLabels: number,
  ): number;
  edge_verts_ptr(bucket: number): number;
  edge_verts_len(bucket: number): number;
  edge_alpha_ptr(bucket: number): number;
  edge_start_ptr(bucket: number): number;
  node_inst_ptr(): number;
  node_inst_len(): number;
  label_nodes_ptr(): number;
  label_nodes_len(): number;
}

export interface EdgeBucket {
  /** Interleaved x,y per vertex; two vertices per segment. */
  verts: Float32Array;
  /** One alpha per vertex. */
  alpha: Float32Array;
  /** Segment origin repeated per vertex, for dash phase. */
  start: Float32Array;
}

/** Five floats per visible node: x, y, kind, state, alpha. */
export const NODE_INSTANCE_STRIDE = 5;

export class GraphWasm {
  private constructor(private readonly ex: Exports) {}

  static async instantiate(url = "/graph.wasm"): Promise<GraphWasm> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`graph.wasm request failed: ${response.status}`);
    }
    // instantiateStreaming needs the right Content-Type; fall back when a host
    // serves the asset as octet-stream.
    let instance: WebAssembly.Instance;
    try {
      ({ instance } = await WebAssembly.instantiateStreaming(
        new Response(response.clone().body, {
          headers: { "Content-Type": "application/wasm" },
        }),
        {},
      ));
    } catch {
      ({ instance } = await WebAssembly.instantiate(
        await response.arrayBuffer(),
        {},
      ));
    }
    return new GraphWasm(instance.exports as unknown as Exports);
  }

  get nodeCount(): number {
    return this.ex.node_count();
  }

  /** Copy the graph into wasm memory. Edges reference nodes by index. */
  setGraph(
    kinds: Uint8Array,
    src: Uint32Array,
    dst: Uint32Array,
    types: Uint8Array,
  ): void {
    const n = kinds.length;
    const e = src.length;
    const kindBytes = Math.max(8, n);
    const idxBytes = Math.max(8, e * 4);
    const typeBytes = Math.max(8, e);

    const kindPtr = this.ex.wasm_alloc(kindBytes);
    const srcPtr = this.ex.wasm_alloc(idxBytes);
    const dstPtr = this.ex.wasm_alloc(idxBytes);
    const typePtr = this.ex.wasm_alloc(typeBytes);

    try {
      const buffer = this.ex.memory.buffer;
      new Uint8Array(buffer, kindPtr, n).set(kinds);
      new Uint32Array(buffer, srcPtr, e).set(src);
      new Uint32Array(buffer, dstPtr, e).set(dst);
      new Uint8Array(buffer, typePtr, e).set(types);
      this.ex.set_graph(n, kindPtr, srcPtr, dstPtr, typePtr, e);
    } finally {
      this.ex.wasm_free(kindPtr, kindBytes);
      this.ex.wasm_free(srcPtr, idxBytes);
      this.ex.wasm_free(dstPtr, idxBytes);
      this.ex.wasm_free(typePtr, typeBytes);
    }
  }

  computeLayout(
    order: number,
    options: {
      width: number;
      height: number;
      padding: number;
      minVerticalGap: number;
      minLevelWidth: number;
      minLevelHeight: number;
      /** Lay the depth layers out top to bottom rather than left to right. */
      vertical: boolean;
    },
  ): void {
    this.ex.compute_layout(
      order,
      options.width,
      options.height,
      options.padding,
      options.minVerticalGap,
      options.minLevelWidth,
      options.minLevelHeight,
      options.vertical ? 1 : 0,
    );
  }

  /** Commit a layout computed elsewhere, rebuilding edge geometry once. */
  setPositions(x: Float32Array, y: Float32Array): void {
    const bytes = Math.max(8, x.length * 4);
    const xPtr = this.ex.wasm_alloc(bytes);
    const yPtr = this.ex.wasm_alloc(bytes);
    try {
      const buffer = this.ex.memory.buffer;
      new Float32Array(buffer, xPtr, x.length).set(x);
      new Float32Array(buffer, yPtr, y.length).set(y);
      this.ex.set_positions(xPtr, yPtr);
    } finally {
      this.ex.wasm_free(xPtr, bytes);
      this.ex.wasm_free(yPtr, bytes);
    }
  }

  positions(): { x: Float32Array; y: Float32Array } {
    const n = this.nodeCount;
    const buffer = this.ex.memory.buffer;
    return {
      x: new Float32Array(buffer, this.ex.positions_x_ptr(), n),
      y: new Float32Array(buffer, this.ex.positions_y_ptr(), n),
    };
  }

  counts(): { dependencies: Uint32Array; dependents: Uint32Array } {
    const n = this.nodeCount;
    const buffer = this.ex.memory.buffer;
    return {
      dependencies: new Uint32Array(buffer, this.ex.dep_count_ptr(), n),
      dependents: new Uint32Array(buffer, this.ex.dependent_count_ptr(), n),
    };
  }

  hitTest(x: number, y: number): number {
    return this.ex.hit_test(x, y);
  }

  setNodePosition(index: number, x: number, y: number): void {
    this.ex.set_node_position(index, x, y);
  }

  /** Cull to the viewport and build this frame's buffers. Returns visible nodes. */
  buildFrame(
    view: { x: number; y: number; width: number; height: number },
    active: number,
    selected: number,
    hovered: number,
    emitLabels: boolean,
  ): number {
    return this.ex.build_frame(
      view.x,
      view.y,
      view.width,
      view.height,
      active,
      selected,
      hovered,
      emitLabels ? 1 : 0,
    );
  }

  edgeBucket(bucket: number): EdgeBucket {
    const len = this.ex.edge_verts_len(bucket);
    const buffer = this.ex.memory.buffer;
    const vertexCount = len / 2;
    return {
      verts: new Float32Array(buffer, this.ex.edge_verts_ptr(bucket), len),
      alpha: new Float32Array(buffer, this.ex.edge_alpha_ptr(bucket), vertexCount),
      start: new Float32Array(buffer, this.ex.edge_start_ptr(bucket), len),
    };
  }

  nodeInstances(): Float32Array {
    return new Float32Array(
      this.ex.memory.buffer,
      this.ex.node_inst_ptr(),
      this.ex.node_inst_len(),
    );
  }

  labelNodes(): Uint32Array {
    return new Uint32Array(
      this.ex.memory.buffer,
      this.ex.label_nodes_ptr(),
      this.ex.label_nodes_len(),
    );
  }
}

let pending: Promise<GraphWasm> | null = null;

/** Process-wide singleton; the module is stateful and holds one graph. */
export function loadGraphWasm(): Promise<GraphWasm> {
  if (!pending) {
    pending = GraphWasm.instantiate().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}
