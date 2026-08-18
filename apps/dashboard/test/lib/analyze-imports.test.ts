import {
  buildImportGraph,
  extractImportSpecifiers,
  isImportSourceFile,
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

describe("buildImportGraph", () => {
  it("aggregates workspace imports and skips self-imports", () => {
    const files = new Map<string, string>([
      [
        "apps/dashboard/app/page.tsx",
        `import { calculateGraphLayout } from "@workspace/graph";
         import { Button } from "@workspace/ui";
         import { Header } from "./header";`,
      ],
      [
        "apps/dashboard/app/header.tsx",
        `import { cn } from "@workspace/ui";`,
      ],
      [
        "packages/graph/src/index.ts",
        `import { nodeColors } from "./colors";`,
      ],
    ]);

    const edges = buildImportGraph(
      files,
      [
        {
          name: "turbograph-dashboard",
          path: "apps/dashboard",
          dependencies: {},
          devDependencies: {},
        },
      ],
      [
        {
          name: "@workspace/graph",
          path: "packages/graph",
          dependencies: {},
          devDependencies: {},
        },
        {
          name: "@workspace/ui",
          path: "packages/ui",
          dependencies: {},
          devDependencies: {},
        },
      ],
    );

    const byPair = Object.fromEntries(
      edges.map((edge) => [`${edge.from}->${edge.to}`, edge.count]),
    );

    expect(byPair["turbograph-dashboard->@workspace/graph"]).toBe(1);
    expect(byPair["turbograph-dashboard->@workspace/ui"]).toBe(2);
    expect(byPair["@workspace/graph->@workspace/graph"]).toBeUndefined();
    expect(edges.every((edge) => edge.type === "import")).toBe(true);
  });

  it("resolves relative imports that cross package boundaries", () => {
    const files = new Map<string, string>([
      [
        "apps/web/src/app.ts",
        `import { theme } from "../../../packages/ui/src/theme";`,
      ],
    ]);

    const edges = buildImportGraph(
      files,
      [
        {
          name: "web",
          path: "apps/web",
          dependencies: {},
          devDependencies: {},
        },
      ],
      [
        {
          name: "@repo/ui",
          path: "packages/ui",
          dependencies: {},
          devDependencies: {},
        },
      ],
    );

    expect(edges).toEqual([
      { from: "web", to: "@repo/ui", type: "import", count: 1 },
    ]);
  });
});
