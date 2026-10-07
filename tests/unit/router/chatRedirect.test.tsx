import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppRouter } from "../../../src/router/AppRouter";

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: {
      id: "u1",
      username: "sam",
      permissionGroup: "USER",
      hasCompletedOnboarding: true,
    },
  }),
}));

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  const project = createSelectableProject({ id: "p1", name: "Project One" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: "p1",
        projects: [project],
        selectedProject: project,
      }),
  };
});

// What is under test is where the old addresses land, not the guard or the page itself.
vi.mock("../../../src/router/AuthGuard", () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../src/pages/BuddyPage", async () => {
  const { useLocation, useParams } = await import("react-router-dom");

  return {
    BuddyPage: function BuddyPageStub() {
      const { pathname } = useLocation();
      const { id } = useParams();

      return <div>{`buddy page at ${pathname}${id ? ` for ${id}` : ""}`}</div>;
    },
  };
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>,
  );
}

/**
 * The chat is retired, and its addresses — bookmarks, old board links, a sidebar habit — land on
 * the one conversation surface rather than on a 404. `/chat/:id` keeps its id: the backfill that
 * ran before the chat tables were dropped copied each chat's id onto the session it created, so
 * an old "Keep this chat" card still names a conversation that can open — and an id with no
 * conversation behind it falls back to the bare page inside `BuddyPage`, never a 404.
 */
describe("the retired chat's addresses", () => {
  it("send /chat to the buddy page", async () => {
    renderAt("/chat");

    expect(await screen.findByText("buddy page at /buddy")).toBeInTheDocument();
  });

  it("carry /chat/:id to the conversation it names", async () => {
    renderAt("/chat/old-chat-id");

    expect(
      await screen.findByText("buddy page at /buddy/old-chat-id for old-chat-id"),
    ).toBeInTheDocument();
  });

  it("serve one conversation at /buddy/:id", async () => {
    renderAt("/buddy/s1");

    expect(await screen.findByText("buddy page at /buddy/s1 for s1")).toBeInTheDocument();
  });
});
