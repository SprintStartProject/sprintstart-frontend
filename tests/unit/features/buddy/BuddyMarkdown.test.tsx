import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BuddyMarkdown } from "../../../../src/features/buddy/components/BuddyMarkdown";

function renderLink(href: string) {
  render(
    <MemoryRouter>
      <BuddyMarkdown content={`[the link](${href})`} />
    </MemoryRouter>,
  );
  return screen.getByRole("link", { name: "the link" });
}

describe("BuddyMarkdown links", () => {
  it("navigates in place for an app path", () => {
    const link = renderLink("/onboarding?step=s1");

    expect(link).toHaveAttribute("href", "/onboarding?step=s1");
    expect(link).not.toHaveAttribute("target");
  });

  it.each(["//evil.example", "https://example.com"])(
    "treats %s as somebody else's site",
    (href) => {
      expect(renderLink(href)).toHaveAttribute("target", "_blank");
    },
  );

  it("never hands a backslash path on as one that could leave the app", () => {
    // Browsers read `/\host` as `//host`. Markdown drops the backslash before it reaches the link,
    // and `isInAppPath` would refuse it if it ever did not.
    expect(renderLink("/\\evil.example").getAttribute("href")).not.toMatch(/^\/[\\/]/);
  });
});
