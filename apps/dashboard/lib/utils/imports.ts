import { githubService } from "@/lib/services/github";
import {
  MAX_IMPORT_SOURCE_FILES,
  buildImportGraph,
  selectImportSourceFiles,
} from "@workspace/graph";
import type { ImportGraph, TurborepoStructure } from "@workspace/graph";
import type { GitBlobRef } from "@/types/github";

export interface ImportGraphResult extends ImportGraph {
  scannedFiles: number;
  truncated: boolean;
}

/**
 * Scan workspace source files and build a file-to-file import graph.
 * Reuses the cached recursive git tree; fetches blob text only for source files.
 */
export async function analyzeImportGraph(
  owner: string,
  repo: string,
  structure: TurborepoStructure,
  ref: string = "HEAD",
): Promise<ImportGraphResult> {
  const packageDirs = [
    ...structure.apps.map((pkg) => pkg.path),
    ...structure.packages.map((pkg) => pkg.path),
  ];

  const tree = await githubService.getRecursiveTree(owner, repo, ref);
  const blobsByPath = new Map(
    tree
      .filter((item) => item.type === "blob")
      .map((item) => [item.path, item] as const),
  );

  const allSourcePaths = selectImportSourceFiles(
    blobsByPath.keys(),
    packageDirs,
  );
  const truncated = allSourcePaths.length > MAX_IMPORT_SOURCE_FILES;
  const sourcePaths = truncated
    ? allSourcePaths.slice(0, MAX_IMPORT_SOURCE_FILES)
    : allSourcePaths;

  const blobs: GitBlobRef[] = sourcePaths.flatMap((path) => {
    const item = blobsByPath.get(path);
    return item ? [{ path, sha: item.sha }] : [];
  });

  const files = await githubService.getBlobTexts(owner, repo, blobs);
  const graph = buildImportGraph(files, structure.apps, structure.packages);

  return {
    ...graph,
    scannedFiles: files.size,
    truncated,
  };
}
