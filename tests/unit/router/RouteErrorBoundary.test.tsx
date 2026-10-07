import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteErrorBoundary } from "../../../src/router/RouteErrorBoundary";

/** A stand-in for a page whose chunk failed to load or whose render throws. */
function BrokenPage(): ReactNode {
  throw new Error("the chunk did not arrive");
}

const originalLocation = window.location;

describe("RouteErrorBoundary", () => {
  beforeEach(() => {
    // React reports the caught render error through console.error; the boundary logs it too.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    vi.restoreAllMocks();
  });

  it("renders its children while nothing fails", () => {
    render(
      <RouteErrorBoundary>
        <p>the page</p>
      </RouteErrorBoundary>,
    );

    expect(screen.getByText("the page")).toBeInTheDocument();
  });

  it("shows the failure card instead of unmounting, and reloads on request", async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });

    render(
      <RouteErrorBoundary>
        <BrokenPage />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("This page didn't load");

    await user.click(screen.getByRole("button", { name: "Reload page" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("clears the failure when the reset key changes, so the next route gets a clean attempt", () => {
    const view = render(
      <RouteErrorBoundary resetKey="/broken">
        <BrokenPage />
      </RouteErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("This page didn't load");

    view.rerender(
      <RouteErrorBoundary resetKey="/next">
        <p>the next page</p>
      </RouteErrorBoundary>,
    );

    expect(screen.getByText("the next page")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps its children mounted when the reset key changes — recovery must not remount the tree", () => {
    const view = render(
      <RouteErrorBoundary resetKey="/buddy/a">
        <p data-testid="kept">the page</p>
      </RouteErrorBoundary>,
    );
    const before = screen.getByTestId("kept");

    view.rerender(
      <RouteErrorBoundary resetKey="/buddy/b">
        <p data-testid="kept">the page</p>
      </RouteErrorBoundary>,
    );

    // The same DOM node: the boundary reset its state without unmounting the page below it,
    // which is what keeps buddy conversations and the PM workspace mounted across navigation.
    expect(screen.getByTestId("kept")).toBe(before);
  });

  it("renders a host-supplied fallback instead of the page card", () => {
    render(
      <RouteErrorBoundary fallback={<p role="alert">the artifact didn&apos;t open</p>}>
        <BrokenPage />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("the artifact didn't open");
    expect(screen.queryByText("This page didn't load")).not.toBeInTheDocument();
  });
});
