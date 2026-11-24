import type { ReactNode } from "react";
import { type Options as ReactMarkdownOptions } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { CodeBlockContent } from "./CodeBlockContent";
import { isNodeHighlighted, type HastNode } from "../lineHighlight";

// Hoisted to module scope so ReactMarkdown doesn't see a new array on every render
// (otherwise it always re-renders even when the content is unchanged).
export const REMARK_PLUGINS = [remarkGfm, remarkMath];
export const REHYPE_PLUGINS: ReactMarkdownOptions["rehypePlugins"] = [
  [rehypeKatex, { strict: "ignore", errorColor: "inherit" }],
];

const BLOCK_HIGHLIGHT_CLASS =
  "rounded-r-lg border-l-4 border-app-brand bg-app-brand-soft/75 px-3.5 py-2 my-2 shadow-xs ring-1 ring-app-brand-border/50 transition-colors dark:bg-app-brand/20 dark:ring-app-brand/30";
const LIST_ITEM_HIGHLIGHT_CLASS =
  "my-1 rounded-r-md border-l-4 border-app-brand bg-app-brand-soft/75 py-1 pr-1.5 pl-2.5 ring-1 ring-app-brand-border/50 dark:bg-app-brand/20 dark:ring-app-brand/30";
const TABLE_ROW_HIGHLIGHT_CLASS =
  "border-l-4 border-app-brand bg-app-brand-soft/80 font-medium dark:bg-app-brand/25";
const INLINE_CODE_HIGHLIGHT_CLASS =
  "rounded bg-app-brand-soft px-1 py-0.5 font-bold text-app-brand-text ring-1 ring-app-brand-border dark:bg-app-brand/30 dark:text-app-text";

interface MarkdownElementProps {
  children?: ReactNode;
  node?: HastNode;
  className?: string;
}

interface CodeProps extends MarkdownElementProps {
  children?: ReactNode;
}

const CODE_LANGUAGE = /language-(\w+)/;

const STATIC_MARKDOWN_COMPONENTS = {
  code({ className, children }: { className?: string; children?: ReactNode }) {
    const match = CODE_LANGUAGE.exec(className || "");
    if (!match) {
      return <code className={className}>{children}</code>;
    }
    return (
      <div className="my-4 overflow-hidden rounded-lg border border-app-border text-sm">
        <CodeBlockContent language={match[1]}>{children}</CodeBlockContent>
      </div>
    );
  },
  table: ({ children }: { children?: ReactNode }) => (
    <div className="overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
  pre: ({ children }: { children?: ReactNode }) => <>{children}</>,
} as const;

type LineTag = "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "blockquote" | "li" | "tr";

interface LineElementOptions {
  highlightClass: string;
  /** Whether the element carries a `line-N` id the scroll-to-chunk lookup can find. */
  anchored: boolean;
}

/**
 * A markdown element that knows which source lines it spans and marks itself when one
 * of them is cited.
 */
function lineElement(tag: LineTag, options: LineElementOptions, highlightLines?: number[]) {
  const Tag = tag;
  return function LineElement({ children, node, className }: MarkdownElementProps) {
    const { isHighlighted, startLine, endLine } = isNodeHighlighted(node, highlightLines);
    return (
      <Tag
        id={options.anchored && startLine ? `line-${startLine}` : undefined}
        data-highlighted={isHighlighted || undefined}
        data-line-start={startLine}
        data-line-end={endLine}
        className={`${className || ""} ${isHighlighted ? options.highlightClass : ""}`}
      >
        {children}
      </Tag>
    );
  };
}

function highlightedCode(highlightLines?: number[]) {
  return function Code({ className, children, node }: CodeProps) {
    const match = CODE_LANGUAGE.exec(className || "");
    const { isHighlighted, startLine, endLine } = isNodeHighlighted(node, highlightLines);
    if (!match) {
      return (
        <code
          data-highlighted={isHighlighted || undefined}
          className={`${className || ""} ${isHighlighted ? INLINE_CODE_HIGHLIGHT_CLASS : ""}`}
        >
          {children}
        </code>
      );
    }
    return (
      <div
        id={startLine ? `line-${startLine}` : undefined}
        data-highlighted={isHighlighted || undefined}
        data-line-start={startLine}
        data-line-end={endLine}
        className={`my-4 overflow-hidden rounded-lg border text-sm transition-all ${
          isHighlighted
            ? "border-app-brand shadow-sm ring-2 ring-app-brand/40"
            : "border-app-border"
        }`}
      >
        <CodeBlockContent language={match[1]}>{children}</CodeBlockContent>
      </div>
    );
  };
}

/** The renderers for a document that cites nothing, the same object on every call. */
export function staticMarkdownComponents() {
  return STATIC_MARKDOWN_COMPONENTS;
}

/**
 * The markdown renderers for a document that cites some of its lines: every block
 * element reports its line span and is marked when it contains a cited line.
 */
export function createMarkdownComponents(highlightLines?: number[]) {
  const block: LineElementOptions = { highlightClass: BLOCK_HIGHLIGHT_CLASS, anchored: true };

  return {
    code: highlightedCode(highlightLines),
    table: STATIC_MARKDOWN_COMPONENTS.table,
    pre: STATIC_MARKDOWN_COMPONENTS.pre,
    p: lineElement("p", block, highlightLines),
    h1: lineElement("h1", block, highlightLines),
    h2: lineElement("h2", block, highlightLines),
    h3: lineElement("h3", block, highlightLines),
    h4: lineElement("h4", block, highlightLines),
    h5: lineElement("h5", block, highlightLines),
    h6: lineElement("h6", block, highlightLines),
    blockquote: lineElement(
      "blockquote",
      { highlightClass: BLOCK_HIGHLIGHT_CLASS, anchored: false },
      highlightLines,
    ),
    li: lineElement(
      "li",
      { highlightClass: LIST_ITEM_HIGHLIGHT_CLASS, anchored: false },
      highlightLines,
    ),
    tr: lineElement(
      "tr",
      { highlightClass: TABLE_ROW_HIGHLIGHT_CLASS, anchored: false },
      highlightLines,
    ),
  };
}
