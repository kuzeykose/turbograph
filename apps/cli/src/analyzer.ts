import * as fs from "node:fs";
import * as path from "node:path";
import { glob } from "glob";
import { parse as parseYaml } from "yaml";
import type { PackageInfo, TurborepoStructure } from "@workspace/graph";

/**
 * Check if the current directory is a Turborepo by looking for turbo.json
 */
export function checkIsTurborepo(rootDir: string): boolean {
  const turboJsonPath = path.join(rootDir, "turbo.json");
  return fs.existsSync(turboJsonPath);
}

/**
 * Parse pnpm-workspace.yaml to get workspace patterns
 */
function getWorkspacePatterns(rootDir: string): string[] {
  const workspaceYamlPath = path.join(rootDir, "pnpm-workspace.yaml");

  if (fs.existsSync(workspaceYamlPath)) {
    const content = fs.readFileSync(workspaceYamlPath, "utf-8");
    const parsed = parseYaml(content) as { packages?: string[] };
    return parsed.packages ?? ["apps/*", "packages/*"];
  }

  // Fallback to package.json workspaces
  const packageJsonPath = path.join(rootDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const content = fs.readFileSync(packageJsonPath, "utf-8");
    const parsed = JSON.parse(content) as {
      workspaces?: string[] | { packages?: string[] };
    };
    if (Array.isArray(parsed.workspaces)) {
      return parsed.workspaces;
    }
    if (parsed.workspaces?.packages) {
      return parsed.workspaces.packages;
    }
  }

  // Default patterns
  return ["apps/*", "packages/*"];
}

/**
 * Read and parse package.json from a directory
 */
function readPackageJson(packageDir: string): PackageInfo | null {
  const packageJsonPath = path.join(packageDir, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(packageJsonPath, "utf-8");
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
      path: packageDir,
      dependencies: parsed.dependencies ?? {},
      devDependencies: parsed.devDependencies ?? {},
    };
  } catch {
    return null;
  }
}

/**
 * Determine if a package is an "app" or a "package" based on its path
 */
function getPackageType(
  packagePath: string,
  rootDir: string
): "app" | "package" {
  const relativePath = path.relative(rootDir, packagePath);
  if (relativePath.startsWith("apps")) {
    return "app";
  }
  return "package";
}

/**
 * Analyze the local Turborepo structure
 */
export async function analyzeTurborepo(
  rootDir: string
): Promise<TurborepoStructure> {
  const isTurborepo = checkIsTurborepo(rootDir);

  if (!isTurborepo) {
    return {
      isTurborepo: false,
      apps: [],
      packages: [],
      workspacePackages: new Set(),
    };
  }

  const patterns = getWorkspacePatterns(rootDir);
  const apps: PackageInfo[] = [];
  const packages: PackageInfo[] = [];

  // Find all package directories matching workspace patterns
  for (const pattern of patterns) {
    const fullPattern = path.join(rootDir, pattern);
    const matches = await glob(fullPattern, { absolute: true });

    for (const match of matches) {
      // Only process directories
      if (!fs.existsSync(match) || !fs.statSync(match).isDirectory()) {
        continue;
      }

      const packageInfo = readPackageJson(match);
      if (packageInfo) {
        const type = getPackageType(match, rootDir);
        if (type === "app") {
          apps.push(packageInfo);
        } else {
          packages.push(packageInfo);
        }
      }
    }
  }

  // Create a set of all workspace package names
  const workspacePackages = new Set<string>(
    [...apps, ...packages].map((pkg) => pkg.name)
  );

  return {
    isTurborepo: true,
    apps,
    packages,
    workspacePackages,
  };
}
