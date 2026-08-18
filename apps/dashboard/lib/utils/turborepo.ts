import { githubService } from "@/lib/services/github";

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

import {
  TURBO_CONFIG_FILENAMES,
  analyzeWorkspace,
  getWorkspacePatterns,
  selectWorkspacePackageJsons,
} from "@workspace/graph";
import type { GitBlobRef } from "@/types/github";
import type { TurborepoStructure } from "@workspace/graph";

const ROOT_ANALYSIS_FILES = [
  ...TURBO_CONFIG_FILENAMES,
  "pnpm-workspace.yaml",
  "package.json",
] as const;

/**
 * Analyze a GitHub Turborepo: one recursive tree (paths only), then blob
 * fetches for workspace config and matching package.json files.
 */
export async function analyzeTurborepo(
  owner: string,
  repo: string,
  ref: string = "HEAD",
): Promise<TurborepoStructure> {
  const tree = await githubService.getRecursiveTree(owner, repo, ref);
  const blobsByPath = new Map(
    tree
      .filter((item) => item.type === "blob")
      .map((item) => [item.path, item] as const),
  );

  const turboConfigFile =
    TURBO_CONFIG_FILENAMES.find((filename) => blobsByPath.has(filename)) ??
    null;

  if (!turboConfigFile) {
    return {
      isTurborepo: false,
      apps: [],
      packages: [],
      workspacePackages: new Set(),
    };
  }

  const rootBlobs: GitBlobRef[] = ROOT_ANALYSIS_FILES.filter((path) =>
    blobsByPath.has(path),
  ).map((path) => ({
    path,
    sha: blobsByPath.get(path)!.sha,
  }));

  const files = await githubService.getBlobTexts(owner, repo, rootBlobs);
  if (!files.has(turboConfigFile)) {
    throw new Error(`Failed to load ${turboConfigFile} from ${owner}/${repo}`);
  }
  const patterns = getWorkspacePatterns(files);
  const packageJsonPaths = selectWorkspacePackageJsons(
    blobsByPath.keys(),
    patterns,
  );

  const packageBlobs: GitBlobRef[] = packageJsonPaths.flatMap((path) => {
    const item = blobsByPath.get(path);
    return item ? [{ path, sha: item.sha }] : [];
  });

  const packageFiles = await githubService.getBlobTexts(
    owner,
    repo,
    packageBlobs,
  );
  for (const [path, content] of packageFiles) {
    files.set(path, content);
  }

  return analyzeWorkspace(files);
}
