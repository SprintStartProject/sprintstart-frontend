import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConversationRail } from "../../../../src/components/layout/ConversationRail";

describe("ConversationRail", () => {
  it("is one element, not one per breakpoint", () => {
    render(
      <ConversationRail isOpen label="Sent to your PM">
        <p>the only copy</p>
      </ConversationRail>,
    );

    // The chat's rail renders its list twice and hides one per breakpoint, which puts the same
    // content in the document twice — invisible on the page, a plain duplicate to anything
    // reading it. Switching `position` at the breakpoint gets both behaviours out of one node.
    expect(screen.getAllByText("the only copy")).toHaveLength(1);
  });

  it("is out of reach while it is closed", () => {
    render(
      <ConversationRail isOpen={false} label="Sent to your PM">
        <button type="button">answered</button>
      </ConversationRail>,
    );

    // A collapsed `w-0 overflow-hidden` column is still focusable: Tab walks into a rail
    // nobody can see, which is the version of this bug only keyboard users ever meet.
    expect(screen.queryByRole("complementary", { name: "Sent to your PM" })).toBeNull();
    expect(screen.queryByRole("button", { name: "answered" })).toBeNull();
  });

  it("never hides itself at a breakpoint", () => {
    render(
      <ConversationRail isOpen label="Sent to your PM">
        <p>reachable</p>
      </ConversationRail>,
    );

    // `hidden … xl:*` is what once put the PM's answer out of reach below 1280px entirely.
    const rail = screen.getByRole("complementary", { name: "Sent to your PM" });
    expect(rail.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });
  /**
   * As a drawer the rail covers the page you were reading, and a panel that can only be put
   * away by finding its cross is the complaint the app's own mobile sidebar already answers.
   * A `button` rather than a `div` with a click handler: it is a real control, so it has a
   * name and the keyboard can reach it.
   */
  it("closes from the backdrop while it is a drawer", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(
      <ConversationRail
        isOpen
        label="Sent to your PM"
        onDismiss={onDismiss}
        dismissLabel="Close the PM replies"
      >
        <p>answered</p>
      </ConversationRail>,
    );

    await user.click(screen.getByRole("button", { name: "Close the PM replies" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("has no backdrop to press while it is closed", () => {
    const onDismiss = vi.fn();

    render(
      <ConversationRail isOpen={false} label="Sent to your PM" onDismiss={onDismiss}>
        <p>answered</p>
      </ConversationRail>,
    );

    expect(screen.queryByRole("button", { name: /Close/ })).toBeNull();
  });
});
