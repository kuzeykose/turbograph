import type {
  DependencyEdge,
  ImportFileNode,
  ImportGraph,
  PackageInfo,
} from "./types";
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

const RESOLVE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
] as const;

function hasSourceExtension(filePath: string): boolean {
  return SOURCE_EXT_RE.test(filePath);
}

function matchExistingFile(
  candidate: string,
  fileSet: Set<string>,
): string | null {
  const normalized = toPosixPath(candidate);
  if (fileSet.has(normalized)) {
    return normalized;
  }

  if (!hasSourceExtension(normalized)) {
    for (const ext of RESOLVE_EXTENSIONS) {
      const withExt = `${normalized}${ext}`;
      if (fileSet.has(withExt)) {
        return withExt;
      }
    }

    for (const ext of RESOLVE_EXTENSIONS) {
      const indexFile = `${normalized}/index${ext}`;
      if (fileSet.has(indexFile)) {
        return indexFile;
      }
    }
  }

  return null;
}

function resolveRelativeFile(
  fromFile: string,
  specifier: string,
  fileSet: Set<string>,
): string | null {
  const resolved = posixJoinResolve(posixDirname(fromFile), specifier);
  return matchExistingFile(resolved, fileSet);
}

function resolveInsidePackage(
  pkg: PackageInfo,
  subpath: string,
  fileSet: Set<string>,
): string | null {
  const remainder = subpath.replace(/^\.\/+/, "");
  const bases = remainder
    ? [`${pkg.path}/${remainder}`, `${pkg.path}/src/${remainder}`]
    : [pkg.path, `${pkg.path}/src`, `${pkg.path}/index`, `${pkg.path}/src/index`];

  for (const base of bases) {
    const match = matchExistingFile(base, fileSet);
    if (match) {
      return match;
    }
  }

  return null;
}

/**
 * Resolve an import specifier to a workspace source file path, if it exists
 * in `fileSet`.
 */
export function resolveImportToFile(
  fromFile: string,
  specifier: string,
  packages: PackageInfo[],
  fileSet: Set<string>,
): string | null {
  if (
    specifier.startsWith("node:") ||
    specifier.startsWith("http:") ||
    specifier.startsWith("https:") ||
    specifier.startsWith("data:")
  ) {
    return null;
  }

  const owner = packageOwningPath(fromFile, packages);

  if (isRelativeSpecifier(specifier)) {
    return resolveRelativeFile(fromFile, specifier, fileSet);
  }

  // `@/foo` and `~/foo` are treated as aliases of the owning package root.
  if (owner && (specifier.startsWith("@/") || specifier.startsWith("~/"))) {
    return resolveInsidePackage(owner, specifier.slice(2), fileSet);
  }

  for (const pkg of packages) {
    if (specifier === pkg.name) {
      return resolveInsidePackage(pkg, "", fileSet);
    }
    if (specifier.startsWith(`${pkg.name}/`)) {
      return resolveInsidePackage(
        pkg,
        specifier.slice(pkg.name.length + 1),
        fileSet,
      );
    }
  }

  return null;
}

function packageKind(
  pkg: PackageInfo,
  apps: PackageInfo[],
): "app" | "package" {
  return apps.some((app) => app.name === pkg.name) ? "app" : "package";
}

/**
 * Convert file nodes into the apps/packages shape the existing layout uses.
 * `PackageInfo.name` is the file path so each file is a distinct node.
 */
export function importFilesToLayoutNodes(files: ImportFileNode[]): {
  apps: PackageInfo[];
  packages: PackageInfo[];
} {
  const toInfo = (file: ImportFileNode): PackageInfo => ({
    name: file.path,
    path: file.path,
    dependencies: {},
    devDependencies: {},
  });

  return {
    apps: files.filter((file) => file.type === "app").map(toInfo),
    packages: files.filter((file) => file.type === "package").map(toInfo),
  };
}

/**
 * Build a file-to-file import graph from an in-memory source map.
 * Nodes are source files; edges mean "this file imports that file".
 */
export function buildImportGraph(
  files: ReadonlyMap<string, string>,
  apps: PackageInfo[],
  packages: PackageInfo[],
): ImportGraph {
  const allPackages = [...apps, ...packages].sort(
    (a, b) => b.path.length - a.path.length,
  );
  const fileSet = new Set(files.keys());
  const edgeKeys = new Set<string>();
  const edges: DependencyEdge[] = [];
  const usedFiles = new Set<string>();

  for (const [filePath, content] of files) {
    if (!packageOwningPath(filePath, allPackages)) {
      continue;
    }

    for (const specifier of extractImportSpecifiers(content)) {
      const target = resolveImportToFile(
        filePath,
        specifier,
        allPackages,
        fileSet,
      );
      if (!target || target === filePath) {
        continue;
      }

      const key = `${filePath}\0${target}`;
      if (edgeKeys.has(key)) {
        continue;
      }
      edgeKeys.add(key);
      usedFiles.add(filePath);
      usedFiles.add(target);
      edges.push({
        from: filePath,
        to: target,
        type: "import",
      });
    }
  }

  const fileNodes: ImportFileNode[] = [...usedFiles].sort().flatMap((filePath) => {
    const owner = packageOwningPath(filePath, allPackages);
    if (!owner) {
      return [];
    }
    return [
      {
        path: filePath,
        packageName: owner.name,
        type: packageKind(owner, apps),
      },
    ];
  });

  return { files: fileNodes, edges };
}
