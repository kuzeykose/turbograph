//! Edge geometry, hit-testing, and per-frame buffer generation.
//!
//! `build_frame` culls to the viewport and writes WebGL-ready arrays straight
//! into wasm memory. JavaScript uploads those buffers without ever walking the
//! graph, so a pan or drag frame costs no JS-side iteration over 1500 nodes and
//! several thousand edges.

use crate::{graph, Graph, BOUNDARY_EPS, CARD_HALF_HEIGHT, CARD_HALF_WIDTH, EDGE_TYPE_COUNT};

/// Parameter along a ray at which it exits an axis-aligned card centred on the
/// origin. Mirrors `rayExitAABB` in `packages/graph/src/svg.ts`.
#[inline]
fn ray_exit_aabb(hw: f32, hh: f32, ux: f32, uy: f32) -> f32 {
    let mut t = f32::INFINITY;
    if ux > 1e-10 {
        t = t.min(hw / ux);
    }
    if ux < -1e-10 {
        t = t.min(-hw / ux);
    }
    if uy > 1e-10 {
        t = t.min(hh / uy);
    }
    if uy < -1e-10 {
        t = t.min(-hh / uy);
    }
    t
}

/// Endpoints for one edge, clipped to both node cards. Degenerate edges collapse
/// to a zero-length segment, which the frame pass then skips.
fn edge_endpoints(g: &Graph, edge: usize) -> [f32; 4] {
    let s = g.edge_src[edge] as usize;
    let t = g.edge_dst[edge] as usize;
    if s >= g.node_count || t >= g.node_count {
        return [0.0; 4];
    }

    let dx = g.pos_x[t] - g.pos_x[s];
    let dy = g.pos_y[t] - g.pos_y[s];
    let dist = (dx * dx + dy * dy).sqrt();
    if dist < 1e-10 {
        return [0.0; 4];
    }

    let ux = dx / dist;
    let uy = dy / dist;
    let ts = ray_exit_aabb(CARD_HALF_WIDTH, CARD_HALF_HEIGHT, ux, uy);
    let tt = ray_exit_aabb(CARD_HALF_WIDTH, CARD_HALF_HEIGHT, -ux, -uy);
    if !ts.is_finite() || !tt.is_finite() {
        return [0.0; 4];
    }

    let t_end = (tt - BOUNDARY_EPS).max(0.0);
    [
        g.pos_x[s] + ux * ts,
        g.pos_y[s] + uy * ts,
        g.pos_x[t] - ux * t_end,
        g.pos_y[t] - uy * t_end,
    ]
}

pub fn rebuild_edge_geometry(g: &mut Graph) {
    let count = g.edge_src.len();
    g.edge_geom = vec![0.0; count * 4];
    for edge in 0..count {
        let ends = edge_endpoints(g, edge);
        g.edge_geom[edge * 4..edge * 4 + 4].copy_from_slice(&ends);
    }
}

/// Move one node and repair only the edges that touch it.
///
/// This is the drag path: a linear scan over the edge list is a few thousand
/// integer comparisons, far cheaper than recomputing the whole graph, and it
/// keeps the cached geometry valid so the frame pass stays a straight copy.
#[no_mangle]
pub extern "C" fn set_node_position(index: u32, x: f32, y: f32) {
    let g = graph();
    let node = index as usize;
    if node >= g.node_count {
        return;
    }
    g.pos_x[node] = x;
    g.pos_y[node] = y;

    for edge in 0..g.edge_src.len() {
        if g.edge_src[edge] as usize == node || g.edge_dst[edge] as usize == node {
            let ends = edge_endpoints(g, edge);
            g.edge_geom[edge * 4..edge * 4 + 4].copy_from_slice(&ends);
        }
    }
}

/// Replace every node position at once and rebuild all edge geometry.
///
/// Used when the layout is committed from the JS side. Doing this through
/// `set_node_position` would rescan the edge list once per node.
///
/// # Safety
/// `x_ptr` and `y_ptr` must each be valid for `node_count` floats.
#[no_mangle]
pub unsafe extern "C" fn set_positions(x_ptr: *const f32, y_ptr: *const f32) {
    let g = graph();
    let n = g.node_count;
    if n == 0 {
        return;
    }
    g.pos_x = std::slice::from_raw_parts(x_ptr, n).to_vec();
    g.pos_y = std::slice::from_raw_parts(y_ptr, n).to_vec();
    rebuild_edge_geometry(g);
}

/// Topmost node card containing the point, or -1.
///
/// Reverse order so the result matches the paint order the renderer uses.
#[no_mangle]
pub extern "C" fn hit_test(x: f32, y: f32) -> i32 {
    let g = graph();
    for node in (0..g.node_count).rev() {
        if x >= g.pos_x[node] - CARD_HALF_WIDTH
            && x <= g.pos_x[node] + CARD_HALF_WIDTH
            && y >= g.pos_y[node] - CARD_HALF_HEIGHT
            && y <= g.pos_y[node] + CARD_HALF_HEIGHT
        {
            return node as i32;
        }
    }
    -1
}

const STATE_NORMAL: f32 = 0.0;
const STATE_DIMMED: f32 = 1.0;
const STATE_HOVERED: f32 = 2.0;
const STATE_SELECTED: f32 = 3.0;

const BASE_EDGE_ALPHA: f32 = 0.6;
const DIM_EDGE_ALPHA: f32 = 0.04;
const DIM_NODE_ALPHA: f32 = 0.08;

