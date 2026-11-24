import { render } from "@testing-library/react";
import ReactMarkdown from "react-markdown";
import { describe, expect, it } from "vitest";
import {
  REHYPE_PLUGINS,
  REMARK_PLUGINS,
  createMarkdownComponents,
  staticMarkdownComponents,
} from "../../../../../src/features/knowledge-base/components/markdownComponents";

const DOCUMENT = [
  "# One", // 1
  "", // 2
  "## Two", // 3
  "", // 4
  "### Three", // 5
  "", // 6
  "#### Four", // 7
  "", // 8
  "##### Five", // 9
  "", // 10
  "###### Six", // 11
  "", // 12
  "A paragraph with `inline` code.", // 13
  "", // 14
  "> A quote", // 15
  "", // 16
  "- first item", // 17
  "- second item", // 18
  "", // 19
  "| a | b |", // 20
  "| - | - |", // 21
  "| 1 | 2 |", // 22
  "", // 23
  "```ts", // 24
  "const x = 1;", // 25
  "```", // 26
].join("\n");

function renderDocument(highlightLines?: number[]) {
  return render(
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={createMarkdownComponents(highlightLines)}
    >
      {DOCUMENT}
    </ReactMarkdown>,
  ).container;
}

function marked(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("[data-highlighted='true']")).map((element) =>
    element.tagName.toLowerCase(),
  );
}

describe("createMarkdownComponents", () => {
  describe("blocks that can be anchored", () => {
    it.each([
      ["h1", 1],
      ["h2", 3],
      ["h3", 5],
      ["h4", 7],
      ["h5", 9],
      ["h6", 11],
      ["p", 13],
    ])("anchors the %s on line %i and marks it when that line is cited", (tag, line) => {
      const container = renderDocument([line]);

      const element = container.querySelector(`#line-${line}`);
      expect(element?.tagName.toLowerCase()).toBe(tag);
      expect(element).toHaveAttribute("data-highlighted", "true");
      expect(element).toHaveAttribute("data-line-start", String(line));
      expect(element).toHaveAttribute("data-line-end", String(line));
      expect(element?.className).toContain("border-app-brand");
      expect(marked(container)).toEqual(tag === "p" ? ["p", "code"] : [tag]);
    });

    it("keeps the anchor but not the mark on a block that is not cited", () => {
      const container = renderDocument([13]);

      const heading = container.querySelector("#line-1");
      expect(heading).not.toHaveAttribute("data-highlighted");
      expect(heading?.className).not.toContain("border-app-brand");
      expect(heading).toHaveAttribute("data-line-start", "1");
    });
  });

  describe("blocks that are not anchored", () => {
    it("marks a cited quote without giving it an id", () => {
      const container = renderDocument([15]);

      const quote = container.querySelector("blockquote");
      expect(quote).toHaveAttribute("data-highlighted", "true");
      expect(quote).not.toHaveAttribute("id");
      expect(quote).toHaveAttribute("data-line-start", "15");
      expect(quote?.className).toContain("rounded-r-lg");
    });

    it("marks only the cited list item, in its own style", () => {
      const container = renderDocument([18]);

      const items = container.querySelectorAll("li");
      expect(items[0]).not.toHaveAttribute("data-highlighted");
      expect(items[1]).toHaveAttribute("data-highlighted", "true");
      expect(items[1]).not.toHaveAttribute("id");
      expect(items[1].className).toContain("pl-2.5");
      expect(items[1].className).not.toContain("rounded-r-lg");
    });

    it("marks only the cited table row, in its own style", () => {
      const container = renderDocument([22]);

      const rows = container.querySelectorAll("tr");
      expect(rows[0]).not.toHaveAttribute("data-highlighted");
      expect(rows[1]).toHaveAttribute("data-highlighted", "true");
      expect(rows[1]).not.toHaveAttribute("id");
      expect(rows[1].className).toContain("font-medium");
    });

    it("wraps the table so it can scroll sideways", () => {
      const container = renderDocument();

      expect(container.querySelector("table")?.parentElement).toHaveClass("overflow-x-auto");
    });
  });

  describe("code", () => {
    it("marks inline code on a cited line, in its own style", () => {
      const container = renderDocument([13]);

      const inline = container.querySelector("p code");
      expect(inline).toHaveAttribute("data-highlighted", "true");
      expect(inline?.className).toContain("font-bold");
    });

    it("leaves inline code on other lines plain", () => {
      const inline = renderDocument([1]).querySelector("p code");

      expect(inline).not.toHaveAttribute("data-highlighted");
      expect(inline?.className).not.toContain("font-bold");
    });

    it("anchors a fenced block and marks it when a line inside is cited", () => {
      const container = renderDocument([25]);

      const block = container.querySelector("#line-24");
      expect(block).toHaveAttribute("data-highlighted", "true");
      expect(block).toHaveAttribute("data-line-start", "24");
      expect(block).toHaveAttribute("data-line-end", "26");
      expect(block?.className).toContain("ring-2");
      expect(block?.querySelector("code[class*='language-ts']")).toBeInTheDocument();
    });

    it("renders an uncited fenced block with the plain border", () => {
      const block = renderDocument([1]).querySelector("#line-24");

      expect(block).not.toHaveAttribute("data-highlighted");
      expect(block?.className).toContain("border-app-border");
      expect(block?.className).not.toContain("ring-2");
    });

    it("renders the block's text without the trailing newline", () => {
      const block = renderDocument([1]).querySelector("#line-24");

      expect(block?.textContent).toBe("const x = 1;");
    });

    it("does not wrap the highlighted block in a second pre element", () => {
      expect(renderDocument().querySelectorAll("pre")).toHaveLength(1);
    });
  });

  describe("citing several lines", () => {
    it("marks every block that holds one of them and nothing else", () => {
      const container = renderDocument([3, 13, 18]);

      expect(marked(container)).toEqual(["h2", "p", "code", "li"]);
    });
  });

  describe("without cited lines", () => {
    it.each([undefined, []])("marks nothing for %j", (lines) => {
      const container = renderDocument(lines);

      expect(marked(container)).toEqual([]);
      expect(container.querySelector("[class*='border-app-brand']")).toBeNull();
    });
  });
});

describe("staticMarkdownComponents", () => {
  function renderStatic(markdown: string) {
    return render(
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={staticMarkdownComponents()}
      >
        {markdown}
      </ReactMarkdown>,
    ).container;
  }

  it("returns the same object every time", () => {
    expect(staticMarkdownComponents()).toBe(staticMarkdownComponents());
  });

  it("renders a fenced block with its language and no line anchors", () => {
    const container = renderStatic("```py\nprint(1)\n```");

    const block = container.querySelector("div.my-4");
    expect(block?.querySelector("code[class*='language-py']")).toBeInTheDocument();
    expect(block).not.toHaveAttribute("id");
    expect(block?.textContent).toBe("print(1)");
    expect(container.querySelectorAll("pre")).toHaveLength(1);
  });

  it("renders inline code as it is", () => {
    const inline = renderStatic("some `code` here").querySelector("code");

    expect(inline?.textContent).toBe("code");
    expect(inline).not.toHaveAttribute("data-highlighted");
  });

  it("wraps a table so it can scroll sideways", () => {
    const container = renderStatic("| a |\n| - |\n| 1 |");

    expect(container.querySelector("table")?.parentElement).toHaveClass("overflow-x-auto");
  });

  it("renders math through katex", () => {
    const container = renderStatic("Inline $a^2$ math");

    expect(container.querySelector(".katex")).toBeInTheDocument();
  });
});
