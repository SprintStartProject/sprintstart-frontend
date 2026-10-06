import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MainContent } from "../../../../src/components/layout/MainContent";
import {
  MAIN_CONTENT_ID,
  requestMainContentFocus,
} from "../../../../src/components/layout/mainFocus";

describe("MainContent", () => {
  afterEach(() => {
    // A request nobody claimed would leak into the next test through the module state.
    const { unmount } = render(<MainContent />);
    unmount();
  });

  it("is the page's main landmark, reachable by the skip link and by script", () => {
    render(<MainContent>page</MainContent>);

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", MAIN_CONTENT_ID);
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("takes focus when a route change asks for it", () => {
    render(<MainContent>page</MainContent>);

    requestMainContentFocus();

    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("keeps focus that a page has already put inside itself", () => {
    render(
      <MainContent>
        <input aria-label="Search" />
      </MainContent>,
    );
    screen.getByLabelText("Search").focus();

    requestMainContentFocus();

    expect(screen.getByLabelText("Search")).toHaveFocus();
  });

  it("hands a request made while the route was still loading to the first real page", () => {
    requestMainContentFocus();

    render(<MainContent>page</MainContent>);

    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("does not let a loading skeleton swallow that request", () => {
    requestMainContentFocus();

    const skeleton = render(<MainContent placeholder>loading</MainContent>);
    expect(screen.getByRole("main")).not.toHaveFocus();
    skeleton.unmount();

    render(<MainContent>page</MainContent>);
    expect(screen.getByRole("main")).toHaveFocus();
  });
});
