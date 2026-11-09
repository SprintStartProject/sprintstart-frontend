import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { ContentKind } from "../artifactPresentation";
import { preprocessMarkdown } from "../markdown";
import { languageForFilename } from "../sourceLanguage";
import type { Artifact, ArtifactContent } from "../types";
import {
  REHYPE_PLUGINS,
  REMARK_PLUGINS,
  type createMarkdownComponents,
} from "./markdownComponents";

interface ArtifactContentBodyProps {
  kind: ContentKind;
  content: ArtifactContent | null;
  artifact: Artifact | null;
  /** Whether the artifact counts as markdown, which names the language of its source view. */
  isMarkdownArtifact: boolean;
  highlightLines?: number[];
  markdownComponents: ReturnType<typeof createMarkdownComponents>;
}

function EmptyBodyNotice() {
  return (
    <div data-testid="empty-body-notice">
      <EmptyState size="sm" title="Nothing to read here">
        This artifact came in with a title and an empty body — a pull request or issue whose
        description was never written, or a file with no content. There is nothing to read, and
        nothing to summarise.
      </EmptyState>
    </div>
  );
}

function PdfFrame({ content, title }: { content: ArtifactContent; title?: string | null }) {
  return (
    <div className="h-[calc(100vh-12rem)] min-h-[500px] w-full overflow-hidden rounded-lg border border-app-border">
      <object data={content.content} type="application/pdf" className="h-full w-full">
        <p className="p-4 text-app-text-muted">
          Unable to display PDF file.{" "}
          <a
            href={content.content}
            download={title || "document.pdf"}
            className="text-app-brand underline underline-offset-2"
          >
            Download
          </a>{" "}
          instead.
        </p>
      </object>
    </div>
  );
}

function ImageFrame({ content, title }: { content: ArtifactContent; title?: string | null }) {
  return (
    <div className="flex justify-center rounded-2xl border border-app-border bg-app-bg p-4">
      <img src={content.content} alt={title || "Image"} className="max-w-full rounded shadow-sm" />
    </div>
  );
}

function SourceListing({
  text,
  language,
  highlightLines,
}: {
  text: string;
  language: string;
  highlightLines?: number[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-app-border text-sm">
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        showLineNumbers={true}
        wrapLines={true}
        customStyle={{ margin: 0, padding: "1rem", backgroundColor: "var(--color-app-bg)" }}
        lineProps={(lineNumber) => ({
          style: { display: "block", padding: "0 4px" },
          className: highlightLines?.includes(lineNumber)
            ? "bg-app-brand/30 border-l-2 border-app-brand"
            : "",
          id: `line-${lineNumber}`,
        })}
      >
        {text}
      </SyntaxHighlighter>
    </div>
  );
}

function RenderedMarkdown({
  content,
  markdownComponents,
}: {
  content: ArtifactContent;
  markdownComponents: ReturnType<typeof createMarkdownComponents>;
}) {
  return (
    <div className="prose prose-sm max-w-none break-words text-app-text dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={markdownComponents}
      >
        {preprocessMarkdown(content.content)}
      </ReactMarkdown>
    </div>
  );
}

function SourceView({
  content,
  artifact,
  isMarkdownArtifact,
  highlightLines,
}: Pick<
  ArtifactContentBodyProps,
  "content" | "artifact" | "isMarkdownArtifact" | "highlightLines"
>) {
  return (
    <SourceListing
      text={content?.content || ""}
      language={isMarkdownArtifact ? "markdown" : languageForFilename(artifact?.title)}
      highlightLines={highlightLines}
    />
  );
}

/** The artifact's content in the form `kind` calls for. */
export function ArtifactContentBody(props: ArtifactContentBodyProps) {
  const { kind, content, artifact, markdownComponents } = props;
  if (!content) return <SourceView {...props} />;
  switch (kind) {
    case "empty":
      return <EmptyBodyNotice />;
    case "markdown":
      return <RenderedMarkdown content={content} markdownComponents={markdownComponents} />;
    case "pdf":
      return <PdfFrame content={content} title={artifact?.title} />;
    case "image":
      return <ImageFrame content={content} title={artifact?.title} />;
    default:
      return <SourceView {...props} />;
  }
}
