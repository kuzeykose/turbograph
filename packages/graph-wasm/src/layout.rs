//! Layered ("Sugiyama-lite") layout, ported from `packages/graph/src/layout.ts`.
//!
//! Column assignment is a longest-path pass over a topological order. Both
//! directions run in O(V+E): a node is enqueued only once every node it waits on
//! has a final depth, so a dependency cycle simply never enqueues rather than
//! relaxing forever.

use crate::{graph, Graph};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LayerOrder {
    /// Entry packages on the left, dependencies flowing right.
    RootsFirst,
    /// Workspace leaves on the left, dependents flowing right.
    LeavesFirst,
}

impl LayerOrder {
    fn from_u32(value: u32) -> Self {
        if value == 1 {
            LayerOrder::LeavesFirst
        } else {
            LayerOrder::RootsFirst
        }
    }
}

/// Depth per node, plus the order in which depths were first assigned.
///
/// That order decides the vertical stacking inside a column, and matching it
/// keeps the layout visually identical to the JavaScript implementation.
struct Depths {
    depth: Vec<u32>,
    assigned: Vec<bool>,
    order: Vec<u32>,
}

impl Depths {
    fn new(n: usize) -> Self {
        Depths {
            depth: vec![0; n],
            assigned: vec![false; n],
            order: Vec::with_capacity(n),
        }
    }

    #[inline]
    fn set(&mut self, node: usize, value: u32) {
        if !self.assigned[node] {
            self.assigned[node] = true;
            self.order.push(node as u32);
            self.depth[node] = value;
        } else if value > self.depth[node] {
            self.depth[node] = value;
        }
    }

    /// Nodes never reached keep depth 0, matching the JS fallback sweep.
    fn finish(&mut self) {
        for node in 0..self.depth.len() {
            if !self.assigned[node] {
                self.assigned[node] = true;
                self.order.push(node as u32);
            }
        }
    }
}

fn compute_depths(g: &Graph, order: LayerOrder) -> Depths {
    let n = g.node_count;
    let mut d = Depths::new(n);

    // Remaining unresolved neighbours in the traversal direction.
    let mut pending: Vec<u32> = match order {
        LayerOrder::RootsFirst => g.dependent_count.clone(),
        LayerOrder::LeavesFirst => g.dep_count.clone(),
    };

    let mut queue: Vec<u32> = Vec::with_capacity(n);
    for (node, &remaining) in pending.iter().enumerate() {
        if remaining == 0 {
            d.set(node, 0);
            queue.push(node as u32);
        }
    }

    let mut head = 0usize;
    while head < queue.len() {
        let current = queue[head] as usize;
        head += 1;
        let next_depth = d.depth[current] + 1;

        let neighbours: &[u32] = match order {
            LayerOrder::RootsFirst => g.deps_of(current),
            LayerOrder::LeavesFirst => g.rdeps_of(current),
        };

        for &raw in neighbours {
            let neighbour = raw as usize;
            d.set(neighbour, next_depth);
            pending[neighbour] -= 1;
            if pending[neighbour] == 0 {
                queue.push(raw);
            }
        }
    }

    d.finish();
    d
}

/// Nodes per track to lay each depth layer out in.
///
/// Mirrors `chooseTrackFill` in `packages/graph/src/layout.ts`; see there for
/// why a large layer is wrapped into a block rather than drawn as one line.
fn choose_track_fill(
    layer_sizes: &[usize],
    target_aspect: f32,
    track_pitch: f32,
    layer_pitch: f32,
    cross_pitch: f32,
    base_cross: f32,
    vertical: bool,
) -> usize {
    let largest = layer_sizes.iter().copied().max().unwrap_or(1).max(1);

    if largest as f32 * cross_pitch <= 2.0 * base_cross {
        return largest;
    }

    let mut best_fill = largest;
    let mut best_distance = f32::INFINITY;

    for fill in 1..=largest {
        // Tracks inside one layer sit at the tighter node pitch; only the step
        // from one layer to the next needs room for the edges crossing between.
        let mut flow = 0.0f32;
        for &size in layer_sizes {
            flow += (size.div_ceil(fill) - 1) as f32 * track_pitch + layer_pitch;
        }
        flow -= layer_pitch;

        let cross = fill as f32 * cross_pitch;
        let aspect = if vertical { cross / flow } else { flow / cross };
        let distance = (aspect / target_aspect).ln().abs();
        if distance < best_distance {
            best_distance = distance;
            best_fill = fill;
        }
    }

    best_fill
}

