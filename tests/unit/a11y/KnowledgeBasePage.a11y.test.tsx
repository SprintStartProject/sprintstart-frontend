import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { KnowledgeBasePage } from "../../../src/pages/KnowledgeBasePage";

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  const project = createSelectableProject({ id: "proj1" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "proj1",
        canManageSelected: true,
      }),
  };
});

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: {
      id: "user1",
      firstName: "Test",
      username: "Test",
      email: "test@test.com",
      projectIds: ["proj1"],
    },
  }),
}));

const { mockArtifacts } = vi.hoisted(() => ({
  mockArtifacts: [
    {
      id: "a1",
      title: "Add feature",
      artifactType: "PULL_REQUEST",
      sourceSystem: "GITHUB",
      sourceId: "42",
      sourceUrl: null,
      mime: null,
      language: null,
      ingestedAt: "2024-01-01",
      lastChangedAt: null,
      contentHash: null,
      ingestionRunId: null,
    },
    {
      id: "a2",
      title: "manual.pdf",
      artifactType: "FILE",
      sourceSystem: "UPLOAD",
      sourceId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      sourceUrl: null,
      mime: null,
      language: null,
      ingestedAt: "2024-01-01",
      lastChangedAt: null,
      contentHash: null,
      ingestionRunId: null,
    },
  ],
}));

vi.mock("../../../src/services/knowledgeService", () => ({
  knowledgeService: {
    getUnifiedArtifacts: vi.fn().mockResolvedValue(mockArtifacts),
    getArtifactPage: vi.fn().mockResolvedValue({
      items: mockArtifacts,
      metadata: {
        pageNumber: 1,
        pageSize: 20,
        totalElements: mockArtifacts.length,
        totalPages: 1,
        isFirst: true,
        isLast: true,
        hasNext: false,
        hasPrevious: false,
      },
    }),
    getArtifactFacets: vi.fn().mockResolvedValue({
      types: [
        { value: "PULL_REQUEST", count: 1 },
        { value: "FILE", count: 1 },
      ],
      sources: [
        { value: "GITHUB", count: 1 },
        { value: "UPLOAD", count: 1 },
      ],
      formats: [{ value: "PDF", count: 1 }],
      repositories: [],
    }),
    getArtifactById: vi.fn().mockImplementation((_pid: string, id: string) => {
      return Promise.resolve(mockArtifacts.find((a) => a.id === id) ?? null);
    }),
  },
}));

describe("KnowledgeBasePage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /knowledge base/i })).toBeInTheDocument();
    });

    expect(await axe(baseElement)).toHaveNoViolations();
  });

  /*
    The filter popover is portaled into `<body>`, so a scan of the page as it first renders never
    sees it. It is also the only place in the app where a checkbox group sits behind a disclosure —
    the pattern with the most ways to get the roles wrong.
  */
  it("should not have any a11y violations with the filter menu open", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("kb-filter-trigger")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));
    expect(screen.getByTestId("kb-filter-menu")).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
