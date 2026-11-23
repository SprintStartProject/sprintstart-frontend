import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DepartureForm } from "../../../../src/features/offboarding";

function setup(busy = false) {
  const onSubmit = vi.fn();
  render(<DepartureForm busy={busy} onSubmit={onSubmit} />);
  return { onSubmit, user: userEvent.setup() };
}

describe("DepartureForm", () => {
  it("adds a typed person as a chip and clears the field", async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText("Who is leaving?"), "ada@example.com{Enter}");

    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Who is leaving?")).toHaveValue("");
  });

  it("adds several pasted people at once", async () => {
    const { user } = setup();

    await user.click(screen.getByLabelText("Who is leaving?"));
    await user.paste("ada, ben carol");
    await user.click(screen.getByRole("button", { name: "Add person" }));

    const chips = screen.getByRole("list", { name: "People who are leaving" });
    expect(chips).toHaveTextContent("ada");
    expect(chips).toHaveTextContent("ben");
    expect(chips).toHaveTextContent("carol");
  });

  it("removes a person again", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Who is leaving?"), "ada{Enter}ben{Enter}");

    await user.click(screen.getByRole("button", { name: "Remove ada" }));

    expect(screen.queryByText("ada")).not.toBeInTheDocument();
    expect(screen.getByText("ben")).toBeInTheDocument();
  });

  it("does not submit without anybody leaving and says why", async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole("button", { name: "Rank files" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Name at least one person");
  });

  it("submits the departure with its date and review weight", async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText("Who is leaving?"), "ada{Enter}");
    await user.type(screen.getByLabelText("As of"), "2026-11-20");
    await user.type(screen.getByLabelText("Review weight"), "0.5");

    await user.click(screen.getByRole("button", { name: "Rank files" }));

    expect(onSubmit).toHaveBeenCalledWith({
      leaving: ["ada"],
      asOf: "2026-11-20T23:59:59Z",
      reviewWeight: 0.5,
      limit: 200,
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("refuses a negative review weight", async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText("Who is leaving?"), "ada{Enter}");
    await user.type(screen.getByLabelText("Review weight"), "-1");

    await user.click(screen.getByRole("button", { name: "Rank files" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("review weight");
  });

  it("adds nothing for blank input and for keys other than Enter", async () => {
    const { user } = setup();
    const field = screen.getByLabelText("Who is leaving?");

    await user.type(field, "   {Enter}");
    await user.type(field, "ada");

    expect(screen.queryByRole("list", { name: "People who are leaving" })).not.toBeInTheDocument();
    expect(field).toHaveValue("   ada");
  });

  it("does not submit the departure when Enter only adds a person", async () => {
    const { user, onSubmit } = setup();

    await user.type(screen.getByLabelText("Who is leaving?"), "ada{Enter}ben{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("ben")).toBeInTheDocument();
  });

  it("does not complain before the first attempt and stops once the problem is fixed", async () => {
    const { user, onSubmit } = setup();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rank files" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Who is leaving?"), "ada{Enter}");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rank files" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows the button as busy while a ranking is being computed", () => {
    setup(true);

    expect(screen.getByRole("button", { name: "Rank files" })).toBeDisabled();
  });
});
