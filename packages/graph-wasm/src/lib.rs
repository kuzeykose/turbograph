//! Graph layout, hit-testing, culling and frame-buffer generation for the
//! Turborepo dependency/import graphs.
//!
//! The module owns the graph in linear memory and hands JavaScript raw views
//! over it, so a frame costs no allocation and no JS<->wasm marshalling beyond
//! a handful of scalars. Node identity is an index; strings stay on the JS side.
//!
//! Deliberately built without wasm-bindgen: every export is plain `extern "C"`
//! over numbers and pointers, which keeps the artifact small and removes the
//! per-call glue that would otherwise sit directly in the drag path.

use std::alloc::{alloc, dealloc, Layout};
use std::collections::HashSet;

mod layout;
mod frame;

pub use layout::LayerOrder;

/// Visual size of a node card, mirroring `GRAPH_NODE_CARD` on the JS side.
pub const CARD_HALF_WIDTH: f32 = 80.0;
pub const CARD_HALF_HEIGHT: f32 = 22.0;

/// Endpoint clearance so an arrow head does not sit inside the target card.
pub const BOUNDARY_EPS: f32 = 0.75;

pub const EDGE_TYPE_COUNT: usize = 3;

#[derive(Default)]
pub struct Graph {
    pub node_count: usize,
    /// 0 = app, 1 = package.
    pub node_kind: Vec<u8>,

    pub edge_src: Vec<u32>,
    pub edge_dst: Vec<u32>,
    /// 0 = dependency, 1 = devDependency, 2 = import.
    pub edge_type: Vec<u8>,

    /// Deduplicated adjacency in CSR form: `deps` are the nodes a node depends
    /// on, `rdeps` the nodes that depend on it.
    pub deps_offsets: Vec<u32>,
    pub deps: Vec<u32>,
    pub rdeps_offsets: Vec<u32>,
    pub rdeps: Vec<u32>,

    pub depth: Vec<u32>,
    pub pos_x: Vec<f32>,
    pub pos_y: Vec<f32>,
    pub dep_count: Vec<u32>,
    pub dependent_count: Vec<u32>,

    /// Per-edge endpoints, clipped to both card boundaries. Rebuilt on layout
    /// and patched in place while a node is being dragged.
    pub edge_geom: Vec<f32>,

    /// Frame output, one bucket per edge type.
    pub edge_verts: [Vec<f32>; EDGE_TYPE_COUNT],
    pub edge_alpha: [Vec<f32>; EDGE_TYPE_COUNT],
    /// Segment origin repeated per vertex, so the dash pattern for dashed edge
    /// types can be evaluated in the fragment shader.
    pub edge_start: [Vec<f32>; EDGE_TYPE_COUNT],
    /// Frame output: x, y, kind, state per visible node.
    pub node_inst: Vec<f32>,
    /// Indices of nodes whose labels the JS overlay should draw.
    pub label_nodes: Vec<u32>,

    /// Reused highlight scratch, so a frame does not allocate per node.
    pub connected_scratch: Vec<u8>,
}

struct Singleton(std::cell::UnsafeCell<Option<Graph>>);
// wasm32 is single threaded; there is no concurrent access to reason about.
unsafe impl Sync for Singleton {}
static GRAPH: Singleton = Singleton(std::cell::UnsafeCell::new(None));

#[allow(clippy::mut_from_ref)]
fn graph() -> &'static mut Graph {
    unsafe { (*GRAPH.0.get()).get_or_insert_with(Graph::default) }
}

// ---------------------------------------------------------------------------
// Memory the JS side writes its input arrays into.
// ---------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn wasm_alloc(size: usize) -> *mut u8 {
    if size == 0 {
        return std::ptr::null_mut();
    }
    unsafe { alloc(Layout::from_size_align_unchecked(size, 8)) }
}

/// # Safety
/// `ptr` must come from `wasm_alloc` with the same `size`.
#[no_mangle]
pub unsafe extern "C" fn wasm_free(ptr: *mut u8, size: usize) {
    if ptr.is_null() || size == 0 {
        return;
    }
    unsafe { dealloc(ptr, Layout::from_size_align_unchecked(size, 8)) }
}

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

