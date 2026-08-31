/**
 * Renders the self-contained vanilla-JS 2048 page (public/easter-eggs/
 * 2048.html) inside an iframe so it fits the registry's shared
 * `{ onExit }` game shape. All keyboard wiring lives in
 * {@link EggModalShell} — focusing the frame here just makes arrow keys
 * work immediately, without a click first.
 */
import { useEffect, useRef } from "react";

type Game2048FrameProps = {
  /**
   * Called when the user presses Escape *outside* the iframe (header,
   * close button, before load). Keydowns inside a focused iframe don't
   * bubble out to the parent document, so the frame installs its own
   * same-origin listener after loading; the two never double-fire.
   */
  onExit: () => void;
};

function isEggExitMessage(data: unknown): data is { type: "EGG_EXIT" } {
  return (
    typeof data === "object" && data !== null && (data as { type?: unknown }).type === "EGG_EXIT"
  );
}

const GAME_URL = "/easter-eggs/2048.html";

export function Game2048Frame({ onExit }: Game2048FrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onExitRef = useRef(onExit);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (isEggExitMessage(event.data)) {
        onExitRef.current();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExitRef.current();
      }
    };

    const attachListener = () => {
      try {
        const win = iframe.contentWindow;
        const doc = iframe.contentDocument;
        if (win) {
          win.focus();
          win.addEventListener("keydown", handleKeyDown);
        }
        if (doc) {
          doc.addEventListener("keydown", handleKeyDown);
        }
      } catch {
        // Fallback to window message listener if cross-origin
      }
    };

    if (iframe.contentDocument?.readyState === "complete") {
      attachListener();
    }
    iframe.addEventListener("load", attachListener);

    return () => {
      iframe.removeEventListener("load", attachListener);
      try {
        iframe.contentWindow?.removeEventListener("keydown", handleKeyDown);
        iframe.contentDocument?.removeEventListener("keydown", handleKeyDown);
      } catch {
        // Ignore
      }
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={GAME_URL}
      title="2048 game"
      loading="lazy"
      className="h-[675px] w-[510px] max-w-full border-0"
    />
  );
}
