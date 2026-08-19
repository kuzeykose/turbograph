import { getLanguageFromFilename } from "@/lib/utils/language";

describe("getLanguageFromFilename", () => {
  it("maps common source extensions to Prism languages", () => {
    expect(getLanguageFromFilename("app.tsx")).toBe("tsx");
    expect(getLanguageFromFilename("hooks.ts")).toBe("typescript");
    expect(getLanguageFromFilename("index.js")).toBe("javascript");
    expect(getLanguageFromFilename("Button.jsx")).toBe("jsx");
    expect(getLanguageFromFilename("main.py")).toBe("python");
    expect(getLanguageFromFilename("styles.scss")).toBe("scss");
    expect(getLanguageFromFilename("index.html")).toBe("html");
    expect(getLanguageFromFilename("deploy.sh")).toBe("bash");
  });

  it("maps well-known filenames without relying on the extension", () => {
    expect(getLanguageFromFilename("Dockerfile")).toBe("docker");
    expect(getLanguageFromFilename("Makefile")).toBe("makefile");
    expect(getLanguageFromFilename("package.json")).toBe("json");
    expect(getLanguageFromFilename("turbo.jsonc")).toBe("json");
  });

  it("falls back to plain text for unknown files", () => {
    expect(getLanguageFromFilename("notes")).toBe("text");
    expect(getLanguageFromFilename("image.bin")).toBe("text");
  });
});
