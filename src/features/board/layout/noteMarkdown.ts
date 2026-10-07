import { splitMarks } from "../marks/markup";
import { splitStepLinks } from "./stepLinks";

/**
 * Where a `[[Step]]` link points inside a Markdown note — a marker, not an address: `NoteMarkdown`
 * draws every link starting with it as a `StepLink` chip. Root-relative, so Markdown's URL
 * sanitising leaves it alone.
 */
export const STEP_LINK_HREF = "/__step/";

/**
 * Whether a note is written in Markdown rather than as plain text.
 *
 * The buddy writes what it puts on the board the way it writes its replies — headings, lists,
 * `**bold**`, code — and the board drew all of it raw. A note the hire typed is usually plain
 * prose, and switching *every* note to Markdown would turn a line that happens to start with "1."
 * into a list nobody asked for. So only a note that plainly uses Markdown is drawn as Markdown.
 */
export function looksLikeMarkdown(text: string): boolean {
  return (
    /^\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```)/m.test(text) ||
    /\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)/.test(text)
  );
}

/** The few mdast shapes the plugin below touches — not worth a dependency on the full types. */
type MdNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
  data?: { hName?: string };
};

/**
 * Two things Markdown does differently from the board's own notes, put back.
 *
 * - `==words==` is how a note carries its highlights (see `marks/markup.ts`). Markdown has no such
 *   syntax, so the run becomes a `mark` element, which is then drawn by `Marked` exactly as on a
 *   plain note — colour, popover and all.
 * - `[[Step title]]` links a step of the path (see `stepLinks.ts`); it becomes a link `NoteMarkdown`
 *   draws as a step chip.
 * - A single line break is a line break. In Markdown it is a space, which would run the "From …"
 *   line a selection appends into the sentence above it.
 *
 * Code is left alone: inside `inline code` or a fence, `==` and line breaks mean what they say.
 */
export function remarkNoteText() {
  function split(node: MdNode): MdNode[] {
    if (node.type !== "text" || !node.value) return [node];

    return splitStepLinks(node.value).flatMap((part): MdNode[] =>
      part.link
        ? [
            {
              type: "link",
              url: `${STEP_LINK_HREF}${encodeURIComponent(part.text)}`,
              children: [{ type: "text", value: part.text }],
            },
          ]
        : splitText(part.text),
    );
  }

  function splitText(value: string): MdNode[] {
    const out: MdNode[] = [];
    for (const run of splitMarks(value)) {
      if (run.marked) {
        out.push({
          type: "highlight",
          data: { hName: "mark" },
          children: [{ type: "text", value: run.text }],
        });
        continue;
      }

      run.text.split("\n").forEach((line, index) => {
        if (index > 0) out.push({ type: "break" });
        if (line) out.push({ type: "text", value: line });
      });
    }
    return out;
  }

  function walk(node: MdNode) {
    if (!node.children) return;
    node.children = node.children.flatMap(split);
    node.children.forEach(walk);
  }

  return (tree: MdNode) => walk(tree);
}

/**
 * A note's first line, as a title: the Markdown that only means "this is a heading" or "this is
 * bold" taken off it.
 *
 * The first line of a note is drawn as the card's title (see `NoteCard`), and a buddy writing in
 * Markdown starts a note with `## Recap` — which is already a title, so the `##` only made it read as
 * source. Emphasis, code and link syntax go the same way; the words stay. Highlights (`==…==`) are
 * left in, because `Marked` draws them.
 */
export function plainHeading(line: string): string {
  return (
    line
      .replace(/^\s{0,3}#{1,6}\s+/, "")
      .replace(/\s+#+\s*$/, "")
      .replace(/\*\*(.+?)\*\*|__(.+?)__/g, "$1$2")
      .replace(/`([^`]+)`/g, "$1")
      // A link into the path reads as what it names last: `[[Setup#Set up SSH]]` is "Set up SSH".
      .replace(/\[\[([^[\]\n]+?)\]\]/g, (_match, inside: string) =>
        (inside.split("#").pop() ?? inside).trim(),
      )
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  );
}
