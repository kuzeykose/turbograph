import { parse as parseYaml } from "yaml";
import { minimatch } from "minimatch";
import { TURBO_CONFIG_FILENAMES } from "./constants";
import type { PackageInfo, TurborepoStructure } from "./types";

const DEFAULT_WORKSPACE_PATTERNS = ["apps/*", "packages/*"];

/**
 * Normalize a repo-relative path to posix (forward slashes, no leading slash).
 */
export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\/+/, "");
}

/**
 * Posix dirname of a repo-relative path. `apps/cli/package.json` → `apps/cli`.
 */
export function posixDirname(filePath: string): string {
  const normalized = toPosixPath(filePath).replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) {
    return "";
  }
  return normalized.slice(0, index);
}

/**
 * Resolve which Turborepo config file is present, in turbo's own order.
 */
export function resolveTurboConfigFileFromFiles(
  files: ReadonlyMap<string, string>,
): string | null {
  return (
    TURBO_CONFIG_FILENAMES.find((filename) => files.has(filename)) ?? null
  );
}

/**
 * Workspace globs from pnpm-workspace.yaml or package.json workspaces.
 */
export function getWorkspacePatterns(
  files: ReadonlyMap<string, string>,
): string[] {
  const workspaceYaml = files.get("pnpm-workspace.yaml");
  if (workspaceYaml !== undefined) {
    try {
      const parsed = parseYaml(workspaceYaml) as { packages?: unknown };
      if (Array.isArray(parsed?.packages) && parsed.packages.length > 0) {
        return parsed.packages.filter(
          (pattern): pattern is string => typeof pattern === "string",
        );
      }
    } catch {
      // Fall through to package.json / defaults
    }
  }

  const packageJson = files.get("package.json");
  if (packageJson !== undefined) {
    try {
      const parsed = JSON.parse(packageJson) as {
        workspaces?: string[] | { packages?: string[] };
      };
      const workspaces = parsed.workspaces;
      if (Array.isArray(workspaces) && workspaces.length > 0) {
        return workspaces;
      }
      if (
        workspaces &&
        !Array.isArray(workspaces) &&
        workspaces.packages &&
        workspaces.packages.length > 0
      ) {
        return workspaces.packages;
      }
    } catch {
      // Fall through to defaults
    }
  }

  return DEFAULT_WORKSPACE_PATTERNS;
}

/**
 * Whether a package directory (repo-relative, posix) is included by workspace globs.
 */
export function isWorkspacePackageDir(
  packageDir: string,
  patterns: string[],
): boolean {
  const dir = toPosixPath(packageDir);
  if (!dir) {
    return patterns.some(
      (pattern) => pattern === "." || pattern === "./" || pattern === "*",
    );
  }

  const positives = patterns.filter((pattern) => !pattern.startsWith("!"));
  const negatives = patterns
    .filter((pattern) => pattern.startsWith("!"))
    .map((pattern) => pattern.slice(1));

  const matched = positives.some((pattern) =>
    minimatch(dir, pattern, { dot: true }),
  );
  if (!matched) {
    return false;
  }

  return !negatives.some((pattern) => minimatch(dir, pattern, { dot: true }));
}

/**
 * `package.json` paths under workspace package directories.
 * Root `package.json` is excluded (it is workspace config, not a graph node).
 */
export function selectWorkspacePackageJsons(
  treePaths: Iterable<string>,
  patterns: string[],
): string[] {
  const selected: string[] = [];

  for (const rawPath of treePaths) {
    const filePath = toPosixPath(rawPath);
    if (filePath === "package.json" || !filePath.endsWith("/package.json")) {
      continue;
    }

    const packageDir = posixDirname(filePath);
    if (isWorkspacePackageDir(packageDir, patterns)) {
      selected.push(filePath);
    }
  }

  return selected;
}

function parsePackageJson(
  filePath: string,
  content: string,
): PackageInfo | null {
  try {
    const parsed = JSON.parse(content) as {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    if (!parsed.name) {
      return null;
    }

    return {
      name: parsed.name,
      path: posixDirname(filePath),
      dependencies: parsed.dependencies ?? {},
      devDependencies: parsed.devDependencies ?? {},
    };
  } catch {
    return null;
  }
}

function getPackageType(packageDir: string): "app" | "package" {
  return packageDir === "apps" || packageDir.startsWith("apps/")
    ? "app"
    : "package";
}

/**
 * Analyze a Turborepo from an in-memory map of repo-relative path → file text.
 * Only workspace config and package.json files are required.
 */
export function analyzeWorkspace(
  files: ReadonlyMap<string, string>,
): TurborepoStructure {
  const turboConfigFile = resolveTurboConfigFileFromFiles(files);

  if (!turboConfigFile) {
    return {
      isTurborepo: false,
      apps: [],
      packages: [],
      workspacePackages: new Set(),
    };
  }

  const patterns = getWorkspacePatterns(files);
  const apps: PackageInfo[] = [];
  const packages: PackageInfo[] = [];
  const seen = new Set<string>();

  for (const filePath of selectWorkspacePackageJsons(files.keys(), patterns)) {
    const content = files.get(filePath);
    if (content === undefined) {
      continue;
    }

    const packageInfo = parsePackageJson(filePath, content);
    if (!packageInfo || seen.has(packageInfo.path)) {
      continue;
    }
    seen.add(packageInfo.path);

    if (getPackageType(packageInfo.path) === "app") {
      apps.push(packageInfo);
    } else {
      packages.push(packageInfo);
    }
  }

  return {
    isTurborepo: true,
    apps,
    packages,
    workspacePackages: new Set(
      [...apps, ...packages].map((pkg) => pkg.name),
    ),
    turboConfigFile,
  };
}
