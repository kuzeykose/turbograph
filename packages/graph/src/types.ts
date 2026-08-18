/**
 * Information about a package in the monorepo
 */
export interface PackageInfo {
  name: string;
  path: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export type DependencyEdgeType = "dependency" | "devDependency" | "import";

/**
 * Represents a dependency relationship between two packages
 */
export interface DependencyEdge {
  from: string;
  to: string;
  type: DependencyEdgeType;
  /** How many source files contribute to this edge (import graphs). */
  count?: number;
}

/**
 * A node in the dependency graph with position information
 */
export interface GraphNode {
  id: string;
  name: string;
  type: "app" | "package";
  x: number;
  y: number;
  dependencies: number;
  dependents: number;
}

/**
 * An edge in the dependency graph
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: DependencyEdgeType;
  count?: number;
}

/**
 * Structure representing a turborepo workspace
 */
export interface TurborepoStructure {
  isTurborepo: boolean;
  apps: PackageInfo[];
  packages: PackageInfo[];
  workspacePackages: Set<string>;
  /** Resolved config filename ("turbo.json" or "turbo.jsonc"); undefined when not a Turborepo. */
  turboConfigFile?: string;
}
