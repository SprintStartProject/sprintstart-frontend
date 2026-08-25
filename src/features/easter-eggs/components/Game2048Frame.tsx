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

const GAME_URL = "/easter-eggs/2048.html";

export function Game2048Frame({ onExit }: Game2048FrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      if (!win || !doc) return;
      win.focus();
      doc.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Escape") onExit();
      });
      // The iframe is unmounted when the modal closes (AnimatePresence
      // exit), discarding its contentDocument and this listener with it.
    };

    if (iframe.contentDocument?.readyState === "complete") handleLoad();
    else iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [onExit]);

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
