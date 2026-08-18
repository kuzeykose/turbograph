import type { DependencyEdge, PackageInfo } from "./types";
import { posixDirname, toPosixPath } from "./analyze";

export const MAX_IMPORT_SOURCE_FILES = 1500;

const SOURCE_EXT_RE = /\.(?:[cm]?[jt]sx?)$/;
const TEST_FILE_RE = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/;
const SKIP_DIR_RE =
  /(?:^|\/)(?:node_modules|dist|\.next|coverage|\.turbo|build|out)(?:\/|$)/;

/**
 * Whether a repo-relative path is a source file worth scanning for imports.
 */
export function isImportSourceFile(filePath: string): boolean {
  const normalized = toPosixPath(filePath);
  if (SKIP_DIR_RE.test(normalized) || TEST_FILE_RE.test(normalized)) {
    return false;
  }
  return SOURCE_EXT_RE.test(normalized);
}

/**
 * Source files that live under known workspace package directories.
 */
export function selectImportSourceFiles(
  treePaths: Iterable<string>,
  packageDirs: string[],
): string[] {
  const dirs = [...packageDirs]
    .map(toPosixPath)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const selected: string[] = [];

  for (const rawPath of treePaths) {
    const filePath = toPosixPath(rawPath);
    if (!isImportSourceFile(filePath)) {
      continue;
    }
    if (dirs.some((dir) => filePath === dir || filePath.startsWith(`${dir}/`))) {
      selected.push(filePath);
    }
  }

  return selected;
}

function stripJsComments(source: string): string {
  let output = "";
  let index = 0;
  const length = source.length;

  while (index < length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "/" && next === "/") {
      index += 2;
      while (index < length && source[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (
        index < length &&
        !(source[index] === "*" && source[index + 1] === "/")
      ) {
        index += 1;
      }
      index += 2;
      output += " ";
      continue;
    }

    if (char === "'" || char === '"') {
      const quote = char;
      output += char;
      index += 1;
      while (index < length) {
        const current = source[index];
        output += current;
        if (current === "\\") {
          if (index + 1 < length) {
            output += source[index + 1];
            index += 2;
            continue;
          }
        }
        if (current === quote) {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    if (char === "`") {
      output += char;
      index += 1;
      while (index < length) {
        const current = source[index];
        output += current;
        if (current === "\\") {
          if (index + 1 < length) {
            output += source[index + 1];
            index += 2;
            continue;
          }
        }
        if (current === "`") {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}

const SPECIFIER_PATTERNS: RegExp[] = [
  /\b(?:import|export)\b[\s\n]+(?:type\s+)?(?:[\w*{}\s,.$]+?\s+from\s+)['"]([^'"]+)['"]/g,
  /\b(?:import|export)\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]/g,
];

/**
 * Extract module specifiers from JS/TS source.
 */
export function extractImportSpecifiers(source: string): string[] {
  const stripped = stripJsComments(source);
  const specifiers: string[] = [];
  const seen = new Set<string>();

  for (const pattern of SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null = pattern.exec(stripped);
    while (match) {
      const specifier = match[1];
      if (specifier && !seen.has(specifier)) {
        seen.add(specifier);
        specifiers.push(specifier);
      }
      match = pattern.exec(stripped);
    }
  }

  return specifiers;
}

function posixJoinResolve(fromDir: string, specifier: string): string {
  const base = fromDir ? fromDir.split("/").filter(Boolean) : [];
  const parts = specifier.split("/");
  const stack = [...base];

  for (const part of parts) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }

  return stack.join("/");
}

function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  );
}

function packageOwningPath(
  filePath: string,
  packages: PackageInfo[],
): PackageInfo | null {
  const normalized = toPosixPath(filePath);
  for (const pkg of packages) {
    if (normalized === pkg.path || normalized.startsWith(`${pkg.path}/`)) {
      return pkg;
    }
  }
  return null;
}

function resolveSpecifierToPackage(
  fromFile: string,
  specifier: string,
  packages: PackageInfo[],
): PackageInfo | null {
  if (
    specifier.startsWith("node:") ||
    specifier.startsWith("http:") ||
    specifier.startsWith("https:") ||
    specifier.startsWith("data:")
  ) {
    return null;
  }

  if (isRelativeSpecifier(specifier)) {
    const resolved = posixJoinResolve(posixDirname(fromFile), specifier);
    const withoutExt = resolved.replace(/\.(?:[cm]?[jt]sx?)$/, "");
    return (
      packageOwningPath(withoutExt, packages) ??
      packageOwningPath(resolved, packages)
    );
  }

  for (const pkg of packages) {
    if (specifier === pkg.name || specifier.startsWith(`${pkg.name}/`)) {
      return pkg;
    }
  }

  return null;
}

/**
 * Build package-level import edges from an in-memory source map.
 */
export function buildImportGraph(
  files: ReadonlyMap<string, string>,
  apps: PackageInfo[],
  packages: PackageInfo[],
): DependencyEdge[] {
  const allPackages = [...apps, ...packages].sort(
    (a, b) => b.path.length - a.path.length,
  );
  const counts = new Map<string, number>();

  for (const [filePath, content] of files) {
    const owner = packageOwningPath(filePath, allPackages);
    if (!owner) {
      continue;
    }

    for (const specifier of extractImportSpecifiers(content)) {
      const target = resolveSpecifierToPackage(
        filePath,
        specifier,
        allPackages,
      );
      if (!target || target.name === owner.name) {
        continue;
      }

      const key = `${owner.name}\0${target.name}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()].map(([key, count]) => {
    const separator = key.indexOf("\0");
    return {
      from: key.slice(0, separator),
      to: key.slice(separator + 1),
      type: "import" as const,
      count,
    };
  });
}
