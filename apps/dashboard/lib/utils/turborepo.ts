import { githubService } from "@/lib/services/github";
import { ContentItem } from "@/types/repository";

export interface PackageInfo {
  name: string;
  path: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface TurborepoStructure {
  isTurborepo: boolean;
  apps: PackageInfo[];
  packages: PackageInfo[];
  workspacePackages: Set<string>;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: "dependency" | "devDependency";
}

/**
 * Check if a repository is a Turborepo by looking for turbo.json
 */
export async function checkIsTurborepo(
  owner: string,
  repo: string,
  token: string,
): Promise<boolean> {
  try {
    return await githubService.checkFileExists(owner, repo, "turbo.json");
  } catch {
    return false;
  }
}

/**
 * Fetch and parse package.json from a specific path
 */
async function fetchPackageJson(
  owner: string,
  repo: string,
  path: string,
  token: string,
): Promise<PackageInfo | null> {
  return await githubService.getPackageJson(owner, repo, path);
}

/**
 * Fetch all folders in a directory
 */
async function fetchFolders(
  owner: string,
  repo: string,
  path: string,
  token: string,
): Promise<string[]> {
  try {
    const data = await githubService.getContents(owner, repo, path);

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter((item: ContentItem) => item.type === "dir")
      .map((item: ContentItem) => item.path);
  } catch (error) {
    console.error(`Error fetching folders from ${path}:`, error);
    return [];
  }
}

/**
 * Analyze Turborepo structure and dependencies
 */
export async function analyzeTurborepo(
  owner: string,
  repo: string,
  token: string,
): Promise<TurborepoStructure> {
  const isTurborepo = await checkIsTurborepo(owner, repo, token);

  if (!isTurborepo) {
    return {
      isTurborepo: false,
      apps: [],
      packages: [],
      workspacePackages: new Set(),
    };
  }

  // Fetch apps and packages folders
  const [appFolders, packageFolders] = await Promise.all([
    fetchFolders(owner, repo, "apps", token),
    fetchFolders(owner, repo, "packages", token),
  ]);

  // Fetch all package.json files
  const [apps, packages] = await Promise.all([
    Promise.all(
      appFolders.map((folder) => fetchPackageJson(owner, repo, folder, token)),
    ),
    Promise.all(
      packageFolders.map((folder) =>
        fetchPackageJson(owner, repo, folder, token),
      ),
    ),
  ]);

  // Filter out null results
  const validApps = apps.filter((app): app is PackageInfo => app !== null);
  const validPackages = packages.filter(
    (pkg): pkg is PackageInfo => pkg !== null,
  );

  // Create a set of workspace package names
  const workspacePackages = new Set<string>(
    [...validApps, ...validPackages].map((pkg) => pkg.name),
  );

  return {
    isTurborepo: true,
    apps: validApps,
    packages: validPackages,
    workspacePackages,
  };
}

/**
 * Build dependency graph from Turborepo structure
 */
export function buildDependencyGraph(
  structure: TurborepoStructure,
): DependencyEdge[] {
  const edges: DependencyEdge[] = [];

  // Check which apps depend on which packages
  for (const app of structure.apps) {
    // Check regular dependencies
    for (const [depName, depVersion] of Object.entries(app.dependencies)) {
      if (structure.workspacePackages.has(depName)) {
        edges.push({
          from: app.name,
          to: depName,
          type: "dependency",
        });
      }
    }

    // Check dev dependencies
    for (const [depName, depVersion] of Object.entries(app.devDependencies)) {
      if (structure.workspacePackages.has(depName)) {
        edges.push({
          from: app.name,
          to: depName,
          type: "devDependency",
        });
      }
    }
  }

  // Also check if packages depend on other packages
  for (const pkg of structure.packages) {
    for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
      if (structure.workspacePackages.has(depName)) {
        edges.push({
          from: pkg.name,
          to: depName,
          type: "dependency",
        });
      }
    }

    for (const [depName, depVersion] of Object.entries(pkg.devDependencies)) {
      if (structure.workspacePackages.has(depName)) {
        edges.push({
          from: pkg.name,
          to: depName,
          type: "devDependency",
        });
      }
    }
  }

  return edges;
}

/**
 * Get affected packages based on changed file paths
 */
export function getAffectedPackages(
  changedFiles: string[],
  structure: TurborepoStructure,
): string[] {
  const affectedPackages = new Set<string>();

  for (const file of changedFiles) {
    // Check if file is in apps folder
    for (const app of structure.apps) {
      if (file.startsWith(`${app.path}/`)) {
        affectedPackages.add(app.name);
      }
    }

    // Check if file is in packages folder
    for (const pkg of structure.packages) {
      if (file.startsWith(`${pkg.path}/`)) {
        affectedPackages.add(pkg.name);
      }
    }
  }

  return Array.from(affectedPackages);
}

/**
 * Get all packages that depend on the affected packages (downstream dependents)
 * This performs a reverse lookup on the dependency graph
 */
export function getDownstreamDependents(
  affectedPackages: string[],
  dependencyGraph: DependencyEdge[],
): string[] {
  const dependents = new Set<string>();

  // Find all packages that depend on any of the affected packages
  for (const edge of dependencyGraph) {
    if (affectedPackages.includes(edge.to)) {
      dependents.add(edge.from);
    }
  }

  // Recursively find dependents of dependents (transitive dependencies)
  const currentDependents = Array.from(dependents);
  for (const dependent of currentDependents) {
    const transitives = getDownstreamDependents([dependent], dependencyGraph);
    transitives.forEach((d) => dependents.add(d));
  }

  return Array.from(dependents);
}
