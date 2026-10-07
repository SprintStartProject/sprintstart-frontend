import { Component, useEffect, useRef } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "../../../components/ui/Button.tsx";
import { EmptyState } from "../../../components/ui/EmptyState.tsx";

type EggErrorBoundaryProps = {
  /** The egg's human-readable name, used in the failure message. */
  label: string;
  /** Closes the modal from the failure state. */
  onClose: () => void;
  /**
   * Whether the failure state should offer its own close affordances (a
   * button and Escape). False when the shell already renders both — the
   * iframe game's header bar and window Escape listener — so a press is
   * never handled twice.
   */
  ownsClose: boolean;
  /**
   * Offers a "Try again" button when present. The host must rebuild whatever
   * it renders (its `lazy`, typically): `React.lazy` caches a rejection for
   * the page's lifetime, so retrying without a fresh lazy would only replay
   * the cached failure.
   */
  onRetry?: () => void;
  children: ReactNode;
};

type EggErrorBoundaryState = { failed: boolean };

/**
 * Catches a game that fails to load or render inside {@link EggModalShell}.
 *
 * Every game arrives as a lazy chunk, and a chunk can fail — a stale deploy
 * whose hashed file is gone, or the network dropping mid-fetch. Without a
 * boundary the rejected `lazy()` throws up to the app root and unmounts the
 * whole app for what is an easter egg; with it the modal says what went wrong
 * and can still be closed.
 *
 * A class because React still exposes error boundaries only as class
 * components. Remounting alone cannot retry a failed chunk — `React.lazy`
 * caches the rejection for the page's lifetime — so a host that wants a real
 * retry rebuilds its lazy per attempt and passes `onRetry`; without it the
 * failure state simply stays closable.
 */
export class EggErrorBoundary extends Component<EggErrorBoundaryProps, EggErrorBoundaryState> {
  override state: EggErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): EggErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Deliberately logged: a failing chunk is a deploy/network problem the
    // user cannot see, and the console is where somebody debugging it looks.
    console.error("Easter egg failed to load", error, info.componentStack);
  }

  /** Clears the failure and lets the host rebuild its lazy for a new import. */
  private handleRetry = (): void => {
    this.setState({ failed: false });
    this.props.onRetry?.();
  };

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <EggLoadError
        label={this.props.label}
        onClose={this.props.onClose}
        ownsClose={this.props.ownsClose}
        onRetry={this.props.onRetry ? this.handleRetry : undefined}
      />
    );
  }
}

/**
 * The failure state itself. A function component so it can hold the Escape
 * listener as an effect: canvas games normally own that key, and a game that
 * never mounted leaves nothing else listening.
 */
function EggLoadError({
  label,
  onClose,
  ownsClose,
  onRetry,
}: {
  label: string;
  onClose: () => void;
  ownsClose: boolean;
  onRetry?: () => void;
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!ownsClose) return;
    // Escape is claimed in the *capture* phase, the way the game itself claims
    // it (see DinoGame): hosts that close on Escape listen on the document,
    // whose bubble phase runs before a window listener — one press would close
    // the host surface and then call onClose as well. Capturing first, with
    // preventDefault for hosts that check `defaultPrevented` and
    // stopPropagation for the ones that do not, keeps one press to one close.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [ownsClose]);

  return (
    <div className="p-4" role="alert">
      <EmptyState
        title={`Couldn't load ${label}`}
        action={
          ownsClose || onRetry ? (
            <div className="flex items-center gap-2">
              {onRetry ? (
                <Button variant="primary" size="sm" onClick={onRetry}>
                  Try again
                </Button>
              ) : undefined}
              {ownsClose ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onClose}
                  icon={<X className="h-4 w-4" />}
                >
                  Close
                </Button>
              ) : undefined}
            </div>
          ) : undefined
        }
      >
        {onRetry
          ? "The game didn't arrive — check your connection, then try again."
          : "The game didn't arrive — check your connection or reload the page, then try again."}
      </EmptyState>
    </div>
  );
}
