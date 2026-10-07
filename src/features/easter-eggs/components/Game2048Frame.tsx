/**
 * Renders the self-contained vanilla-JS 2048 page (public/easter-eggs/
 * 2048.html) inside an iframe so it fits the registry's shared
 * `{ onExit }` game shape.
 *
 * Keyboard wiring is split by who can hear the press: focusing the frame
 * after load makes arrow keys drive the board immediately, without a click
 * first; Escape pressed in the parent chrome is the shell's own window
 * listener; Escape pressed *inside* the frame is reported back by the page
 * itself as an EGG_EXIT message. Nothing here listens for keys, so one
 * press is never counted twice.
 */
import { useEffect, useRef } from "react";

type Game2048FrameProps = {
  /**
   * Called when the player leaves the game: Escape in the parent chrome
   * (the shell) or the frame's own EGG_EXIT report. Mainly the callback
   * the registry's shared game shape requires.
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
      // Same origin *and* this very frame: the game page is served by this
      // app, so a message from anywhere else — another origin, or another
      // same-origin frame or window — is somebody else closing a modal that
      // is not its business.
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
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

    // Put the caret in the frame once it has loaded, so arrow keys drive the
    // board immediately rather than the first press scrolling the page behind
    // the modal. Escape needs nothing here: the frame's own page reports it
    // through the message above, and presses that land outside the frame are
    // the shell's window listener. One mechanism per press, so none of them
    // is counted twice.
    const focusFrame = () => {
      try {
        iframe.contentWindow?.focus();
      } catch {
        // Cross-origin frame: nothing to focus into; the message path stands.
      }
    };

    // Only the `load` event, never an early `readyState` check: a freshly
    // inserted iframe still holds its initial about:blank document, whose
    // readyState is already "complete". Focusing that would steal focus
    // before the game exists — and before the shell has recorded who opened
    // it, which is how the frame used to end up as the "opener" focus was
    // restored to on close.
    iframe.addEventListener("load", focusFrame);

    return () => iframe.removeEventListener("load", focusFrame);
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
