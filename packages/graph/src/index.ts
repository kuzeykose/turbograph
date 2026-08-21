// Types
export type {
  PackageInfo,
  DependencyEdge,
  DependencyEdgeType,
  GraphNode,
  GraphEdge,
  TurborepoStructure,
  ImportFileNode,
  ImportGraph,
} from "./types";

// Colors
export {
  nodeColors,
  edgeColors,
  nodeColorsHex,
  edgeColorsHex,
} from "./colors";

// Layout
export type {
  LayoutOptions,
  GraphLayerOrder,
  GraphOrientation,
} from "./layout";
export {
  calculateGraphLayout,
  computeFitViewBox,
  buildDependencyGraph,
  getAffectedPackages,
  getDownstreamDependents,
} from "./layout";

// Shared layout / rendering constants
export {
  GRAPH_NODE_CARD,
  DEFAULT_MIN_VERTICAL_GAP,
  DEFAULT_MIN_LEVEL_HEIGHT,
  DEFAULT_MIN_LEVEL_WIDTH,
  TURBO_CONFIG_FILENAMES,
} from "./constants";

// SVG
export type { SvgOptions, EdgePathOptions } from "./svg";
export {
  computeEdgeEndpoints,
  generateEdgePath,
  generateSvgDocument,
} from "./svg";

// Workspace analysis (isomorphic — works on a path → file-text map)
export {
  analyzeWorkspace,
  getWorkspacePatterns,
  isWorkspacePackageDir,
  posixDirname,
  resolveTurboConfigFileFromFiles,
  selectWorkspacePackageJsons,
  toPosixPath,
} from "./analyze";

export {
  MAX_IMPORT_SOURCE_FILES,
  buildImportGraph,
  extractImportSpecifiers,
  importFilesToLayoutNodes,
  isImportSourceFile,
  resolveImportToFile,
  selectImportSourceFiles,
} from "./imports";
