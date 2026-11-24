import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPageMocks, service, session, toast } from "./support/blueprintPathMocks.ts";
import { PROJECT_SCOPE, pathFixture, renderPage, servePath } from "./support/blueprintPathPage.tsx";

vi.mock("../../../src/context/useAuth.ts", async () => {
  const { session } = await import("./support/blueprintPathMocks.ts");
  return { useAuth: () => ({ profile: { permissionGroup: session.permissionGroup } }) };
});
vi.mock("../../../src/features/projects/useProjectContext.ts", async () => {
  const { session } = await import("./support/blueprintPathMocks.ts");
  return {
    useProjectContext: () => ({
      selectedProjectId: session.selectedProjectId,
      isLoading: session.isProjectLoading,
    }),
  };
});
vi.mock("../../../src/context/useToast.ts", async () => {
  const { toast } = await import("./support/blueprintPathMocks.ts");
  return { useToast: () => toast };
});
vi.mock("../../../src/services/blueprintService.ts", async () => {
  const { service } = await import("./support/blueprintPathMocks.ts");
  return { blueprintService: service };
});

describe("BlueprintPathDetailPage loading and header", () => {
  beforeEach(() => {
    resetPageMocks();
    servePath(pathFixture("DRAFT"));
  });

  it("shows a loading state until the path arrives", async () => {
    renderPage();
    expect(screen.getByText(/Loading blueprint/)).toBeInTheDocument();
    expect(await screen.findByText("Backend onboarding")).toBeInTheDocument();
    expect(screen.queryByText(/Loading blueprint/)).not.toBeInTheDocument();
  });

  it("loads the path and its graph for the selected project", async () => {
    renderPage();
    await screen.findByText("Backend onboarding");
    expect(service.getPath).toHaveBeenCalledWith(PROJECT_SCOPE, "path-1");
    expect(service.getGraph).toHaveBeenCalledWith(PROJECT_SCOPE, "path-1");
  });

  it("loads in the global scope for an admin who asks for it", async () => {
    session.permissionGroup = "ADMIN";
    renderPage("/blueprints/path-1?scope=global");
    await screen.findByText("Backend onboarding");
    expect(service.getPath).toHaveBeenCalledWith({ kind: "global" }, "path-1");
  });

  it("ignores the global scope for anybody who is not an admin", async () => {
    renderPage("/blueprints/path-1?scope=global");
    await screen.findByText("Backend onboarding");
    expect(service.getPath).toHaveBeenCalledWith(PROJECT_SCOPE, "path-1");
  });

  it("shows the title, description and the version it is looking at", async () => {
    renderPage();
    expect(await screen.findByText("Backend onboarding")).toBeInTheDocument();
    expect(screen.getByText("For new backend hires")).toBeInTheDocument();
    expect(screen.getByText("Draft · v3")).toBeInTheDocument();
  });

  it("says so when the path has no description", async () => {
    servePath(pathFixture("DRAFT", { description: "" }));
    renderPage();
    expect(await screen.findByText("No path description yet.")).toBeInTheDocument();
  });

  it("reports a path that could not be loaded, with a way back", async () => {
    service.getPath.mockRejectedValue(new Error("Path is gone"));
    service.getGraph.mockResolvedValue({ nodes: [] });
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Path is gone");
    await user.click(screen.getByRole("button", { name: "Back to blueprints" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/blueprints");
    expect(screen.getByText("Blueprint list")).toBeInTheDocument();
  });

  it("falls back to a generic message when the failure carries none", async () => {
    service.getPath.mockRejectedValue("boom");
    service.getGraph.mockResolvedValue({ nodes: [] });
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Blueprint path could not be loaded.",
    );
  });

  it("leaves for the list when no project is selected", async () => {
    session.selectedProjectId = null;
    renderPage();
    expect(await screen.findByText("Blueprint list")).toBeInTheDocument();
    expect(service.getPath).not.toHaveBeenCalled();
  });

  it("waits for the project context before loading", async () => {
    session.isProjectLoading = true;
    renderPage();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(service.getPath).not.toHaveBeenCalled();
    expect(screen.queryByText("Blueprint list")).not.toBeInTheDocument();
  });

  it("goes back to the project's blueprint list", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "All blueprints" }));
    expect(screen.getByText("Blueprint list")).toBeInTheDocument();
  });

  it("goes back to the global list from the global scope", async () => {
    session.permissionGroup = "ADMIN";
    const user = userEvent.setup();
    renderPage("/blueprints/path-1?scope=global");
    await user.click(await screen.findByRole("button", { name: "All blueprints" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/blueprints?scope=global");
  });
});

describe("BlueprintPathDetailPage actions by status", () => {
  beforeEach(resetPageMocks);

  it("offers Publish on a draft", async () => {
    servePath(pathFixture("DRAFT"));
    renderPage();
    expect(await screen.findByRole("button", { name: "Publish" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit as draft" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Revert to this version" }),
    ).not.toBeInTheDocument();
  });

  it("offers Archive and Edit as draft on the published version", async () => {
    servePath(pathFixture("ACTIVE"));
    renderPage();
    expect(await screen.findByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit as draft" })).toBeInTheDocument();
    expect(screen.getByText("Published · v3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("offers only Revert on an archived version", async () => {
    servePath(pathFixture("ARCHIVED"));
    renderPage();
    expect(await screen.findByRole("button", { name: "Revert to this version" })).toBeEnabled();
    expect(screen.getByText("Archived · v3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("says what the version being looked at means", async () => {
    servePath(pathFixture("ACTIVE"));
    renderPage();
    expect(await screen.findByText("Published v3.")).toBeInTheDocument();
  });
});

describe("BlueprintPathDetailPage publishing and reverting", () => {
  beforeEach(resetPageMocks);

  it("publishes after confirmation, reloads the path and says so", async () => {
    const draft = pathFixture("DRAFT");
    servePath(draft);
    service.publishPath.mockResolvedValue(pathFixture("ACTIVE"));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Publish version 3?")).toBeInTheDocument();
    service.getPath.mockResolvedValue(pathFixture("ACTIVE"));
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(service.publishPath).toHaveBeenCalledWith(PROJECT_SCOPE, "path-1"));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Version 3 is now the published blueprint", {
        description: "New hires on this project are given it from now on.",
      }),
    );
    expect(await screen.findByText("Published · v3")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog open and shows why a publish failed", async () => {
    servePath(pathFixture("DRAFT"));
    service.publishPath.mockRejectedValue(new Error("Already published elsewhere"));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));

    expect(await within(dialog).findByText("Already published elsewhere")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("uses the action's own wording when the failure carries no message", async () => {
    servePath(pathFixture("DRAFT"));
    service.publishPath.mockRejectedValue("nope");
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));

    expect(
      await within(dialog).findByText("Blueprint could not be published."),
    ).toBeInTheDocument();
  });

  it("cancels a publish without sending anything", async () => {
    servePath(pathFixture("DRAFT"));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Publish" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(service.publishPath).not.toHaveBeenCalled();
  });

  it("reverts to an archived version in place when the address stays the same", async () => {
    servePath(pathFixture("ARCHIVED"));
    service.rollbackPath.mockResolvedValue({ id: "path-1" });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Revert to this version" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Revert to version 3?")).toBeInTheDocument();
    service.getPath.mockResolvedValue(pathFixture("ACTIVE"));
    await user.click(within(dialog).getByRole("button", { name: "Revert" }));

    await waitFor(() =>
      expect(service.rollbackPath).toHaveBeenCalledWith(PROJECT_SCOPE, "key-1", 3),
    );
    expect(await screen.findByText("Published · v3")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/blueprints/path-1");
  });

  it("follows a revert to the new address", async () => {
    servePath(pathFixture("ARCHIVED"));
    service.rollbackPath.mockResolvedValue({ id: "path-9" });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Revert to this version" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Revert" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/blueprints/path-9"),
    );
  });

  it("keeps the global scope when a revert moves to a new address", async () => {
    session.permissionGroup = "ADMIN";
    servePath(pathFixture("ARCHIVED"));
    service.rollbackPath.mockResolvedValue({ id: "path-9" });
    const user = userEvent.setup();
    renderPage("/blueprints/path-1?scope=global");

    await user.click(await screen.findByRole("button", { name: "Revert to this version" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Revert" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/blueprints/path-9?scope=global"),
    );
  });
});

describe("BlueprintPathDetailPage archiving and drafts", () => {
  beforeEach(resetPageMocks);

  it("archives after confirmation and returns to the list", async () => {
    servePath(pathFixture("ACTIVE"));
    service.archivePath.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Archive this blueprint?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(service.archivePath).toHaveBeenCalledWith(PROJECT_SCOPE, "key-1"));
    expect(toast.success).toHaveBeenCalledWith('"Backend onboarding" archived');
    expect(await screen.findByText("Blueprint list")).toBeInTheDocument();
  });

  it("reports an archive that failed and stays on the page", async () => {
    servePath(pathFixture("ACTIVE"));
    service.archivePath.mockRejectedValue(new Error("Cannot archive"));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Archive" }));

    expect(await screen.findByText("Cannot archive")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByText("Blueprint list")).not.toBeInTheDocument();
  });

  it("uses a generic message when the archive failure carries none", async () => {
    servePath(pathFixture("ACTIVE"));
    service.archivePath.mockRejectedValue("nope");
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Archive" }));

    expect(await screen.findByText("Blueprint path could not be archived.")).toBeInTheDocument();
  });

  it("opens a draft from the published version and moves to it", async () => {
    servePath(pathFixture("ACTIVE"));
    service.openDraft.mockResolvedValue({ id: "draft-1", version: 4 });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Edit as draft" }));

    await waitFor(() => expect(service.openDraft).toHaveBeenCalledWith(PROJECT_SCOPE, "key-1"));
    expect(toast.info).toHaveBeenCalledWith("Editing draft v4", {
      description: "Version 3 stays published until you publish this one.",
    });
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/blueprints/draft-1"),
    );
  });

  it("keeps the global scope when opening a draft", async () => {
    session.permissionGroup = "ADMIN";
    servePath(pathFixture("ACTIVE"));
    service.openDraft.mockResolvedValue({ id: "draft-1", version: 4 });
    const user = userEvent.setup();
    renderPage("/blueprints/path-1?scope=global");

    await user.click(await screen.findByRole("button", { name: "Edit as draft" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/blueprints/draft-1?scope=global"),
    );
  });

  it("reports a draft that could not be opened", async () => {
    servePath(pathFixture("ACTIVE"));
    service.openDraft.mockRejectedValue(new Error("A draft already exists"));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Edit as draft" }));

    expect(await screen.findByText("A draft already exists")).toBeInTheDocument();
  });

  it("uses a generic message when the draft failure carries none", async () => {
    servePath(pathFixture("ACTIVE"));
    service.openDraft.mockRejectedValue("nope");
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Edit as draft" }));

    expect(await screen.findByText("Draft could not be opened.")).toBeInTheDocument();
  });
});

describe("BlueprintPathDetailPage version history", () => {
  const history = [
    { id: "path-3", version: 3, status: "DRAFT", description: "Work in progress" },
    { id: "path-2", version: 2, status: "ACTIVE", description: "" },
    { id: "path-1", version: 1, status: "ARCHIVED", description: "First cut" },
  ];

  beforeEach(resetPageMocks);

  it("lists every version with its status", async () => {
    servePath(pathFixture("DRAFT"));
    service.getHistory.mockResolvedValue(history);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Version history" }));

    expect(await screen.findByText("Version 3")).toBeInTheDocument();
    expect(service.getHistory).toHaveBeenCalledWith(PROJECT_SCOPE, "key-1");
    expect(screen.getByText("Work in progress")).toBeInTheDocument();
    expect(screen.getByText("No description")).toBeInTheDocument();
    expect(screen.getByText("First cut")).toBeInTheDocument();
    expect(screen.getAllByText("Published").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Archived").length).toBeGreaterThan(0);
  });

  it("shows a loading line while the versions arrive", async () => {
    servePath(pathFixture("DRAFT"));
    service.getHistory.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Version history" }));

    expect(await screen.findByText(/Loading versions/)).toBeInTheDocument();
  });

  it("reports history that could not be loaded", async () => {
    servePath(pathFixture("DRAFT"));
    service.getHistory.mockRejectedValue(new Error("History is down"));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Version history" }));

    expect(await screen.findByText("History is down")).toBeInTheDocument();
  });

  it("uses a generic message when the history failure carries none", async () => {
    servePath(pathFixture("DRAFT"));
    service.getHistory.mockRejectedValue("nope");
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Version history" }));

    expect(await screen.findByText("Blueprint history could not be loaded.")).toBeInTheDocument();
  });

  it("opens the version that was picked", async () => {
    servePath(pathFixture("DRAFT"));
    service.getHistory.mockResolvedValue(history);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Version history" }));
    await user.click(await screen.findByRole("button", { name: /Version 2/ }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/blueprints/path-2"),
    );
  });

  it("keeps the global scope when a version is picked", async () => {
    session.permissionGroup = "ADMIN";
    servePath(pathFixture("DRAFT"));
    service.getHistory.mockResolvedValue(history);
    const user = userEvent.setup();
    renderPage("/blueprints/path-1?scope=global");

    await user.click(await screen.findByRole("button", { name: "Version history" }));
    await user.click(await screen.findByRole("button", { name: /Version 2/ }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/blueprints/path-2?scope=global"),
    );
  });

  it("offers deletion only for drafts", async () => {
    servePath(pathFixture("DRAFT"));
    service.getHistory.mockResolvedValue(history);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Version history" }));
    await screen.findByText("Version 3");

    expect(screen.getByRole("button", { name: "Delete draft version 3" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete draft version 2" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete draft version 1" }),
    ).not.toBeInTheDocument();
  });

  it("deletes another draft and drops it from the list", async () => {
    servePath(pathFixture("ACTIVE", { id: "path-1" }));
    service.getHistory.mockResolvedValue(history);
    service.deleteDraft.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Version history" }));
    await user.click(await screen.findByRole("button", { name: "Delete draft version 3" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete draft version 3?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete draft" }));

    await waitFor(() => expect(service.deleteDraft).toHaveBeenCalledWith(PROJECT_SCOPE, "path-3"));
    await waitFor(() => expect(screen.queryByText("Version 3")).not.toBeInTheDocument());
    expect(screen.getByText("Version 2")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/blueprints/path-1");
  });

  it("leaves for the list when the draft being looked at is deleted", async () => {
    servePath(pathFixture("DRAFT"));
    service.getHistory.mockResolvedValue([{ ...history[0], id: "path-1" }]);
    service.deleteDraft.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Version history" }));
    await user.click(await screen.findByRole("button", { name: "Delete draft version 3" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete draft" }));

    expect(await screen.findByText("Blueprint list")).toBeInTheDocument();
  });

  it("explains a draft that could not be deleted", async () => {
    servePath(pathFixture("ACTIVE"));
    service.getHistory.mockResolvedValue(history);
    service.deleteDraft.mockRejectedValue("nope");
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Version history" }));
    await user.click(await screen.findByRole("button", { name: "Delete draft version 3" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete draft" }));

    expect(
      await within(dialog).findByText("Blueprint draft could not be deleted."),
    ).toBeInTheDocument();
    expect(screen.getByText("Version 3")).toBeInTheDocument();
  });
});
