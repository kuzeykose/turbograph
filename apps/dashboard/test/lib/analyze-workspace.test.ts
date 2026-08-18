import {
  analyzeWorkspace,
  getWorkspacePatterns,
  isWorkspacePackageDir,
  selectWorkspacePackageJsons,
} from "@workspace/graph";

function fileMap(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe("analyzeWorkspace", () => {
  it("returns not-a-turborepo when neither turbo.json nor turbo.jsonc is present", () => {
    const result = analyzeWorkspace(
      fileMap({
        "package.json": JSON.stringify({ name: "root" }),
        "apps/web/package.json": JSON.stringify({ name: "web" }),
      }),
    );

    expect(result.isTurborepo).toBe(false);
    expect(result.apps).toEqual([]);
    expect(result.packages).toEqual([]);
    expect(result.turboConfigFile).toBeUndefined();
  });

  it("prefers turbo.json over turbo.jsonc", () => {
    const result = analyzeWorkspace(
      fileMap({
        "turbo.json": "{}",
        "turbo.jsonc": "{}",
        "package.json": JSON.stringify({
          name: "root",
          workspaces: ["apps/*", "packages/*"],
        }),
        "apps/web/package.json": JSON.stringify({
          name: "web",
          dependencies: { "@repo/ui": "workspace:*" },
        }),
        "packages/ui/package.json": JSON.stringify({ name: "@repo/ui" }),
      }),
    );

    expect(result.isTurborepo).toBe(true);
    expect(result.turboConfigFile).toBe("turbo.json");
  });

  it("falls back to turbo.jsonc", () => {
    const result = analyzeWorkspace(
      fileMap({
        "turbo.jsonc": "{}",
        "pnpm-workspace.yaml": "packages:\n  - apps/*\n  - packages/*\n",
        "apps/cli/package.json": JSON.stringify({ name: "cli" }),
      }),
    );

    expect(result.turboConfigFile).toBe("turbo.jsonc");
    expect(result.apps.map((pkg) => pkg.name)).toEqual(["cli"]);
  });

  it("reads workspace globs from pnpm-workspace.yaml", () => {
    const result = analyzeWorkspace(
      fileMap({
        "turbo.json": "{}",
        "pnpm-workspace.yaml": "packages:\n  - apps/*\n  - packages/*\n",
        "apps/dashboard/package.json": JSON.stringify({
          name: "turbograph-dashboard",
          dependencies: { "@workspace/graph": "workspace:*" },
        }),
        "packages/graph/package.json": JSON.stringify({
          name: "@workspace/graph",
        }),
        "packages/ui/package.json": JSON.stringify({
          name: "@workspace/ui",
        }),
        "examples/demo/package.json": JSON.stringify({ name: "demo" }),
      }),
    );

    expect(result.apps.map((pkg) => pkg.name)).toEqual(["turbograph-dashboard"]);
    expect(result.packages.map((pkg) => pkg.name).sort()).toEqual([
      "@workspace/graph",
      "@workspace/ui",
    ]);
    expect(result.workspacePackages.has("demo")).toBe(false);
  });

  it("honors workspace negation patterns", () => {
    const result = analyzeWorkspace(
      fileMap({
        "turbo.json": "{}",
        "pnpm-workspace.yaml":
          "packages:\n  - packages/*\n  - '!packages/ignored'\n",
        "packages/ui/package.json": JSON.stringify({ name: "@repo/ui" }),
        "packages/ignored/package.json": JSON.stringify({
          name: "@repo/ignored",
        }),
      }),
    );

    expect(result.packages.map((pkg) => pkg.name)).toEqual(["@repo/ui"]);
  });

  it("classifies nested apps/* paths as apps", () => {
    const result = analyzeWorkspace(
      fileMap({
        "turbo.json": "{}",
        "pnpm-workspace.yaml": "packages:\n  - apps/**\n",
        "apps/web/package.json": JSON.stringify({ name: "web" }),
        "apps/shop/storefront/package.json": JSON.stringify({
          name: "storefront",
        }),
      }),
    );

    expect(result.apps.map((pkg) => pkg.name).sort()).toEqual([
      "storefront",
      "web",
    ]);
    expect(result.packages).toEqual([]);
  });

  it("skips package.json files without a name", () => {
    const result = analyzeWorkspace(
      fileMap({
        "turbo.json": "{}",
        "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
        "packages/ui/package.json": JSON.stringify({ name: "@repo/ui" }),
        "packages/broken/package.json": JSON.stringify({}),
      }),
    );

    expect(result.packages.map((pkg) => pkg.name)).toEqual(["@repo/ui"]);
  });
});

describe("getWorkspacePatterns", () => {
  it("defaults to apps/* and packages/* when no workspace config exists", () => {
    expect(getWorkspacePatterns(fileMap({ "turbo.json": "{}" }))).toEqual([
      "apps/*",
      "packages/*",
    ]);
  });

  it("reads npm package.json workspaces arrays", () => {
    expect(
      getWorkspacePatterns(
        fileMap({
          "package.json": JSON.stringify({
            workspaces: ["apps/*", "packages/*"],
          }),
        }),
      ),
    ).toEqual(["apps/*", "packages/*"]);
  });
});

describe("selectWorkspacePackageJsons", () => {
  it("excludes the root package.json", () => {
    expect(
      selectWorkspacePackageJsons(
        ["package.json", "apps/web/package.json", "README.md"],
        ["apps/*"],
      ),
    ).toEqual(["apps/web/package.json"]);
  });

  it("does not match nested dirs against a single-star glob", () => {
    expect(isWorkspacePackageDir("apps/shop/storefront", ["apps/*"])).toBe(
      false,
    );
    expect(isWorkspacePackageDir("apps/web", ["apps/*"])).toBe(true);
  });
});
