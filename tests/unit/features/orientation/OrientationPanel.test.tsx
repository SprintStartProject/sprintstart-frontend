import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrientationPanel } from "../../../../src/features/orientation/components/OrientationPanel";
import { onboardingFeedbackService } from "../../../../src/services/onboardingFeedbackService";
import type { MyOrientation } from "../../../../src/features/orientation/types";

const withPacket: MyOrientation = {
  taskId: "task-1",
  taskTitle: "Fix the stale cache header",
  taskUrl: "https://github.com/acme/repo/issues/42",
  reason: null,
  packet: {
    taskId: "task-1",
    taskTitle: "Fix the stale cache header",
    summary: "What you need to change the header.",
    sections: [
      {
        step: "SET_UP",
        title: "Run it locally",
        body: "Run `make dev`.",
        citations: [
          {
            filename: "README.md",
            chunkId: "c1",
            sourceUrl: "https://example.test/README.md",
          },
        ],
      },
      {
        step: "OPEN_THE_PR",
        title: "How review works here",
        body: "One approving review is required.",
        citations: [{ filename: "CONTRIBUTING.md", chunkId: "c2", sourceUrl: null }],
      },
    ],
    sources: [
      {
        filename: "README.md",
        sourceUrl: "https://example.test/README.md",
        artifactType: "FILE",
      },
    ],
    assembledAt: "2026-07-21T12:00:00Z",
    origin: "AI",
  },
};

