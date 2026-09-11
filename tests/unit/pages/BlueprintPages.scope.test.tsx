import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { BlueprintPathDetailPage } from "../../../src/pages/BlueprintPathDetailPage.tsx";
import { BlueprintPathsPage } from "../../../src/pages/BlueprintPathsPage.tsx";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    permissionGroup: "PM",
    selectedProjectId: "",
    isProjectLoading: false,
    getPaths: vi.fn(),
    getPath: vi.fn(),
  },
}));

vi.mock("../../../src/context/useAuth.ts", () => ({
  useAuth: () => ({ profile: { permissionGroup: mocks.permissionGroup } }),
}));

vi.mock("../../../src/features/projects/useProjectContext.ts", () => ({
  useProjectContext: () => ({
    selectedProjectId: mocks.selectedProjectId,
    isLoading: mocks.isProjectLoading,
  }),
}));

vi.mock("../../../src/services/blueprintService.ts", () => ({
  blueprintService: {
    getPaths: mocks.getPaths,
    getPath: mocks.getPath,
  },
}));

function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

describe("Blueprint project scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissionGroup = "PM";
    mocks.selectedProjectId = "";
    mocks.isProjectLoading = false;
    mocks.getPaths.mockResolvedValue([]);
  });

  it("shows a stable empty state without requesting an empty project id", async () => {
    render(
      <MemoryRouter initialEntries={["/blueprints"]}>
        <BlueprintPathsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No project available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New blueprint path" })).toBeDisabled();
    expect(mocks.getPaths).not.toHaveBeenCalled();
  });

  it("waits for project selection to finish before loading project blueprints", async () => {
    mocks.isProjectLoading = true;

    const { rerender } = render(
      <MemoryRouter initialEntries={["/blueprints"]}>
        <BlueprintPathsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading blueprint paths…")).toBeInTheDocument();
    await waitFor(() => expect(mocks.getPaths).not.toHaveBeenCalled());

    mocks.isProjectLoading = false;
    mocks.selectedProjectId = "project-1";
    rerender(
      <MemoryRouter initialEntries={["/blueprints"]}>
        <BlueprintPathsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(mocks.getPaths).toHaveBeenCalledWith({
        kind: "project",
        projectId: "project-1",
      }),
    );
    expect(mocks.getPaths).toHaveBeenCalledTimes(1);
  });

  it("still loads the global scope for an admin without a selected project", async () => {
    mocks.permissionGroup = "ADMIN";

    render(
      <MemoryRouter initialEntries={["/blueprints?scope=global"]}>
        <BlueprintPathsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getPaths).toHaveBeenCalledWith({ kind: "global" }));
  });

  it("returns an invalid project detail URL to the safe list without loading it", async () => {
    render(
      <MemoryRouter initialEntries={["/blueprints/path-1"]}>
        <Routes>
          <Route path="/blueprints" element={<LocationDisplay />} />
          <Route path="/blueprints/:pathId" element={<BlueprintPathDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/blueprints"));
    expect(mocks.getPath).not.toHaveBeenCalled();
  });
});
