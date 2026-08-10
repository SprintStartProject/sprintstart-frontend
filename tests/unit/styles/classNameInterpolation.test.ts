import { describe, it, expect } from "vitest";
import { globSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * Guards against a whole class of silent styling bugs.
 *
 * A conditional class list written as
 *
 *   className={`flex flex-col${open ? " sidebar-open" : ""}`}
 *
 * looks fine, but `prettier-plugin-tailwindcss` trims class strings when it
 * sorts them. The leading space inside `" sidebar-open"` disappears and the
 * result is `flex-colsidebar-open` — two classes glued into one that doesn't
 * exist. Nothing errors, nothing warns, the layout just quietly breaks. It
 * happened once, to `ChatPage`, and it turned the whole page into a flex row.
 *
 * The rule that survives the formatter: the separating space belongs in the
 * template literal, *outside* the `${…}`.
 */

const SRC = resolve(process.cwd(), "src");

/** `className={` followed by a template literal, up to its closing backtick. */
const CLASS_TEMPLATE = /className=\{`([^`]*)`/g;

/** A class character flush against `${`, or flush after the closing `}`. */
const GLUED_BEFORE = /[\w\-\]/]\$\{/;
const GLUED_AFTER = /\}[\w\-[]/;

describe("className template literals", () => {
  const files = globSync("**/*.tsx", { cwd: SRC })
    .filter((path) => !path.startsWith("keycloak-theme"))
    .map((path) => join(SRC, path));

  it("actually finds the source files it is supposed to check", () => {
    // Without this the whole suite would pass vacuously if the glob ever
    // stopped matching — which is exactly how the first version of this test
    // managed to be green while the bug was still in the tree.
    expect(files.length).toBeGreaterThan(100);
  });

  it("keeps a space around every interpolation, so classes cannot glue together", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");

      for (const match of source.matchAll(CLASS_TEMPLATE)) {
        const body = match[1];
        if (!GLUED_BEFORE.test(body) && !GLUED_AFTER.test(body)) continue;

        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${relative(process.cwd(), file)}:${line}\n    ${body.trim()}`);
      }
    }

    expect(
      offenders,
      `Put the separating space before \`\${\`, not inside the string:\n\n${offenders.join("\n\n")}\n`,
    ).toEqual([]);
  });
});
