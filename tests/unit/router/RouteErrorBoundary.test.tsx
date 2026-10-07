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
});
