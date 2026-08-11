import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TeamManagementPage } from "../../../src/pages/TeamManagementPage";
import { http } from "msw";
import { server } from "../../unit/setup/vitest.setup";

describe("TeamManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", () => {
    server.use(
      http.get("/api/v1/onboarding/team-overview", () => {
        return new Promise<never>(() => {});
      }),
    );

    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading team overview...")).toBeInTheDocument();
  });

  it("offers user and role management, and nothing else", async () => {
    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /User Management/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Role Management/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Project Management/ })).not.toBeInTheDocument();
  });

  it("renders members and roles after loading", async () => {
    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    });
  });

  it("filters members by role", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("combobox", { name: "Filter team members by role" }));
    await user.click(await screen.findByRole("option", { name: "Backend" }));

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
    });
  });

  it("sorts members by progress", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("combobox", { name: "Sort team members" }));
    await user.click(await screen.findByRole("option", { name: "Lowest progress" }));

    await waitFor(() => {
      const nameElements = screen.getAllByText(/(Bob Jones|Alice Smith)/);
      const textContent = nameElements.map((el) => el.textContent);
      expect(textContent).toEqual(["Bob Jones", "Alice Smith"]);
    });
  });
});