/// Assign positions. Mirrors `calculateGraphLayout`'s sizing rules exactly.
#[allow(clippy::too_many_arguments)]
pub fn compute(
    g: &mut Graph,
    order: LayerOrder,
    base_width: f32,
    base_height: f32,
    padding: f32,
    min_vertical_gap: f32,
    min_level_width: f32,
    min_level_height: f32,
    vertical: bool,
) {
    let n = g.node_count;
    g.pos_x = vec![0.0; n];
    g.pos_y = vec![0.0; n];

    if n == 0 {
        g.depth = Vec::new();
        g.edge_geom = Vec::new();
        return;
    }

    let d = compute_depths(g, order);
    let max_depth = d.depth.iter().copied().max().unwrap_or(0);

    // Group by column, preserving first-assignment order within each.
    let mut columns: Vec<Vec<u32>> = vec![Vec::new(); (max_depth + 1) as usize];
    for &node in &d.order {
        columns[d.depth[node as usize] as usize].push(node);
    }

    // Most-depended-upon first inside each layer, matching the TypeScript
    // layout. `sort_by` is stable, so equally used nodes keep their order.
    for nodes in columns.iter_mut() {
        nodes.sort_by(|a, b| {
            g.dependent_count[*b as usize].cmp(&g.dependent_count[*a as usize])
        });
    }

    // Empty depths take no track at all, matching the TypeScript layout.
    let layer_sizes: Vec<usize> = columns
        .iter()
        .filter(|nodes| !nodes.is_empty())
        .map(|nodes| nodes.len())
        .collect();

    let track_pitch = if vertical { min_vertical_gap } else { min_level_width };
    let layer_pitch = if vertical { min_level_height } else { min_level_width };
    let cross_pitch = if vertical { min_level_width } else { min_vertical_gap };
    let base_flow = if vertical { base_height } else { base_width };
    let base_cross = if vertical { base_width } else { base_height };

    let track_fill = choose_track_fill(
        &layer_sizes,
        base_width / base_height,
        track_pitch,
        layer_pitch,
        cross_pitch,
        base_cross,
        vertical,
    );

    let layer_tracks: Vec<usize> = layer_sizes
        .iter()
        .map(|&size| size.div_ceil(track_fill).max(1))
        .collect();
    let layer_fill: Vec<usize> = layer_sizes
        .iter()
        .zip(&layer_tracks)
        .map(|(&size, &tracks)| size.div_ceil(tracks).max(1))
        .collect();
    let max_fill = layer_fill.iter().copied().max().unwrap_or(1).max(1);

    let cross_extent = base_cross.max(2.0 * padding + max_fill as f32 * cross_pitch);

    // Flow-axis offset of each layer's first track, before any stretch.
    let mut layer_offsets: Vec<f32> = Vec::with_capacity(layer_tracks.len());
    let mut offset = 0.0f32;
    for &tracks in &layer_tracks {
        layer_offsets.push(offset);
        offset += (tracks - 1) as f32 * track_pitch + layer_pitch;
    }
    let raw_flow = (offset - layer_pitch).max(0.0);

    let flow_extent = base_flow.max(2.0 * padding + raw_flow);
    // Stretched only when the graph is smaller than the base box, so a layout
    // that already overflows keeps its natural pitches.
    let flow_scale = if raw_flow > 0.0 {
        (flow_extent - 2.0 * padding) / raw_flow
    } else {
        1.0
    };

    let mut layer = 0usize;
    for nodes in columns.iter() {
        if nodes.is_empty() {
            continue;
        }
        let layer_offset = layer_offsets[layer];
        let fill = layer_fill[layer];
        layer += 1;

        let cross_spacing = (cross_extent - 2.0 * padding) / fill as f32;
        for (index, &node) in nodes.iter().enumerate() {
            let flow = padding
                + (layer_offset + (index / fill) as f32 * track_pitch) * flow_scale;
            let cross = padding + cross_spacing * ((index % fill) as f32 + 0.5);
            g.pos_x[node as usize] = if vertical { cross } else { flow };
            g.pos_y[node as usize] = if vertical { flow } else { cross };
        }
    }

    g.depth = d.depth;
    crate::frame::rebuild_edge_geometry(g);
}

/// Lays out the graph installed by `set_graph`; a no-op when none is installed.
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub extern "C" fn compute_layout(
    order: u32,
    base_width: f32,
    base_height: f32,
    padding: f32,
    min_vertical_gap: f32,
    min_level_width: f32,
    min_level_height: f32,
    // Non-zero lays the layers out top to bottom.
    vertical: u32,
) {
    let g = graph();
    compute(
        g,
        LayerOrder::from_u32(order),
        base_width,
        base_height,
        padding,
        min_vertical_gap,
        min_level_width,
        min_level_height,
        vertical != 0,
    );
}
