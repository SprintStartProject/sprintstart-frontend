import { memo, useMemo } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { linkifyCitations } from "../citations/linkifyCitations";
import type { Citation, SelectedCitation } from "../citations/types";

/**
 * Whether a link the buddy wrote points inside the app.
 *
 * The mentor is given the paths of the things it talks about — a step, a question, a phase — so that
 * "want to take the check?" can arrive as something clickable. Those are app paths, and opening one
 * in a new tab would reload the whole SPA and lose the conversation the hire was having.
 *
 * Root-relative only, and deliberately: a protocol-relative `//evil.example` is also "relative" to a
 * careless check, and the model's output is not a place to be careless. `/\evil.example` is the same
 * thing in disguise -- browsers read the backslash as a slash.
 */
function isInAppPath(href: string | undefined): href is string {
  return href !== undefined && href.startsWith("/") && href[1] !== "/" && href[1] !== "\\";
}

/** What one mentor reply needs to render: its text, its sources, and where a citation click goes. */
type BuddyMarkdownProps = {
  /** Raw markdown content (citation markers like `[1]` are not yet linkified). */
  content: string;
  /**
   * The reply's citations, in the order the backend streamed them — drives the `[N]`
   * linkification. Empty (or absent) for a reply with no sources, and for a turn still
   * streaming before the first citation has arrived.
   */
  citations?: Citation[];
  /** Called when the hire clicks a `[N]` reference, with the anchor's rect for the popover. */
  onCitationClick?: (citation: SelectedCitation) => void;
};

/**
 * Renders the buddy's reply as Markdown (GitHub-flavoured), so lists, bold, headings, links,
 * code and tables come through instead of raw asterisks and backticks. Shared by both buddy
 * surfaces (the `/buddy` page and the floating widget) so a reply reads the same in either.
 *
 * Citation markers the mentor wrote (`[3]`) become interactive references exactly as they do in
 * the chat: linkified into `[3](#cite-3)` and rendered as a small button whose click opens the
 * citation popover. Markers inside code spans and blocks are left alone — see
 * `linkifyCitations`.
 *
 * User messages are never passed here — they contain no Markdown, and echoing one back styled
 * would be surprising; those stay plain, pre-wrapped text at the call site.
 *
 * Nothing in here may widen its container. A model writes whatever it likes into a 384 px
 * panel, so wide content gets its own scroller or wraps; it never makes the conversation scroll
 * sideways. The rule is per block —
 *
 * - `pre` and tables scroll inside themselves: `overflow-x-auto` plus `min-w-0`, without which
 *   a flex ancestor's default `min-width: auto` grows to fit and the scroller never engages;
 * - prose, links and inline code break mid-token, because a URL is one unbreakable word to the
 *   line breaker and no container width fixes that.
 *
 * `break-words` is safe to put on every `code`: inside a `pre` the whitespace is preserved and no
 * wrapping is allowed at all, so it applies to inline code only and code blocks still scroll.
 *
 * Memoised on its props: parsing Markdown is the single most expensive thing a reply does, and a
 * reply's text never changes once written — so a render that did not change the text (a keystroke
 * that reaches a parent, a token that belongs to a different row) skips the whole parse. The
 * memoised row above this is the first line of defence; this is the second, for the renders that
 * legitimately re-render the message (a later token in the same reply re-parses only that reply).
 * The `[N]` linkification is memoised the same way — once per (text, citation count) pair, not
 * once per token.
 */
function BuddyMarkdownImpl({ content, citations, onCitationClick }: BuddyMarkdownProps) {
  const citationCount = citations?.length ?? 0;

  // A2-style: linkify once per (content, citation count) pair instead of every render.
  const mdContent = useMemo(
    () => linkifyCitations(content, citationCount),
    [content, citationCount],
  );

  // A4-style: the components map closes over the citations and the click handler, so it can't be
  // module-scope — but memoizing on those deps keeps its identity stable across renders that
  // don't change them, which is what stops ReactMarkdown re-walking the AST for nothing.
  const components = useMemo(() => {
    function citationLink({ href, children }: { href?: string; children?: ReactNode }) {
      const match = href ? /^#cite-(\d+)$/.exec(href) : null;

      if (match) {
        const n = Number(match[1]);
        const citation = citations?.[n - 1];

        return (
          <sup>
            <button
              type="button"
              className="mx-[0.12em] cursor-help rounded-md border border-app-brand-border bg-app-brand-soft px-[0.35em] py-[0.05em] text-[0.7em] leading-none font-semibold text-app-brand-text transition-colors hover:bg-app-brand/20"
              title={citation ? citation.filename : `Source ${n}`}
              // `title` is a tooltip, not a name: without this a screen reader announces a
              // bare "1" for every reference.
              aria-label={citation ? `Citation ${n}: ${citation.filename}` : `Source ${n}`}
              onClick={(e) => {
                if (citation && onCitationClick) {
                  onCitationClick({
                    citation,
                    rect: e.currentTarget.getBoundingClientRect(),
                  });
                }
              }}
            >
              {n}
            </button>
          </sup>
        );
      }

      // An app path navigates in place; anything else is still somebody else's site in a new
      // tab. The dock stays mounted across a route change, so a hire who follows a link into
      // their path keeps the conversation that sent them there.
      return isInAppPath(href) ? (
        <Link to={href}>{children}</Link>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    }

    return {
      a: citationLink,
      table: ({ children }: { children?: ReactNode }) => (
        <div className="max-w-full min-w-0 overflow-x-auto">
          <table className="w-full border-collapse border border-app-border-muted">
            {children}
          </table>
        </div>
      ),
      th: ({ children }: { children?: ReactNode }) => (
        <th className="border border-app-border-muted bg-app-surface px-2 py-1 text-left">
          {children}
        </th>
      ),
      td: ({ children }: { children?: ReactNode }) => (
        <td className="border border-app-border-muted px-2 py-1">{children}</td>
      ),
    };
  }, [citations, onCitationClick]);

  return (
    <div className="min-w-0 space-y-2 break-words [&_a]:break-words [&_a]:underline [&_code]:rounded [&_code]:bg-app-surface [&_code]:px-1 [&_code]:py-0.5 [&_code]:break-words [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:max-w-full [&_pre]:min-w-0 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-app-surface [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {mdContent}
      </ReactMarkdown>
    </div>
  );
}

export const BuddyMarkdown = memo(BuddyMarkdownImpl);
