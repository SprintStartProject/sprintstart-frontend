import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
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
});