describe("OrientationPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("shows every step of the packet, with the first one open", () => {
    render(
      <OrientationPanel
        orientation={withPacket}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Run it locally")).toBeInTheDocument();
    expect(screen.getByText("How review works here")).toBeInTheDocument();
    // Only the first step's body is expanded on a first visit.
    expect(screen.getByText("make dev")).toBeInTheDocument();
    expect(screen.queryByText("One approving review is required.")).not.toBeInTheDocument();
  });

  it("shows where each claim came from as an openable link, not a tooltip", () => {
    render(
      <OrientationPanel
        orientation={withPacket}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    const link = screen.getAllByRole("link", { name: /README\.md/ })[0];
    expect(link).toHaveAttribute("href", "https://example.test/README.md");
  });

  it("names a source that has no URL rather than dropping it", async () => {
    render(
      <OrientationPanel
        orientation={withPacket}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /How review works here/ }));

    expect(screen.getByText("CONTRIBUTING.md")).toBeInTheDocument();
  });

  it("remembers which steps are open across visits", async () => {
    const { unmount } = render(
      <OrientationPanel
        orientation={withPacket}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    // A hire who has done setup collapses it and expands the PR step.
    await userEvent.click(screen.getByRole("button", { name: /Run it locally/ }));
    await userEvent.click(screen.getByRole("button", { name: /How review works here/ }));
    unmount();

    render(
      <OrientationPanel
        orientation={withPacket}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.queryByText("make dev")).not.toBeInTheDocument();
    expect(screen.getByText("One approving review is required.")).toBeInTheDocument();
  });

  it("offers a fix-this affordance only when an editor is wired", async () => {
    const onEdit = vi.fn();
    const { rerender } = render(
      <OrientationPanel
        orientation={withPacket}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );
    // No onEdit: no edit affordance, and no dead "report" button either.
    expect(screen.queryByTestId("edit-orientation")).not.toBeInTheDocument();

    rerender(
      <OrientationPanel
        orientation={withPacket}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        onEdit={onEdit}
      />,
    );
    await userEvent.click(screen.getByTestId("edit-orientation"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("badges a human-authored packet and can still edit it", () => {
    const onEdit = vi.fn();
    render(
      <OrientationPanel
        orientation={{ ...withPacket, packet: { ...withPacket.packet!, origin: "HUMAN" } }}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText(/Written by a person/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit/ })).toBeInTheDocument();
  });

  it("lets a hire write orientation when the corpus grounded nothing", async () => {
    const onEdit = vi.fn();
    render(
      <OrientationPanel
        orientation={{
          taskId: "task-1",
          taskTitle: "Fix the stale cache header",
          taskUrl: "https://github.com/acme/repo/issues/42",
          packet: null,
          reason: "corpus is empty",
        }}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        onEdit={onEdit}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Write it yourself/ }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("never invents a packet when one could not be assembled", () => {
    render(
      <OrientationPanel
        orientation={{
          taskId: "task-1",
          taskTitle: "Fix the stale cache header",
          taskUrl: "https://github.com/acme/repo/issues/42",
          packet: null,
          reason: "corpus is empty",
        }}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText(/no guide here/)).toBeInTheDocument();
    expect(screen.getByText(/corpus is empty/)).toBeInTheDocument();
    // The task itself is still reachable, so the hire is not left with nothing.
    expect(screen.getByRole("link", { name: /Fix the stale cache header/ })).toHaveAttribute(
      "href",
      "https://github.com/acme/repo/issues/42",
    );
  });

  it("offers a retry when the load itself failed", async () => {
    const onRetry = vi.fn();
    render(
      <OrientationPanel
        orientation={null}
        isLoading={false}
        error="Could not load your orientation."
        onRetry={onRetry}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when the hire has no current task", () => {
    const { container } = render(
      <OrientationPanel
        orientation={{
          taskId: null,
          taskTitle: null,
          taskUrl: null,
          packet: null,
          reason: null,
        }}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("lists the material the packet was assembled from", () => {
    render(
      <OrientationPanel
        orientation={withPacket}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    const assembledFrom = screen.getByText("Assembled from").parentElement;
    expect(within(assembledFrom as HTMLElement).getByText("README.md")).toBeInTheDocument();
  });

  /**
   * Correcting the packet was the *only* affordance, and it is the one a newcomer is least able
   * to use: somebody three days in can tell a setup step is stale without knowing what replaced
   * it, and editing shared material on a hunch is worse than saying nothing.
   */
  describe("reporting a problem without fixing it", () => {
    it("sends the report with what it is about, written by the app", async () => {
      const report = vi
        .spyOn(onboardingFeedbackService, "reportProblem")
        .mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(
        <OrientationPanel
          orientation={withPacket}
          isLoading={false}
          error={null}
          onRetry={vi.fn()}
          canReport
        />,
      );

      await user.click(screen.getByTestId("report-orientation"));
      await user.type(
        screen.getByLabelText("What looks wrong with this orientation"),
        "make dev was removed months ago.",
      );
      await user.click(screen.getByRole("button", { name: "Send" }));

      // The subject is the app's, not the hire's to remember — a report whose subject the
      // reader has to infer is a report nobody acts on. It is shown before sending, too.
      expect(report).toHaveBeenCalledWith(
        'About the orientation for "Fix the stale cache header": make dev was removed months ago.',
      );
      expect(await screen.findByTestId("orientation-report-sent")).toBeInTheDocument();
    });

    /** Reporting is not editing: nothing anybody else reads has moved. */
    it("says the guide is unchanged once the report is in", async () => {
      vi.spyOn(onboardingFeedbackService, "reportProblem").mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(
        <OrientationPanel
          orientation={withPacket}
          isLoading={false}
          error={null}
          onRetry={vi.fn()}
          canReport
        />,
      );

      await user.click(screen.getByTestId("report-orientation"));
      await user.type(screen.getByLabelText("What looks wrong with this orientation"), "wrong");
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByText(/the guide above is unchanged/i)).toBeInTheDocument();
      expect(screen.getByText("Run it locally")).toBeInTheDocument();
    });

    /** Somebody who has just typed out what is wrong must not have to type it again. */
    it("keeps what was typed when sending fails", async () => {
      vi.spyOn(onboardingFeedbackService, "reportProblem").mockRejectedValue(new Error("offline"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      const user = userEvent.setup();

      render(
        <OrientationPanel
          orientation={withPacket}
          isLoading={false}
          error={null}
          onRetry={vi.fn()}
          canReport
        />,
      );

      await user.click(screen.getByTestId("report-orientation"));
      const box = screen.getByLabelText("What looks wrong with this orientation");
      await user.type(box, "the script is gone");
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByText(/could not be sent/i)).toBeInTheDocument();
      expect(box).toHaveValue("the script is gone");
    });

    /**
     * A PM owns this content. Offering them a control that reports it to themselves is a
     * loop with one person in it, and the panel is shared by both surfaces — which is exactly
     * why the control is opt-in rather than always on.
     */
    it("is absent unless the surface asks for it", () => {
      render(
        <OrientationPanel
          orientation={withPacket}
          isLoading={false}
          error={null}
          onRetry={vi.fn()}
        />,
      );

      expect(screen.queryByTestId("report-orientation")).not.toBeInTheDocument();
    });

    /** "This is wrong" needs a *this*; the no-packet state already routes to the buddy. */
    it("is absent when there is no packet to be wrong about", () => {
      render(
        <OrientationPanel
          orientation={{ ...withPacket, packet: null, reason: "nothing matched" }}
          isLoading={false}
          error={null}
          onRetry={vi.fn()}
          canReport
        />,
      );

      expect(screen.queryByTestId("report-orientation")).not.toBeInTheDocument();
    });
  });
});
