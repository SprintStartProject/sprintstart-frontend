import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { NotFoundPage } from "../../../src/pages/NotFoundPage";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("../../../src/features/space-invaders/components/SpaceInvadersModal", () => ({
  SpaceInvadersModal: () => null,
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
});
