import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../../../src/context/ToastProvider";
import { ArtifactViewerDrawer } from "../../../../../src/features/knowledge-base/components/ArtifactViewerDrawer";
import type { Artifact } from "../../../../../src/features/knowledge-base/types";

vi.mock("../../../../../src/services/knowledgeService", () => ({
  knowledgeService: {
    getArtifactContent: vi.fn(),
    streamArtifactSummary: vi.fn(),
    deleteUpload: vi.fn(),
  },
}));

vi.mock("../../../../../src/hooks/useAskAi", () => ({
  useAskAi: () => vi.fn(() => true),
}));

vi.mock("../../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "user-1" } }),
}));

vi.mock("../../../../../src/components/ui/SidePanel", () => ({
  SidePanel: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="side-panel">{children}</div> : null,
}));

const HIGHLIGHT_CLASS = "border-app-brand";

function artifactTitled(title: string): Artifact {
  return {
    id: "artifact-1",
    title,
    artifactType: "FILE",
    sourceSystem: "GITHUB",
    sourceId: "src-1",
    sourceUrl: null,
    mime: "text/plain",
    language: null,
    ingestedAt: "2026-01-01T00:00:00Z",
    lastChangedAt: null,
    contentHash: "hash",
    ingestionRunId: null,
  };
}

async function serveContent(content: string, mimeType = "text/markdown", isObjectUrl = false) {
  const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
  vi.mocked(knowledgeService.getArtifactContent).mockResolvedValue({
    content,
    mimeType,
    isObjectUrl,
  });
}

function renderDrawer(title: string, highlightLines?: number[]) {
  return render(
    <ArtifactViewerDrawer
      artifact={artifactTitled(title)}
      onClose={() => {}}
      projectId="proj-1"
      highlightLines={highlightLines}
      canDelete={false}
      onDelete={vi.fn()}
    />,
    { wrapper: ToastProvider },
  );
}

