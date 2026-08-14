// Types
export type {
  PackageInfo,
  DependencyEdge,
  GraphNode,
  GraphEdge,
  TurborepoStructure,
} from "./types";

// Colors
export {
  nodeColors,
  edgeColors,
  nodeColorsHex,
  edgeColorsHex,
} from "./colors";

// Layout
export type { LayoutOptions, GraphLayerOrder } from "./layout";
export {
  calculateGraphLayout,
  buildDependencyGraph,
  getAffectedPackages,
  getDownstreamDependents,
} from "./layout";

// Shared layout / rendering constants
export {
  GRAPH_NODE_CARD,
  DEFAULT_MIN_VERTICAL_GAP,
  DEFAULT_MIN_LEVEL_WIDTH,
  TURBO_CONFIG_FILENAMES,
} from "./constants";

// SVG
export type { SvgOptions, EdgePathOptions } from "./svg";
export { generateEdgePath, generateSvgDocument } from "./svg";
