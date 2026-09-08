import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

import { cardAccent } from "../../../../src/features/board/layout/cardAccents";
import type { BoardCardKind } from "../../../../src/features/board/types";

const KINDS: BoardCardKind[] = [
  "PATH_TO_FIRST_CONTRIBUTION",
  "CURRENT_TASK",
  "DIAGRAM",
  "ARRIVAL_STEPS",
  "OPEN_PULL_REQUESTS",
  "SUGGESTED_TASKS",
  "COMPETENCY_PROGRESS",
  "MEMORY_RECAP",
  "NOTE",
  "LINK",
  "CHECKLIST",
];

// Read from the project root rather than through `import.meta.url`, which under Vite is an http
// URL and not a path any file reader will take.
const source = readFileSync(
  resolve(process.cwd(), "src/features/board/layout/cardAccents.ts"),
  "utf8",
);

describe("the colour a kind of card wears", () => {
  /**
   * The one thing about this file that a type cannot check and the eye does not catch.
   *
   * Tailwind finds classes by scanning source text for whole candidates, so a class assembled at
   * runtime — `text-app-${token}-text` — is a rule it never emits. Every accent still looks correct
   * in the object, in the props and in the DOM; the colour is simply not in the stylesheet, and the
   * board goes grey. This asserts that each class exists in this file as a literal string, which is
   * exactly what the build needs in order to see it.
   */
  it("names every class as a whole string, because the build reads source and not runtime", () => {
    for (const kind of KINDS) {
      const accent = cardAccent(kind);

      for (const className of [accent.icon, accent.chip, accent.edge, accent.bloom]) {
        expect(source, `${kind}: "${className}" is not written out in cardAccents.ts`).toContain(
          `"${className}"`,
        );
      }
    }
  });

  it("gives the three kinds a hire writes three colours of their own", () => {
    // These are the cards a board actually fills up with, and they were all one grey.
    const written = [cardAccent("NOTE"), cardAccent("LINK"), cardAccent("CHECKLIST")];

    expect(new Set(written.map((accent) => accent.icon)).size).toBe(3);
  });

  it("keeps the status colours out of a decoration", () => {
    // Green, amber and red already mean something in this app, and an arrival card in amber reads
    // as a problem whether or not anything is outstanding.
    for (const kind of KINDS) {
      const accent = cardAccent(kind);

      expect(accent.icon).not.toMatch(/success|warning|danger/);
      expect(accent.edge).not.toMatch(/success|warning|danger/);
    }
  });
});
