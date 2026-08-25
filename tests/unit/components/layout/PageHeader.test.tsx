import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PageHeader } from "../../../../src/components/layout/PageHeader";
import { Home } from "lucide-react";

describe("PageHeader", () => {
  it("renders a plain (non-clickable) icon without an onIconClick handler", () => {
    render(<PageHeader icon={Home} title="Plain" subtitle="Sub" />);
    expect(screen.getByRole("heading", { name: "Plain" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the icon as a button when onIconClick is given", () => {
    render(<PageHeader icon={Home} title="Clickable" onIconClick={() => {}} />);
    expect(screen.getByRole("button", { name: "Clickable icon" })).toBeInTheDocument();
  });

  it("marks the icon with data-egg-hint only when eggHint is set", () => {
    const { rerender } = render(
      <PageHeader icon={Home} title="Egg" onIconClick={() => {}} eggHint />,
    );
    expect(screen.getByRole("button", { name: "Egg icon" })).toHaveAttribute(
      "data-egg-hint",
      "true",
    );

    rerender(<PageHeader icon={Home} title="No egg" onIconClick={() => {}} />);
    expect(screen.getByRole("button", { name: "No egg icon" })).not.toHaveAttribute(
      "data-egg-hint",
    );
  });

  it("keeps the hint purely decorative: the accessible name does not change", () => {
    render(
      <div>
        <PageHeader icon={Home} title="Settings" onIconClick={() => {}} eggHint />
        <PageHeader icon={Home} title="Settings" onIconClick={() => {}} />
      </div>,
    );
    const buttons = screen.getAllByRole("button", { name: "Settings icon" });
    expect(buttons).toHaveLength(2);
  });
});
