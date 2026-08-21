import { formatTabLabel } from "@/components/graph/node-label";

describe("formatTabLabel", () => {
  it("uses just the file name when it is already unique", () => {
    const tabs = ["packages/turbo-utils/src/cli.ts", "packages/ui/src/index.ts"];
    expect(formatTabLabel(tabs[0]!, tabs)).toBe("cli.ts");
  });

  /** A monorepo is full of files called index.ts. */
  it("walks up the path until two tabs can be told apart", () => {
    const tabs = [
      "packages/turbo-utils/src/index.ts",
      "packages/turbo-stream/src/index.ts",
    ];
    expect(formatTabLabel(tabs[0]!, tabs)).toBe("turbo-utils/…/index.ts");
    expect(formatTabLabel(tabs[1]!, tabs)).toBe("turbo-stream/…/index.ts");
  });

  it("leaves a package name alone", () => {
    expect(formatTabLabel("@repo/ui", ["@repo/ui"])).toBe("@repo/ui");
    expect(formatTabLabel("ui", ["ui", "utils"])).toBe("ui");
  });

  it("does not disambiguate against itself", () => {
    const id = "packages/turbo-utils/src/index.ts";
    expect(formatTabLabel(id, [id])).toBe("index.ts");
  });
});
