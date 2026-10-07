import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

type RouteErrorBoundaryProps = {
  children: ReactNode;
  /**
   * The surface's identity for recovery. When it changes while the failure is showing, the
   * failure clears and the next route gets a clean attempt — a state reset, not a remount:
   * keying the boundary instead would tear down the whole tree below it on every pathname
   * change, which is exactly what the app's grouped transitions (all `/buddy` addresses, the
   * PM workspace) exist to avoid.
   */
  resetKey?: string;
  /**
   * What to show in place of the children when they fail. Defaults to the page-sized card;
   * surfaces that are not a page (the buddy's citation drawer) pass their own compact state.
   */
  fallback?: ReactNode;
};
type RouteErrorBoundaryState = { failed: boolean };

/**
 * Catches a surface that fails to load or render and keeps the rest of the app standing.
 *
 * Every page below `AppRouter` arrives as a lazy chunk, and a chunk can fail — a stale deploy
 * whose hashed file is gone, or the network dropping mid-fetch — while any render can throw.
 * Without a boundary either failure travels to the React root and unmounts the whole app,
 * sidebar included, for one surface's problem. Here it stays local, and a reload is the one
 * action that reliably retries a rejected chunk: `React.lazy` caches the rejection for the
 * module's lifetime, so an in-place "try again" cannot.
 *
 * `AppRouter` passes the pathname as `resetKey`: navigating away clears the failure, so a
 * broken page never traps the reader. The buddy's citation drawer uses the boundary without a
 * reset key — it unmounts with the drawer, and its compact fallback offers the one reliable
 * retry: a reload.
 */
export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  override state: RouteErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { failed: true };
  }

  override componentDidUpdate(previous: RouteErrorBoundaryProps): void {
    // Clear the failure when the surface changes, so the next route gets a clean attempt.
    // A state reset rather than a remount: the pages below keep their mounts, which the
    // app's transition keys (buddy, PM workspace) are built around.
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Deliberately logged: a failed chunk or a broken render is something the user cannot
    // diagnose, and the console is where whoever debugs it looks.
    console.error("A page failed to load or render", error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

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