/// Install a graph. Edges reference nodes by index; `node_kind` is one byte per
/// node. All pointers may be freed by the caller once this returns.
///
/// # Safety
/// The pointers must be valid for the given lengths.
#[no_mangle]
pub unsafe extern "C" fn set_graph(
    node_count: u32,
    node_kind_ptr: *const u8,
    edge_src_ptr: *const u32,
    edge_dst_ptr: *const u32,
    edge_type_ptr: *const u8,
    edge_count: u32,
) {
    let g = graph();
    let n = node_count as usize;
    let e = edge_count as usize;

    g.node_count = n;
    g.node_kind = std::slice::from_raw_parts(node_kind_ptr, n).to_vec();
    g.edge_src = std::slice::from_raw_parts(edge_src_ptr, e).to_vec();
    g.edge_dst = std::slice::from_raw_parts(edge_dst_ptr, e).to_vec();
    g.edge_type = std::slice::from_raw_parts(edge_type_ptr, e).to_vec();

    g.build_adjacency();
}

impl Graph {
    /// Build deduplicated CSR adjacency in both directions.
    ///
    /// The JS implementation used `Map<string, Set<string>>`, so duplicate edges
    /// between the same pair collapse; matching that here keeps depths and the
    /// `dependencies`/`dependents` counts identical to the previous renderer.
    fn build_adjacency(&mut self) {
        let n = self.node_count;
        let mut seen: HashSet<u64> = HashSet::with_capacity(self.edge_src.len() * 2);

        let mut fwd_counts = vec![0u32; n];
        let mut rev_counts = vec![0u32; n];
        let mut unique: Vec<(u32, u32)> = Vec::with_capacity(self.edge_src.len());

        for i in 0..self.edge_src.len() {
            let s = self.edge_src[i];
            let t = self.edge_dst[i];
            if s as usize >= n || t as usize >= n {
                continue;
            }
            let key = ((s as u64) << 32) | t as u64;
            if !seen.insert(key) {
                continue;
            }
            unique.push((s, t));
            fwd_counts[s as usize] += 1;
            rev_counts[t as usize] += 1;
        }

        self.deps_offsets = prefix_sum(&fwd_counts);
        self.rdeps_offsets = prefix_sum(&rev_counts);
        self.deps = vec![0; unique.len()];
        self.rdeps = vec![0; unique.len()];

        let mut fwd_cursor = self.deps_offsets.clone();
        let mut rev_cursor = self.rdeps_offsets.clone();
        for &(s, t) in &unique {
            let fi = fwd_cursor[s as usize] as usize;
            self.deps[fi] = t;
            fwd_cursor[s as usize] += 1;

            let ri = rev_cursor[t as usize] as usize;
            self.rdeps[ri] = s;
            rev_cursor[t as usize] += 1;
        }

        self.dep_count = fwd_counts;
        self.dependent_count = rev_counts;
    }

    #[inline]
    pub fn deps_of(&self, node: usize) -> &[u32] {
        let start = self.deps_offsets[node] as usize;
        let end = start + self.dep_count[node] as usize;
        &self.deps[start..end]
    }

    #[inline]
    pub fn rdeps_of(&self, node: usize) -> &[u32] {
        let start = self.rdeps_offsets[node] as usize;
        let end = start + self.dependent_count[node] as usize;
        &self.rdeps[start..end]
    }
}

fn prefix_sum(counts: &[u32]) -> Vec<u32> {
    let mut offsets = vec![0u32; counts.len()];
    let mut total = 0u32;
    for (i, &c) in counts.iter().enumerate() {
        offsets[i] = total;
        total += c;
    }
    offsets
}

// ---------------------------------------------------------------------------
// Accessors — JS reads these as views over wasm memory.
// ---------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn positions_x_ptr() -> *const f32 {
    graph().pos_x.as_ptr()
}

#[no_mangle]
pub extern "C" fn positions_y_ptr() -> *const f32 {
    graph().pos_y.as_ptr()
}

#[no_mangle]
pub extern "C" fn depth_ptr() -> *const u32 {
    graph().depth.as_ptr()
}

#[no_mangle]
pub extern "C" fn dep_count_ptr() -> *const u32 {
    graph().dep_count.as_ptr()
}

#[no_mangle]
pub extern "C" fn dependent_count_ptr() -> *const u32 {
    graph().dependent_count.as_ptr()
}

#[no_mangle]
pub extern "C" fn node_count() -> u32 {
    graph().node_count as u32
}
