import * as fs from "node:fs";
import * as path from "node:path";
import { glob } from "glob";
import {
  TURBO_CONFIG_FILENAMES,
  analyzeWorkspace,
  getWorkspacePatterns,
  toPosixPath,
} from "@workspace/graph";
import type { TurborepoStructure } from "@workspace/graph";

/**
 * Resolve which Turborepo config file the directory uses, in turbo's own
 * resolution order. Returns null when the directory has neither.
 */
export function resolveTurboConfigFile(rootDir: string): string | null {
  return (
    TURBO_CONFIG_FILENAMES.find((filename) =>
      fs.existsSync(path.join(rootDir, filename))
    ) ?? null
  );
}

function readTextIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Analyze the local Turborepo structure by reading workspace config and
 * package.json files, then delegating to the shared analyzer.
 */
export async function analyzeTurborepo(
  rootDir: string
): Promise<TurborepoStructure> {
  const files = new Map<string, string>();

  for (const filename of [
    ...TURBO_CONFIG_FILENAMES,
    "pnpm-workspace.yaml",
    "package.json",
  ]) {
    const content = readTextIfExists(path.join(rootDir, filename));
    if (content !== null) {
      files.set(filename, content);
    }
  }

  const patterns = getWorkspacePatterns(files);

  for (const pattern of patterns) {
    if (pattern.startsWith("!")) {
      continue;
    }

    const fullPattern = path.join(rootDir, pattern);
    const matches = await glob(fullPattern, { absolute: true, dot: true });

    for (const match of matches) {
      if (!fs.existsSync(match) || !fs.statSync(match).isDirectory()) {
        continue;
      }

      const packageJsonPath = path.join(match, "package.json");
      const content = readTextIfExists(packageJsonPath);
      if (content === null) {
        continue;
      }

      const relativeDir = toPosixPath(path.relative(rootDir, match));
      const relativeFile = relativeDir
        ? `${relativeDir}/package.json`
        : "package.json";
      files.set(relativeFile, content);
    }
  }

  return analyzeWorkspace(files);
}