/// Build one frame's buffers.
///
/// `active` is the node driving highlight/dim (selection or hover), or -1.
/// `label_scale` is the current zoom; below the JS threshold no label indices are
/// emitted at all, which is what keeps text off the hot path when zoomed out.
///
/// Returns the number of visible nodes.
#[no_mangle]
pub extern "C" fn build_frame(
    view_x: f32,
    view_y: f32,
    view_w: f32,
    view_h: f32,
    active: i32,
    selected: i32,
    hovered: i32,
    emit_labels: u32,
) -> u32 {
    let g = graph();

    for bucket in 0..EDGE_TYPE_COUNT {
        g.edge_verts[bucket].clear();
        g.edge_alpha[bucket].clear();
        g.edge_start[bucket].clear();
    }
    g.node_inst.clear();
    g.label_nodes.clear();

    if g.node_count == 0 {
        return 0;
    }

    // Pad by a card so partially visible geometry still paints.
    let min_x = view_x - CARD_HALF_WIDTH * 2.0;
    let max_x = view_x + view_w + CARD_HALF_WIDTH * 2.0;
    let min_y = view_y - CARD_HALF_HEIGHT * 2.0;
    let max_y = view_y + view_h + CARD_HALF_HEIGHT * 2.0;

    // Mark the active node's neighbourhood. Only the touched entries are reset
    // afterwards, so this stays O(degree) rather than O(V) per frame.
    let mut marked: Vec<u32> = Vec::new();
    let mut connected = std::mem::take(&mut g.connected_scratch);
    connected.resize(g.node_count, 0);

    if active >= 0 && (active as usize) < g.node_count {
        let a = active as usize;
        connected[a] = 1;
        marked.push(a as u32);
        for &n in g.deps_of(a) {
            if connected[n as usize] == 0 {
                connected[n as usize] = 1;
                marked.push(n);
            }
        }
        for &n in g.rdeps_of(a) {
            if connected[n as usize] == 0 {
                connected[n as usize] = 1;
                marked.push(n);
            }
        }
    }

    let has_active = active >= 0;

    for edge in 0..g.edge_src.len() {
        let base = edge * 4;
        let sx = g.edge_geom[base];
        let sy = g.edge_geom[base + 1];
        let tx = g.edge_geom[base + 2];
        let ty = g.edge_geom[base + 3];

        if sx == 0.0 && sy == 0.0 && tx == 0.0 && ty == 0.0 {
            continue;
        }
        if (sx < min_x && tx < min_x)
            || (sx > max_x && tx > max_x)
            || (sy < min_y && ty < min_y)
            || (sy > max_y && ty > max_y)
        {
            continue;
        }

        let alpha = if has_active {
            let a = active as usize;
            if g.edge_src[edge] as usize == a || g.edge_dst[edge] as usize == a {
                1.0
            } else {
                DIM_EDGE_ALPHA
            }
        } else {
            BASE_EDGE_ALPHA
        };

        let bucket = (g.edge_type[edge] as usize).min(EDGE_TYPE_COUNT - 1);
        g.edge_verts[bucket].extend_from_slice(&[sx, sy, tx, ty]);
        g.edge_alpha[bucket].extend_from_slice(&[alpha, alpha]);
        g.edge_start[bucket].extend_from_slice(&[sx, sy, sx, sy]);
    }

    let mut visible = 0u32;
    // Indexes several parallel arrays, so an iterator over one of them would not
    // read any better here.
    #[allow(clippy::needless_range_loop)]
    for node in 0..g.node_count {
        let x = g.pos_x[node];
        let y = g.pos_y[node];
        let node_state = connected[node];
        if x + CARD_HALF_WIDTH < min_x
            || x - CARD_HALF_WIDTH > max_x
            || y + CARD_HALF_HEIGHT < min_y
            || y - CARD_HALF_HEIGHT > max_y
        {
            continue;
        }

        let state = if selected >= 0 && selected as usize == node {
            STATE_SELECTED
        } else if hovered >= 0 && hovered as usize == node {
            STATE_HOVERED
        } else if has_active && node_state == 0 {
            STATE_DIMMED
        } else {
            STATE_NORMAL
        };

        let alpha = if state == STATE_DIMMED { DIM_NODE_ALPHA } else { 1.0 };

        g.node_inst
            .extend_from_slice(&[x, y, g.node_kind[node] as f32, state, alpha]);
        if emit_labels != 0 {
            g.label_nodes.push(node as u32);
        }
        visible += 1;
    }

    for node in marked {
        connected[node as usize] = 0;
    }
    g.connected_scratch = connected;

    visible
}

// --- frame buffer accessors -------------------------------------------------

#[no_mangle]
pub extern "C" fn edge_verts_ptr(bucket: u32) -> *const f32 {
    graph().edge_verts[bucket as usize % EDGE_TYPE_COUNT].as_ptr()
}

#[no_mangle]
pub extern "C" fn edge_verts_len(bucket: u32) -> u32 {
    graph().edge_verts[bucket as usize % EDGE_TYPE_COUNT].len() as u32
}

#[no_mangle]
pub extern "C" fn edge_alpha_ptr(bucket: u32) -> *const f32 {
    graph().edge_alpha[bucket as usize % EDGE_TYPE_COUNT].as_ptr()
}

#[no_mangle]
pub extern "C" fn edge_start_ptr(bucket: u32) -> *const f32 {
    graph().edge_start[bucket as usize % EDGE_TYPE_COUNT].as_ptr()
}

#[no_mangle]
pub extern "C" fn node_inst_ptr() -> *const f32 {
    graph().node_inst.as_ptr()
}

#[no_mangle]
pub extern "C" fn node_inst_len() -> u32 {
    graph().node_inst.len() as u32
}

#[no_mangle]
pub extern "C" fn label_nodes_ptr() -> *const u32 {
    graph().label_nodes.as_ptr()
}

#[no_mangle]
pub extern "C" fn label_nodes_len() -> u32 {
    graph().label_nodes.len() as u32
}