describe("ArtifactViewerDrawer highlighting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("heading levels", () => {
    const levels = [1, 2, 3, 4, 5, 6];
    const markdown = levels.map((level) => `${"#".repeat(level)} Heading ${level}`).join("\n\n");

    it.each(levels)(
      "marks the h%i that holds a cited line and leaves the others plain",
      async (level) => {
        await serveContent(markdown);
        const citedLine = (level - 1) * 2 + 1;

        renderDrawer("headings.md", [citedLine]);

        const cited = await screen.findByRole("heading", { name: `Heading ${level}` });
        expect(cited.tagName).toBe(`H${level}`);
        expect(cited).toHaveAttribute("data-highlighted", "true");
        expect(cited).toHaveAttribute("id", `line-${citedLine}`);
        expect(cited).toHaveAttribute("data-line-start", String(citedLine));
        expect(cited).toHaveAttribute("data-line-end", String(citedLine));
        expect(cited.className).toContain(HIGHLIGHT_CLASS);

        for (const other of levels.filter((candidate) => candidate !== level)) {
          const plain = screen.getByRole("heading", { name: `Heading ${other}` });
          expect(plain).not.toHaveAttribute("data-highlighted");
          expect(plain.className).not.toContain(HIGHLIGHT_CLASS);
          expect(plain).toHaveAttribute("id", `line-${(other - 1) * 2 + 1}`);
        }
      },
    );

    it("renders headings without highlight attributes when no line is cited", async () => {
      await serveContent(markdown);

      renderDrawer("headings.md");

      const heading = await screen.findByRole("heading", { name: "Heading 3" });
      expect(heading).not.toHaveAttribute("data-highlighted");
      expect(heading).not.toHaveAttribute("id");
      expect(heading).not.toHaveAttribute("data-line-start");
      expect(heading.className).not.toContain(HIGHLIGHT_CLASS);
    });
  });

  describe("scrolling to the cited chunk", () => {
    const scrollIntoView = () => vi.mocked(HTMLElement.prototype.scrollIntoView);

    it("scrolls the source line smoothly into the centre once the content has rendered", async () => {
      await serveContent("const a = 1;\nconst b = 2;\nconst c = 3;", "text/plain");

      renderDrawer("app.ts", [2, 3]);

      await waitFor(() => expect(scrollIntoView()).toHaveBeenCalledTimes(1));
      expect(scrollIntoView()).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
      const target = scrollIntoView().mock.contexts[0] as HTMLElement;
      expect(target.id).toBe("line-2");
    });

    it("defers the scroll by 120ms so the markdown can finish rendering", async () => {
      const realSetTimeout = globalThis.setTimeout;
      const deferred: Array<() => void> = [];
      const spy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
        callback: () => void,
        delay?: number,
        ...rest: unknown[]
      ) => {
        if (delay === 120) {
          deferred.push(callback);
          return 0 as unknown as ReturnType<typeof setTimeout>;
        }
        return realSetTimeout(callback, delay, ...rest);
      }) as typeof setTimeout);
      try {
        await serveContent("const a = 1;", "text/plain");

        renderDrawer("app.ts", [1]);
        await screen.findByTestId("cited-chunk-banner");

        // The banner can show before the content has rendered, so the timer is waited for rather
        // than assumed; and the spy is restored whatever happens, or a failure here would swallow
        // the 120ms timers of every test after it.
        await waitFor(() => expect(deferred).toHaveLength(1));
        expect(scrollIntoView()).not.toHaveBeenCalled();
        deferred[0]();
        expect(scrollIntoView()).toHaveBeenCalledTimes(1);
      } finally {
        spy.mockRestore();
      }
    });

    it("does not scroll when no line is cited", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await serveContent("const a = 1;", "text/plain");

      renderDrawer("app.ts");
      await screen.findByTestId("raw-content");
      await vi.advanceTimersByTimeAsync(500);

      expect(scrollIntoView()).not.toHaveBeenCalled();
    });

    it("does not scroll when the cited line list is empty", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await serveContent("const a = 1;", "text/plain");

      renderDrawer("app.ts", []);
      await screen.findByTestId("raw-content");
      await vi.advanceTimersByTimeAsync(500);

      expect(scrollIntoView()).not.toHaveBeenCalled();
      expect(screen.queryByTestId("cited-chunk-banner")).not.toBeInTheDocument();
    });

    it("falls back to the highlighted element when its first line is inside a longer block", async () => {
      await serveContent("first line of a paragraph\nsecond line of the same paragraph");

      renderDrawer("notes.md", [2]);

      await waitFor(() => expect(scrollIntoView()).toHaveBeenCalledTimes(1));
      const target = scrollIntoView().mock.contexts[0] as HTMLElement;
      expect(target.dataset.highlighted).toBe("true");
      expect(target.id).toBe("line-1");
    });

    it("scrolls when the jump-to-chunk button is pressed", async () => {
      await serveContent("# Title\n\nCited paragraph.");

      renderDrawer("notes.md", [3]);
      await waitFor(() => expect(scrollIntoView()).toHaveBeenCalledTimes(1));

      await userEvent.click(await screen.findByTestId("jump-to-chunk-btn"));

      expect(scrollIntoView()).toHaveBeenCalledTimes(2);
      expect(scrollIntoView()).toHaveBeenLastCalledWith({ behavior: "smooth", block: "center" });
    });

    it("scrolls to the smallest cited line, whatever order the lines arrive in", async () => {
      await serveContent("one\n\ntwo\n\nthree");

      renderDrawer("notes.md", [5, 3]);

      await waitFor(() => expect(scrollIntoView()).toHaveBeenCalledTimes(1));
      const target = scrollIntoView().mock.contexts[0] as HTMLElement;
      expect(target.id).toBe("line-3");
    });
  });

  describe("source language", () => {
    it.each([
      ["app.js", "javascript"],
      ["view.jsx", "javascript"],
      ["app.ts", "typescript"],
      ["view.tsx", "typescript"],
      ["tool.py", "python"],
      ["Main.kt", "kotlin"],
      ["build.kts", "kotlin"],
      ["Main.java", "java"],
      ["data.json", "json"],
      ["ci.yml", "yaml"],
      ["ci.yaml", "yaml"],
      ["run.sh", "bash"],
      ["index.html", "markup"],
      ["site.css", "css"],
      ["query.sql", "sql"],
      ["pom.xml", "xml"],
      ["table.csv", "csv"],
      ["Dockerfile", "docker"],
      ["dockerfile", "docker"],
      ["APP.TS", "typescript"],
      ["LICENSE", "text"],
      ["archive.unknownext", "text"],
    ])("highlights %s as %s", async (title, language) => {
      await serveContent("some content", "text/plain");

      renderDrawer(title);

      const raw = await screen.findByTestId("raw-content");
      await waitFor(() =>
        expect(raw.querySelector(`code[class*='language-${language}']`)).toBeInTheDocument(),
      );
    });

    it("falls back to plain text when the artifact has no title", async () => {
      await serveContent("some content", "text/plain");

      renderDrawer("");

      const raw = await screen.findByTestId("raw-content");
      await waitFor(() =>
        expect(raw.querySelector("code[class*='language-text']")).toBeInTheDocument(),
      );
    });
  });

  describe("object URLs", () => {
    it("revokes the object URL of a loaded file when the drawer unmounts", async () => {
      const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
      await serveContent("blob:file-1", "image/png", true);

      const { unmount } = renderDrawer("picture.png");
      await screen.findByRole("img");
      expect(revoke).not.toHaveBeenCalled();

      unmount();

      expect(revoke).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledWith("blob:file-1");
      revoke.mockRestore();
    });

    it("does not revoke anything for content that is not an object URL", async () => {
      const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
      await serveContent("plain text", "text/plain", false);

      const { unmount } = renderDrawer("notes.txt");
      await screen.findByTestId("raw-content");
      unmount();

      expect(revoke).not.toHaveBeenCalled();
      revoke.mockRestore();
    });
  });
});
