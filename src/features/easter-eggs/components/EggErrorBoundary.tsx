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
 * components. It is remounted with the modal on every open, so a later open
 * gets a fresh attempt at rendering.
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

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <EggLoadError
        label={this.props.label}
        onClose={this.props.onClose}
        ownsClose={this.props.ownsClose}
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
}: {
  label: string;
  onClose: () => void;
  ownsClose: boolean;
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!ownsClose) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ownsClose]);

  return (
    <div className="p-4" role="alert">
      <EmptyState
        title={`Couldn't load ${label}`}
        action={
          ownsClose ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              icon={<X className="h-4 w-4" />}
            >
              Close
            </Button>
          ) : undefined
        }
      >
        The game didn&apos;t arrive — check your connection or reload the page, then try again.
      </EmptyState>
    </div>
  );
}
