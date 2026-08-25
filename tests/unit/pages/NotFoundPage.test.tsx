import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { NotFoundPage } from "../../../src/pages/NotFoundPage";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

const mockShell = vi.fn();
vi.mock("../../../src/features/easter-eggs/components/EggModalShell", () => ({
  EggModalShell: (props: { open: boolean; eggId: string }) => {
    mockShell(props);
    return props.open ? <div data-testid="egg-modal" /> : null;
  },
}));

describe("NotFoundPage", () => {
  it("renders 404 heading and a return button", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("404 Not Found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /return to dashboard/i })).toBeInTheDocument();
  });

  it("does NOT open the game on arrival - only after clicking the rocket teaser", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    // The page arrives alone: no modal covering it.
    expect(screen.queryByTestId("egg-modal")).not.toBeInTheDocument();

    // The teaser is a small muted row, not an obvious CTA.
    const teaser = screen.getByRole("button", { name: /open space invaders/i });
    expect(teaser).toHaveTextContent("While you wait for your manager");
    expect(teaser).toHaveTextContent("🚀");

    fireEvent.click(teaser);
    expect(screen.getByTestId("egg-modal")).toBeInTheDocument();
    expect(mockShell).toHaveBeenCalledWith(expect.objectContaining({ eggId: "space-invaders" }));
  });
});
