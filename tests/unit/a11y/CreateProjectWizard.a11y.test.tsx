import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { CreateProjectWizard } from "../../../src/features/admin/components/CreateProjectWizard";
import { mockViewport } from "../setup/matchMedia";

vi.mock("../../../src/services/projectService", () => ({
  projectService: {
    createProject: vi.fn(),
    getManagerCandidates: vi.fn().mockResolvedValue([]),
    setProjectManager: vi.fn(),
    assignUsersToProject: vi.fn(),
  },
}));

vi.mock("../../../src/services/sources/githubService", () => ({
  getGithubPatNames: vi.fn().mockResolvedValue(["team-pat"]),
  discoverRepositories: vi.fn(),
  connectGithubRepository: vi.fn(),
  addRepositoryToProject: vi.fn(),
  addGithubPat: vi.fn(),
}));

vi.mock("../../../src/services/sources/bitbucketService", () => ({
  discoverBitbucketRepositories: vi.fn().mockResolvedValue({
    repositories: [
      {
        workspace: "acme",
        slug: "widgets",
        name: "Widgets",
        isPrivate: true,
        url: "https://bitbucket.org/acme/widgets",
        alreadyConnected: false,
        isEnabled: null,
      },
    ],
    hasMore: false,
  }),
  connectBitbucketRepository: vi.fn(),
  addBitbucketRepositoryToProject: vi.fn(),
}));

vi.mock("../../../src/services/ingestionService", () => ({
  getIngestionSourceStatuses: vi.fn().mockResolvedValue([]),
}));

function renderWizard() {
  return render(
    <MemoryRouter>
      <CreateProjectWizard
        isOpen
        tokenNames={["team-pat"]}
        users={[]}
        onClose={vi.fn()}
        onProjectCreated={vi.fn()}
      />
    </MemoryRouter>,
  );
}

/**
 * Lets the modal's mount-time autofocus run before typing: `Modal` grabs focus
 * inside a `requestAnimationFrame`, and a frame firing midway through typing
 * would pull the caret off the field and drop the remaining keystrokes.
 */
async function settleModalFocus() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
}

/** Details → members → sources. */
async function goToSources(user: ReturnType<typeof userEvent.setup>) {
  await settleModalFocus();
  await user.type(screen.getByLabelText(/^Name/), "Apollo");
  await user.click(screen.getByRole("button", { name: /continue/i }));
  await user.click(screen.getByRole("button", { name: /continue/i }));
}

/** From the sources step, open the add-source flow and pick the GitHub type. */
async function openGithubDetail(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /add source/i }));
  await user.click(screen.getByRole("button", { name: /indexes repositories/i }));
}

/** From the sources step, open the add-source flow and pick the Bitbucket type. */
async function openBitbucketDetail(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /add source/i }));
  await user.click(screen.getByRole("button", { name: /indexes pull requests, readme/i }));
}

describe("CreateProjectWizard Accessibility", () => {
  beforeEach(() => {
    // Narrowest layout by default — the credential form opens inline. The
    // companion test flips this to a desktop viewport for itself.
    mockViewport(false);
  });

  afterEach(() => {
    // `mockViewport` swaps the global `matchMedia` out without restoring it.
    // Put the suite default (narrowest) back, so a test added after the
    // desktop-flipping one cannot inherit the wide viewport by accident.
    mockViewport(false);
  });

  it("has no axe violations on the details step", async () => {
    const { baseElement } = renderWizard();

    await screen.findByRole("dialog", { name: "New Project" });
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toBeInTheDocument());

    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("carries required and optional semantics into the fields", async () => {
    const { baseElement } = renderWizard();

    await screen.findByRole("dialog", { name: "New Project" });
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toBeInTheDocument());

    // Required: announced on the control itself, since the asterisk is
    // aria-hidden decoration. Optional: printed into the label everyone reads.
    expect(screen.getByLabelText(/^Name/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByLabelText("Description (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Industry (optional)")).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no axe violations on the sources step", async () => {
    const user = userEvent.setup();
    const { baseElement } = renderWizard();

    await screen.findByRole("dialog", { name: "New Project" });
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toBeInTheDocument());
    await goToSources(user);

    expect(screen.getByRole("button", { name: /add source/i })).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no axe violations with the inline GitHub token form open", async () => {
    const user = userEvent.setup();
    const { baseElement } = renderWizard();

    await screen.findByRole("dialog", { name: "New Project" });
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toBeInTheDocument());
    await goToSources(user);
    await openGithubDetail(user);

    await user.click(screen.getByRole("button", { name: /add github token/i }));

    expect(await screen.findByLabelText(/^Token name/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByLabelText(/^Token \(ghp_/)).toHaveAttribute("aria-required", "true");
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no axe violations with the desktop token companion open", async () => {
    mockViewport(true);
    const user = userEvent.setup();
    const { baseElement } = renderWizard();

    await screen.findByRole("dialog", { name: "New Project" });
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toBeInTheDocument());
    await goToSources(user);
    await openGithubDetail(user);

    await user.click(screen.getByRole("button", { name: /add github token/i }));

    // At or above 1280px the form slides in beside the wizard, portalled to
    // <body> — `baseElement` is the whole body, so axe sees it too.
    expect(await screen.findByRole("dialog", { name: "New GitHub token" })).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no axe violations on the Bitbucket detail", async () => {
    const user = userEvent.setup();
    const { baseElement } = renderWizard();

    await screen.findByRole("dialog", { name: "New Project" });
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toBeInTheDocument());
    await goToSources(user);
    await openBitbucketDetail(user);

    // No credential is stored in this suite, so the form is locked and the chip says why.
    expect(await screen.findByText("No credential yet")).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no axe violations with the inline Atlassian credential form open on the Bitbucket detail", async () => {
    const user = userEvent.setup();
    const { baseElement } = renderWizard();

    await screen.findByRole("dialog", { name: "New Project" });
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toBeInTheDocument());
    await goToSources(user);
    await openBitbucketDetail(user);

    await user.click(screen.getByRole("button", { name: /add atlassian credential/i }));

    expect(await screen.findByTestId("settings-atlassian-add-email")).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
