import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

type RouteErrorBoundaryProps = { children: ReactNode };
type RouteErrorBoundaryState = { failed: boolean };

/**
 * Catches a page that fails to load or render and keeps the rest of the app standing.
 *
 * Every page below `AppRouter` arrives as a lazy chunk, and a chunk can fail — a stale deploy
 * whose hashed file is gone, or the network dropping mid-fetch — while any page's render can
 * throw. Without a boundary either failure travels to the React root and unmounts the whole
 * app, sidebar included, for one page's problem. Here it stays inside the page area, and a
 * reload is the one action that reliably retries a rejected chunk: `React.lazy` caches the
 * rejection for the page's lifetime, so an in-place "try again" cannot.
 *
 * The host keys this by pathname (`AppRouter` does): navigating away remounts the boundary, so
 * a broken page never traps the reader — the next route gets a clean attempt.
 */
export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  override state: RouteErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Deliberately logged: a failed chunk or a broken render is something the user cannot
    // diagnose, and the console is where whoever debugs it looks.
    console.error("A page failed to load or render", error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="mx-auto max-w-md p-6" role="alert">
        <EmptyState
          title="This page didn't load"
          action={
            <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          }
        >
          Something went wrong while opening this page. Reloading usually fixes it — if it keeps
          happening, a new deployment may have replaced the files this page was built from.
        </EmptyState>
      </div>
    );
  }
}
