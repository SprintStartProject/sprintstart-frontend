import { describe, expect, it } from "vitest";
import { languageForFilename } from "../../../../src/features/knowledge-base/sourceLanguage";

describe("languageForFilename", () => {
  it.each([
    ["app.js", "javascript"],
    ["view.jsx", "javascript"],
    ["app.ts", "typescript"],
    ["view.tsx", "typescript"],
    ["tool.py", "python"],
    ["Main.kt", "kotlin"],
    ["build.kts", "kotlin"],
    ["Main.java", "java"],
    ["notes.md", "markdown"],
    ["data.json", "json"],
    ["ci.yml", "yaml"],
    ["ci.yaml", "yaml"],
    ["run.sh", "bash"],
    ["index.html", "markup"],
    ["site.css", "css"],
    ["query.sql", "sql"],
    ["pom.xml", "xml"],
    ["table.csv", "csv"],
  ])("maps %s to %s", (name, language) => {
    expect(languageForFilename(name)).toBe(language);
  });

  it("ignores the case of the extension", () => {
    expect(languageForFilename("APP.TS")).toBe("typescript");
  });

  it("uses the last extension of a dotted name", () => {
    expect(languageForFilename("archive.test.py")).toBe("python");
  });

  it.each(["Dockerfile", "dockerfile", "DOCKERFILE"])("recognises %s", (name) => {
    expect(languageForFilename(name)).toBe("docker");
  });

  it.each([undefined, null, ""])("falls back to text for %j", (name) => {
    expect(languageForFilename(name)).toBe("text");
  });

  it.each(["LICENSE", "archive.unknownext", "Makefile", "constructor", "x.toString"])(
    "falls back to text for %s",
    (name) => {
      expect(languageForFilename(name)).toBe("text");
    },
  );
});
