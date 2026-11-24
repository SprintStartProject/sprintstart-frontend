# End-to-end journeys

Every user-facing journey of SprintStart, across all three repositories, and the end-to-end
test that covers it. A PR in any repository that adds or changes a journey
updates its row here and links it from the PR.

**Status:** J01, J02, J05, J06, J07, J08, J09, J10, J11, J12 (FAQ, knowledge gaps), J13 and J14 run automatically on every PR (`.github/workflows/e2e.yml`). The others
are still checked by hand, mainly along the final demo script; until a journey has a spec, every PR
that touches it describes the manual check it actually performed.

**How it runs:** Playwright (`e2e/journeys/`, one file per journey id) against a real stack — Keycloak,
backend and PostgreSQL from the images published on `dev`, defined by sprintstart-backend's
`docker-compose.yaml` plus `e2e/compose.e2e.yaml` — and the production build of this repository. The
AI service is replaced by `e2e/ai-stub`, which answers with contract-shaped events
(`contracts/`), so runs are deterministic and need no model. `e2e/seed.ts` creates the accounts
(`e2e.hire`, `e2e.hire2`, `e2e.pm`, `e2e.admin`), an `E2E Project` with both hires as members and the PM as
manager, and uploads a deploy guide the buddy can cite.

```bash
BACKEND_DIR=../sprintstart-backend npm run e2e:stack   # start the stack (Docker)
npm run e2e                                            # run the journeys
npm run e2e:stack:down                                 # delete the stack
```

The stack keeps its data between runs, so a journey must not depend on an empty database: use a
unique text per run where it matters (see J05).

| Id  | Journey                                                                   | Role      | Routes                                         | Repos involved        | Automated spec                 | Notes                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------- | --------- | ---------------------------------------------- | --------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J01 | Sign in through Keycloak and land on the role's home page                 | all       | `/`                                            | frontend, backend     | `j01-sign-in.spec.ts`          | Hire, PM, signed-out visitor.                                                                                                                                                 |
| J02 | Add a source document; the ingestion run completes and becomes searchable | PM        | `/data-ingestion`                              | frontend, backend, ai | `j02-add-document.spec.ts`     | Upload via Data Ingestion; the knowledge base shows it as Indexed once the AI stub reports it (`/ingest/status`).                                                             |
| J03 | Open the generated onboarding path and a step that links into the repo    | hire      | `/onboarding`                                  | frontend, backend, ai | none                           | Needs a working GitHub connection.                                                                                                                                            |
| J04 | See the board with the starter task marked as the first task              | hire      | `/board`, `/starter-work`                      | frontend, backend, ai | none                           |                                                                                                                                                                               |
| J05 | Ask the buddy a question and open the cited source                        | hire      | `/buddy`, `/chat`                              | frontend, backend, ai | `j05-buddy-answer.spec.ts`     | Greeting, answer, kept after reload; the cited deploy guide opens with its own text.                                                                                          |
| J06 | Confirm an action the buddy proposes (claim a task, tick a step)          | hire      | `/buddy`                                       | frontend, backend, ai | `j06-j08-escalation.spec.ts`   | The flag-to-PM proposal; nothing reaches the PM before the hire confirms.                                                                                                     |
| J07 | Escalate an unanswered question to the PM; the PM answers it              | hire, PM  | `/buddy`, `/insights/knowledge-requests`       | frontend, backend, ai | `j06-j08-escalation.spec.ts`   | PM dashboard → Escalations (the `/insights/knowledge-requests` route opens the dashboard). Answer published as a durable answer.                                              |
| J08 | A second hire receives the PM's answer to the same question               | hire      | `/buddy`                                       | frontend, backend, ai | `j06-j08-escalation.spec.ts`   | The stub calls `search_canonical_answers`; the answer the second hire reads is the one the backend served.                                                                    |
| J09 | Talk to the buddy in team mode about a managed project                    | PM        | `/buddy`, `/pm-dashboard`                      | frontend, backend, ai | `j09-team-mode.spec.ts`        | Includes the 403 for a user who does not manage the project.                                                                                                                  |
| J10 | Set up a new hire from a blueprint                                        | PM, HR    | `/hire-setup`, `/blueprints`, `/arrival-steps` | frontend, backend     | `j10-arrival-steps.spec.ts`    | PM side: add, reload, remove an arrival step. The hire's arrival card needs a generated board, which the stub cannot produce.                                                 |
| J11 | Create a project with the admin wizard                                    | admin, HR | `/admin`                                       | frontend, backend     | `j11-create-project.spec.ts`   | Without sources or members; found again after a reload.                                                                                                                       |
| J12 | Read FAQ, knowledge gaps and onboarding insights                          | PM, HR    | `/insights/*`                                  | frontend, backend, ai | `j12-insights.spec.ts`         | A hire's question is filed by `/insights/faq/classify` and shown under Questions; a rescan shows the gap `/knowledge-gaps/detect` returned. Onboarding insights still manual. |
| J13 | Manage team members and roles                                             | PM, HR    | `/team-management`                             | frontend, backend     | `j13-team-roles.spec.ts`       | PM creates a role and assigns the second hire; both read back after a reload.                                                                                                 |
| J14 | Edit profile and settings                                                 | all       | `/profile`, `/settings`                        | frontend, backend     | `j14-profile-settings.spec.ts` | Name saved to the backend and read back after reload; theme kept by the browser.                                                                                              |

When you automate a journey, replace "none" with the spec file name.
