import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { RequestCard } from "../../../../../src/features/knowledge-request/components/RequestCard";
import type {
  EscalationHire,
  KnowledgeRequest,
} from "../../../../../src/features/knowledge-request/types";

const hire = (overrides: Partial<EscalationHire> = {}): EscalationHire => ({
  userId: "u2",
  displayName: "Sam Hire",
  profileIcon: null,
  currentPhase: "Getting started",
  currentStep: "Set up your machine",
  progressPercentage: 0.25,
  ...overrides,
});

const request = (overrides: Partial<KnowledgeRequest> = {}): KnowledgeRequest => ({
  id: "r1",
  projectId: "p1",
  hireId: "u2",
  question: "Which branch do I open a pull request against?",
  status: "OPEN",
  createdAt: new Date().toISOString(),
  answeredAt: null,
  answer: null,
  hire: hire(),
  ...overrides,
});

function renderCard(
  overrides: Partial<KnowledgeRequest> = {},
  { onAnswer = vi.fn(), onDismiss = vi.fn() } = {},
) {
  return render(
    <MemoryRouter>
      <ul>
        <RequestCard request={request(overrides)} onAnswer={onAnswer} onDismiss={onDismiss} />
      </ul>
    </MemoryRouter>,
  );
}

/**
 * The tutor's point: the open message had neither an author nor anything about the person, so a PM
 * had to go and work out who was asking and where they had got to before they could answer.
 */
describe("RequestCard identity", () => {
  it("says who asked", () => {
    renderCard();

    expect(screen.getByText("Sam Hire")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Avatar for Sam Hire" })).toBeInTheDocument();
  });

  it("says where they have got to in their onboarding", () => {
    renderCard();

    expect(
      screen.getByText("Set up your machine · Getting started — 25% through"),
    ).toBeInTheDocument();
  });

  it("leads to the member page, as a link somebody can open in a second tab", () => {
    renderCard();

    expect(screen.getByRole("link", { name: "Sam Hire" })).toHaveAttribute("href", "/team/u2");
  });

  it("says outright that onboarding has not started, rather than leaving a blank line", () => {
    renderCard({
      hire: hire({ currentStep: null, currentPhase: null, progressPercentage: 0 }),
    });

    expect(screen.getByText("Onboarding not started")).toBeInTheDocument();
  });

  it("names the step even when its phase is missing", () => {
    renderCard({ hire: hire({ currentPhase: null, progressPercentage: 0.5 }) });

    expect(screen.getByText("Set up your machine — 50% through")).toBeInTheDocument();
  });

  it("shows no asker at all when the person could not be resolved, and keeps the question", () => {
    renderCard({ hire: null });

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Which branch do I open a pull request against?")).toBeInTheDocument();
  });
});

describe("RequestCard triage and actions", () => {
  it("keeps the wait time, which is what the queue is ordered by", () => {
    renderCard();

    expect(screen.getByTitle("How long this has waited on a person")).toHaveTextContent("just now");
  });

  it("flags a question that has waited a day", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    renderCard({ createdAt: twoDaysAgo });

    const waited = screen.getByTitle("How long this has waited on a person");
    expect(waited).toHaveTextContent("2d");
    expect(waited.className).toContain("text-app-warning-text");
  });

  it("still opens the compose form to answer", async () => {
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: "Answer" }));

    expect(screen.getByRole("button", { name: "Answer & publish" })).toBeInTheDocument();
  });

  it("still dismisses a one-off", async () => {
    const onDismiss = vi.fn().mockResolvedValue(undefined);
    renderCard({}, { onDismiss });

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onDismiss).toHaveBeenCalledWith("r1");
  });
});
