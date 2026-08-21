import { searchNodes } from "@/components/graph/node-search";
import type { SearchableNode } from "@/components/graph/node-search";

const node = (name: string): SearchableNode => ({
  id: name,
  name,
  type: "package",
});

const nodes = [
  node("packages/turbo-utils/src/index.ts"),
  node("packages/ui/src/utils.ts"),
  node("packages/ui/src/button.tsx"),
  node("utils"),
  node("packages/utils-extra/src/index.ts"),
];

describe("searchNodes", () => {
  it("matches nothing until something is typed", () => {
    expect(searchNodes(nodes, "")).toEqual([]);
    expect(searchNodes(nodes, "   ")).toEqual([]);
  });

  /** The file name is what a reader has in mind, not the folder above it. */
  it("ranks a name match above a match buried in the path", () => {
    const found = searchNodes(nodes, "utils").map((n) => n.name);

    expect(found[0]).toBe("utils");
    expect(found.indexOf("packages/ui/src/utils.ts")).toBeLessThan(
      found.indexOf("packages/turbo-utils/src/index.ts"),
    );
  });

  it("ignores case", () => {
    expect(searchNodes(nodes, "BUTTON").map((n) => n.name)).toEqual([
      "packages/ui/src/button.tsx",
    ]);
  });

  it("still finds a node by its folder", () => {
    expect(searchNodes(nodes, "turbo-utils").map((n) => n.name)).toEqual([
      "packages/turbo-utils/src/index.ts",
    ]);
  });

  it("caps how many it returns", () => {
    const many = Array.from({ length: 50 }, (_, i) => node(`src/thing-${i}.ts`));
    expect(searchNodes(many, "thing", 8)).toHaveLength(8);
  });
});
