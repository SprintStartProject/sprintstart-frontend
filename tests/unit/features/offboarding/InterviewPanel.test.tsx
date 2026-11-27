import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, it, expect } from "vitest";
import { InterviewPanel } from "../../../../src/features/offboarding";
import type { InterviewPlan, InterviewQuestion } from "../../../../src/services/offboardingTypes";
import { server } from "../../setup/vitest.setup";

const ENDPOINT = "/api/v1/projects/p1/offboarding/interview-questions";

function question(overrides: Partial<InterviewQuestion> = {}): InterviewQuestion {
  return {
    component: "github:acme/app/src/auth",
    text: "Why does the login retry three times?",
    type: "rationale",
    triggers: ["orphaned"],
    files: ["src/auth/Login.kt"],
    priority: 0.9,
    coverage: "open",
    recordAnswer: null,
    sources: [],
    ...overrides,
  };
}

function answerWith(plan: InterviewPlan, seen: URL[] = []) {
  server.use(
    http.post(ENDPOINT, ({ request }) => {
      seen.push(new URL(request.url));
      return HttpResponse.json(plan);
    }),
  );
  return seen;
}

describe("the interview plan of a departure", () => {
  it("asks for a departure before anything can be planned", () => {
    render(<InterviewPanel projectId="p1" query={null} />);

    expect(screen.getByText("Nobody named yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /plan the interview/i })).not.toBeInTheDocument();
  });

  it("plans on request and shows the questions by component", async () => {
    const seen = answerWith({
      questions: [
        question(),
        question({
          text: "How is the token rotated?",
          type: "operational",
          triggers: ["hotspot"],
          coverage: "partial",
          recordAnswer: "A cron job rotates it.",
          sources: ["ops.md"],
        }),
        question({ component: "confluence:ENG/(root)", text: "Is the setup page current?" }),
      ],
      answeredByRecords: [question({ text: "Where are the logs?", coverage: "answered" })],
      files: 3,
    });
    render(<InterviewPanel projectId="p1" query={{ leaving: ["ada", "ben"] }} />);

    await userEvent.click(screen.getByRole("button", { name: /plan the interview/i }));

    const auth = await screen.findByRole("region", { name: "github:acme/app/src/auth" });
    expect(within(auth).getByText("Why does the login retry three times?")).toBeInTheDocument();
    expect(within(auth).getByText("nobody left")).toBeInTheDocument();
    const partial = within(auth).getByText("How is the token rotated?").closest("li")!;
    const open = within(auth).getByText("Why does the login retry three times?").closest("li")!;
    expect(within(partial).getByText("partly in the records")).toBeInTheDocument();
    expect(within(open).queryByText("partly in the records")).toBeNull();
    expect(within(auth).getByText("A cron job rotates it.")).toBeInTheDocument();
    expect(within(auth).getByLabelText("How to run or fix it")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "confluence:ENG/(root)" })).toBeInTheDocument();
    expect(screen.getByText("Already in the records (1)")).toBeInTheDocument();
    expect(seen[0].searchParams.getAll("leaving")).toEqual(["ada", "ben"]);
  });

  it("says so when the records answer everything", async () => {
    answerWith({ questions: [], answeredByRecords: [], files: 0 });
    render(<InterviewPanel projectId="p1" query={{ leaving: ["ada"] }} />);

    await userEvent.click(screen.getByRole("button", { name: /plan the interview/i }));

    expect(await screen.findByText("Nothing to ask")).toBeInTheDocument();
  });

  it("reports a plan that could not be made", async () => {
    server.use(http.post(ENDPOINT, () => new HttpResponse(null, { status: 502 })));
    render(<InterviewPanel projectId="p1" query={{ leaving: ["ada"] }} />);

    await userEvent.click(screen.getByRole("button", { name: /plan the interview/i }));

    expect(await screen.findByText("The interview could not be planned")).toBeInTheDocument();
  });
});
