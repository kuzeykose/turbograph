import {
  buildImportGraph,
  extractImportSpecifiers,
  isImportSourceFile,
  resolveImportToFile,
  selectImportSourceFiles,
} from "@workspace/graph";

describe("extractImportSpecifiers", () => {
  it("finds ESM imports, re-exports, dynamic import, and require", () => {
    const source = `
      import { graph } from "@workspace/graph";
      import type { PackageInfo } from "@workspace/graph/types";
      import "./local";
      export { Button } from "@workspace/ui";
      export * from "@workspace/ui/button";
      const mod = await import("@workspace/graph/layout");
      const extra = require("@workspace/eslint-config");
    `;

    expect(extractImportSpecifiers(source).sort()).toEqual([
      "./local",
      "@workspace/eslint-config",
      "@workspace/graph",
      "@workspace/graph/layout",
      "@workspace/graph/types",
      "@workspace/ui",
      "@workspace/ui/button",
    ]);
  });

  it("ignores specifiers inside comments", () => {
    const source = `
      // import { x } from "commented";
      /* import { y } from "blocked"; */
      import { real } from "@workspace/graph";
    `;

    expect(extractImportSpecifiers(source)).toEqual(["@workspace/graph"]);
  });
});

describe("selectImportSourceFiles", () => {
  it("keeps package source and skips tests, dist, and node_modules", () => {
    expect(
      selectImportSourceFiles(
        [
          "apps/dashboard/app/page.tsx",
          "apps/dashboard/test/lib/analyze-workspace.test.ts",
          "packages/graph/src/index.ts",
          "packages/graph/dist/index.js",
          "packages/graph/node_modules/yaml/index.js",
          "README.md",
        ],
        ["apps/dashboard", "packages/graph"],
      ),
    ).toEqual(["apps/dashboard/app/page.tsx", "packages/graph/src/index.ts"]);
  });

  it("rejects non-source paths", () => {
    expect(isImportSourceFile("packages/graph/src/index.ts")).toBe(true);
    expect(isImportSourceFile("packages/graph/src/index.test.ts")).toBe(false);
    expect(isImportSourceFile("pnpm-lock.yaml")).toBe(false);
  });
});

const dashboard = {
  name: "turbograph-dashboard",
  path: "apps/dashboard",
  dependencies: {},
  devDependencies: {},
};
const graphPkg = {
  name: "@workspace/graph",
  path: "packages/graph",
  dependencies: {},
  devDependencies: {},
};
const uiPkg = {
  name: "@workspace/ui",
  path: "packages/ui",
  dependencies: {},
  devDependencies: {},
};

describe("resolveImportToFile", () => {
  const fileSet = new Set([
    "apps/dashboard/app/page.tsx",
    "apps/dashboard/app/header.tsx",
    "apps/dashboard/lib/utils.ts",
    "packages/graph/src/index.ts",
    "packages/graph/src/layout.ts",
    "packages/ui/src/index.ts",
    "packages/ui/src/components/button.tsx",
  ]);

  it("resolves relative imports including omitted extensions", () => {
    expect(
      resolveImportToFile(
        "apps/dashboard/app/page.tsx",
        "./header",
        [dashboard, graphPkg, uiPkg],
        fileSet,
      ),
    ).toBe("apps/dashboard/app/header.tsx");
  });

  it("resolves @/ aliases to the owning package", () => {
    expect(
      resolveImportToFile(
        "apps/dashboard/app/page.tsx",
        "@/lib/utils",
        [dashboard, graphPkg, uiPkg],
        fileSet,
      ),
    ).toBe("apps/dashboard/lib/utils.ts");
  });

  it("resolves workspace package names and subpaths", () => {
    expect(
      resolveImportToFile(
        "apps/dashboard/app/page.tsx",
        "@workspace/graph",
        [dashboard, graphPkg, uiPkg],
        fileSet,
      ),
    ).toBe("packages/graph/src/index.ts");
    expect(
      resolveImportToFile(
        "apps/dashboard/app/page.tsx",
        "@workspace/graph/layout",
        [dashboard, graphPkg, uiPkg],
        fileSet,
      ),
    ).toBe("packages/graph/src/layout.ts");
  });
});

describe("buildImportGraph", () => {
  it("creates file-to-file edges for relative, alias, and workspace imports", () => {
    const files = new Map<string, string>([
      [
        "apps/dashboard/app/page.tsx",
        `import { Header } from "./header";
         import { cn } from "@/lib/utils";
         import { calculateGraphLayout } from "@workspace/graph";`,
      ],
      [
        "apps/dashboard/app/header.tsx",
        `import { Button } from "@workspace/ui/components/button";`,
      ],
      ["apps/dashboard/lib/utils.ts", `export const cn = () => "";`],
      [
        "packages/graph/src/index.ts",
        `import { calculateGraphLayout } from "./layout";`,
      ],
      ["packages/graph/src/layout.ts", `export function calculateGraphLayout() {}`],
      ["packages/ui/src/index.ts", `export {}`],
      [
        "packages/ui/src/components/button.tsx",
        `export function Button() { return null; }`,
      ],
    ]);

    const result = buildImportGraph(files, [dashboard], [graphPkg, uiPkg]);
    const pairs = result.edges
      .map((edge) => `${edge.from} -> ${edge.to}`)
      .sort();

    expect(pairs).toEqual([
      "apps/dashboard/app/header.tsx -> packages/ui/src/components/button.tsx",
      "apps/dashboard/app/page.tsx -> apps/dashboard/app/header.tsx",
      "apps/dashboard/app/page.tsx -> apps/dashboard/lib/utils.ts",
      "apps/dashboard/app/page.tsx -> packages/graph/src/index.ts",
      "packages/graph/src/index.ts -> packages/graph/src/layout.ts",
    ]);
    expect(
      result.files.map((file) => file.path).sort(),
    ).toEqual([
      "apps/dashboard/app/header.tsx",
      "apps/dashboard/app/page.tsx",
      "apps/dashboard/lib/utils.ts",
      "packages/graph/src/index.ts",
      "packages/graph/src/layout.ts",
      "packages/ui/src/components/button.tsx",
    ]);
  });
});
