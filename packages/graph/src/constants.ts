/**
 * Visual size of dependency graph nodes (cards) in SVG space.
 * Used by layout min-spacing, edge routing, and export.
 */
export const GRAPH_NODE_CARD = {
  width: 160,
  height: 44,
  halfWidth: 80,
  halfHeight: 22,
  rx: 8,
} as const;

/** Minimum vertical center-to-center spacing between nodes (layer stacking). */
export const DEFAULT_MIN_VERTICAL_GAP = 52;

/** Minimum horizontal spacing between depth columns (center-to-center). */
export const DEFAULT_MIN_LEVEL_WIDTH = 210;

/**
 * Minimum vertical spacing between depth layers (center-to-center).
 *
 * Wider than `DEFAULT_MIN_VERTICAL_GAP` because layers running top to bottom
 * have edges and arrow heads crossing the space between them, where nodes
 * stacked inside one layer sit flush.
 */
export const DEFAULT_MIN_LEVEL_HEIGHT = 110;

/**
 * Config filenames Turborepo accepts, in resolution order.
 * Turbo reads `turbo.json` first and falls back to `turbo.jsonc`.
 */
export const TURBO_CONFIG_FILENAMES = ["turbo.json", "turbo.jsonc"] as const;
