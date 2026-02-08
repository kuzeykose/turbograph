/**
 * Information about a package in the monorepo
 */
export interface PackageInfo {
  name: string;
  path: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

/**
 * Represents a dependency relationship between two packages
 */
export interface DependencyEdge {
  from: string;
  to: string;
  type: "dependency" | "devDependency";
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
  type: "dependency" | "devDependency";
}

/**
 * Structure representing a turborepo workspace
 */
export interface TurborepoStructure {
  isTurborepo: boolean;
  apps: PackageInfo[];
  packages: PackageInfo[];
  workspacePackages: Set<string>;
}
