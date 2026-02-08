import { githubService } from "@/lib/services/github";
import { ContentItem } from "@/types/repository";

// Re-export types from shared graph package
export type {
  PackageInfo,
  DependencyEdge,
  TurborepoStructure,
  GraphNode,
  GraphEdge,
} from "@workspace/graph";

// Re-export graph utilities from shared package
export {
  buildDependencyGraph,
  calculateGraphLayout,
  getAffectedPackages,
  getDownstreamDependents,
  nodeColors,
  edgeColors,
} from "@workspace/graph";

import type { PackageInfo, TurborepoStructure } from "@workspace/graph";

/**
 * Check if a repository is a Turborepo by looking for turbo.json
 */
export async function checkIsTurborepo(
  owner: string,
  repo: string,
  token: string
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
  token: string
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
  token: string
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
  token: string
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
      appFolders.map((folder) => fetchPackageJson(owner, repo, folder, token))
    ),
    Promise.all(
      packageFolders.map((folder) =>
        fetchPackageJson(owner, repo, folder, token)
      )
    ),
  ]);

  // Filter out null results
  const validApps = apps.filter((app): app is PackageInfo => app !== null);
  const validPackages = packages.filter(
    (pkg): pkg is PackageInfo => pkg !== null
  );

  // Create a set of workspace package names
  const workspacePackages = new Set<string>(
    [...validApps, ...validPackages].map((pkg) => pkg.name)
  );

  return {
    isTurborepo: true,
    apps: validApps,
    packages: validPackages,
    workspacePackages,
  };
}
