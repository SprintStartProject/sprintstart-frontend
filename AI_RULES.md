# AI Coding Rules

These rules bind every AI agent that reads or writes code in this repository — Claude Code,
Codex, Copilot, Gemini, Cursor, anything else — and every human who merges AI-written code.
They take precedence over `AGENTS.md`, the `.agent-modes/` files and any prompt that
contradicts them. Rules are numbered so that hooks, CI and reviewers can cite them (`R7`).

<!-- ai-rules-core:begin v1 — identical in sprintstart-backend, -ai and -frontend; change all three together -->

## Why these rules exist

In October 2026 a review of this project found code that was hard to maintain: functions
of 100–240 lines doing five things at once, identifiers passed around as bare `UUID`/`String`,
a mode selected by whether a parameter is `null`, a service copied into a near-identical twin
that had already drifted from the original, and no documented end-to-end tests. Most of it
was written by AI agents, and all of it was CI-green — because the linter had been switched
off where it complained (`LongMethod: active: false`, 124 `@Suppress`), and CI ran detekt
without type resolution, which skips rules such as `LongParameterList` entirely. The agent
rules of the time said "keep functions small" but nothing checked it; they said "do not
refactor" and "reuse existing patterns", which an agent reads as "copy the class next door";
and they pointed to an ADR folder that did not exist, so the Buddy and team-mode architecture
was never written down as a decision although the Wiki holds twenty ADRs for tooling choices.

Testability and structure had the same gap. The backend's tests run 90% of its lines, yet they
notice only 32% of deliberately broken code in `BuddyTeamService`; coverage measured that code
ran, not that a test would fail. The modular architecture was decided in an ADR, but its
`package-info.java` declarations were never compiled, so Spring Modulith never checked a
boundary — 166 violations and 78 module cycles had grown unnoticed. And nothing merged was
required to pass CI at all: the backend's `dev` branch had no required status checks.

These rules close each of those paths. A rule that matters is checked by a machine; the
table in [Enforcement](#enforcement) says where.

## 1. When a rule is in your way

**R1 — Stop, do not work around.** If a rule blocks the change you were asked to make,
you restructure the code until it complies. If that is not possible within the task, stop
and report: which rule, where, why, and the refactoring you propose. You never weaken a
check, suppress a finding, or rephrase code so a tool no longer recognises it.

**R2 — Only a human grants an exception.** An exception is a PR label `quality-exception`,
set by a human other than the author, with a linked issue that removes it again. An agent
never adds the label, never asks for it as a shortcut, and never treats an earlier
exception as permission for a new one.

## 2. Hard limits

**R3 — New and changed code stays within these limits.** Existing violations are frozen in
the linter baseline (see the repo section). A baseline may only shrink: when you touch a
function that is in it, you bring it under the limit in the same PR (R1 applies if you can't).

| Limit                     | Value                                    |
| ------------------------- | ---------------------------------------- |
| Function length           | see repo section (≈ one screen)          |
| Parameters per function   | 4 (constructor injection: 8)             |
| Cyclomatic complexity     | 10                                       |
| Nesting depth             | 3                                        |
| File length               | 400 lines                                |
| Suppressions added        | 0                                        |
| Tests skipped or disabled | 0                                        |
| Changed lines per PR      | ≤ 400, tests and generated code excluded |

**R4 — No suppressions.** You never add `@Suppress`, `@SuppressWarnings`, `# noqa`,
`# type: ignore`, `# pyright: ignore`, `eslint-disable*`, `@ts-ignore`, `@ts-expect-error`,
`@ts-nocheck`, ktlint disables, or entries to a lint baseline. A suppression with a comment
justifying it is still a suppression.

**R5 — No loosening of checks.** You never edit lint, type-checker, formatter, coverage or
CI configuration so that it checks less: `detekt.yml`, `.editorconfig`, `ruff.toml`,
`pyrightconfig.json`, `eslint.config.js`, `tsconfig*.json`, `.github/workflows/*`,
baseline files (except removing entries), `scripts/quality/*`, `scripts/ai-guard/*`,
`.claude/settings.json`, this file. Changing them is a human's decision, asked for
explicitly.

**R6 — Tests are never weakened to get green.** You never skip, disable, delete or `.only`
a test, loosen an assertion, or widen a mock so that broken code passes. When a test fails,
either the code is wrong (fix the code) or the expectation is wrong (say so in the PR and
explain why the old expectation was wrong — a human decides).

## 3. Design

### Types, not primitives

**R7 — Identifiers have their own type.** An id that crosses a function boundary in a
service, controller, route or hook is a value type (`ProjectId`, `UserId`, `SessionId`), never
a bare `UUID`/`String`/`str`/`string`. Two ids of different kinds must not be swappable without
a compile error. Convert at the edge (request DTO, DB entity) and pass the typed value inward.
When you touch a signature that still takes a raw id, convert that signature.

**R8 — Closed sets are enums or sealed types.** Event types, statuses, roles, kinds and modes
are never `String`. If the set is shared across repos, it is defined once in the contract
(R12) and typed on every side.

**R9 — Make invalid states unrepresentable.** Mutually exclusive inputs are one sealed type /
discriminated union, not two nullable parameters. `null` means "absent", never "the other
mode". A type with many nullable fields of which each variant uses a few is several types —
split it into a sealed hierarchy.

> Seen here: `teamProjectId: UUID?` selected team mode in three controller methods, while
> `sessionId: UUID?` was required in the other mode and silently ignored in this one.
> `BuddyStreamEvent` had 27 nullable fields and a `type: String`; dropping one field while
> copying 30 of them by hand failed silently.

### One responsibility

**R10 — A function does one thing.** Each function is one of: decide, fetch, transform,
persist, emit, or orchestrate. An orchestrator only calls other functions in sequence and
contains no logic of its own. Signs of a violation:

- the name contains _And_ / _Or_ (`recordActivityAndReturnLongAbsence`);
- it both changes state and returns information (command–query separation);
- it returns a value _and_ writes into a parameter (out-parameters such as a passed-in
  `StringBuilder` or list);
- it needs section comments ("// 1. validate", "// now persist") to be readable.

**R11 — Entry points are thin.** A controller, route handler, page or event listener parses
input, calls one service function, and maps the result. It contains no branching on business
modes and no authorization logic beyond the framework's declarative mechanism. Two modes are
two endpoints or two resources.

**R12 — Cross-repo contracts are defined once.** Any shape that crosses a repository boundary
(REST DTOs, SSE events, AI requests) is specified in the contract document named in the repo
section, typed on both sides, and covered by a contract test on each side. Changing it is an
ADR trigger (R16).

### No twins

**R13 — Search before you write.** Before writing a class, or a function longer than ten
lines, search the codebase for existing code that does the same job — by concept, not only
by name (`grep -ri "greeting\|opening"` finds more than `grep TeamOpen`). State what you
found in your report, even when it is nothing.

**R14 — Extend by extraction, never by copy.** If the new thing is "like X, but for Y", first
extract the shared part of X into a reusable unit (its own commit, behaviour unchanged, tests
green), then implement Y as a variant of it — parameter, strategy, interface. A KDoc,
docstring or comment of the form "behaves like X except …" or "follows X with three
differences" describes a twin and is forbidden. This rule overrides any instruction to avoid
refactoring: the extraction is part of the task, not unrelated cleanup.

> Seen here: `BuddyTeamService` re-implemented `BuddyService`'s opening, `finishOpen`,
> `saveIncompleteReply` and compaction trigger. Within weeks the copies differed in error
> logging, null handling and when a greeting is regenerated — and a copy-paste detector did
> not notice, because the agent had rephrased every line.

### Errors

**R15 — Never swallow.** Catch the narrowest exception type, and either handle it (with a
behaviour a test covers), or rethrow it as a domain error. Logging alone is not handling. If
you log, pass the exception itself so the stack trace survives.

### Architecture decisions

**R16 — Decide in an ADR before you build.** ADRs live in the `Wiki` repository under
`docs/source/explanations/adrs/` (`adr-NNN-title.md`, registered in `index.md`, same template
as the existing ones). Draft one there — or, if the Wiki is not checked out, in the PR
description for a human to move — and stop for a human to accept it **before** writing code
when the change:

- adds a module, package, service class or controller;
- adds a second variant or mode of something that exists (team mode, a v2, an "advanced" path);
- adds or changes a cross-repo contract (R12);
- adds a dependency, a database table/entity, a background job, a queue or an LLM call path;
- changes authentication, authorization or data visibility.

An ADR lists at least two real options with their trade-offs. "Do nothing" counts only if it
is genuinely viable. An agent may draft the ADR; only a human sets it to `Accepted`.

## 4. Comments

**R17 — Good code explains itself. Doc comments are the norm; any other comment is the
exception.**

- Write doc comments (KDoc, docstrings, TSDoc) on public API: a one-sentence summary plus
  the contract (parameters, errors, side effects), usually ≤ 6 lines.
- Write any other comment only for what the code cannot say: hard math or a non-obvious
  algorithm, an external constraint (a library bug, a spec, a protocol quirk), an invariant
  no type can carry. If a better name, a type or a smaller function would make the comment
  unnecessary, change the code instead.
- Never cite or justify these rules in code: no "AI_RULES R7", no "its own type, so that a
  user id cannot be passed as a session id". The rules live in this file; following them
  needs no explanation.
- Forbidden: history ("used to", "no longer", "previously", "after the fix", "the whole
  change"), section comments, restating the code, essays. History belongs in the commit
  message, the PR and the ADR.
- If a function needs a paragraph to explain what it does, it does too much (R10).

## 5. Tests

**R18 — Every behaviour change ships with a test that fails without it.** Test at the lowest
level that can catch the bug; name the test after the behaviour (`opening is replayed when it
is the latest message`), and assert outcomes, not call sequences — unless the sequence is the
contract.

**R19 — User journeys are documented and tested end to end.** Every user-facing journey is
listed in `sprintstart-frontend/docs/testing/e2e-journeys.md` with the spec that covers it —
whichever repository the change is in. A PR that adds or changes a journey updates that list
and its spec in the same week, linked from the PR. Until a journey has an automated spec, its
entry says so and the PR describes the manual end-to-end check that was actually performed.

## 6. Testability, architecture and merging

**R25 — Code is testable, and tests prove something.**

- Changed lines are covered to at least 80%, and total coverage never drops.
- The source files a change touches reach a mutation score of at least 60%: when the code is
  deliberately broken, a test must fail. A surviving mutant is a missing assertion — add it.
- Logic takes its dependencies; it does not reach for them. No `now()`, random values, new ids,
  environment, network or model calls inside a decision — inject a `Clock`, an id generator or a
  client, and keep the decision a pure function that a unit test can call directly.
- Tests are deterministic (no sleeping, no real time, network or model), test one behaviour,
  build their data with builders or fixtures rather than long setup, and never pass without an
  assertion. A test that needs more than a screen of setup points at a class with too many
  dependencies (R3, R10) — fix the class.
- Put each test at the lowest level that can catch the failure: unit for decisions, integration
  for persistence and HTTP edges, contract tests for shapes that cross a repository (R12), end to
  end for user journeys (R19).

**R26 — The architecture is checked, not described.** Modules talk to each other only through
their declared API (backend: the `external` package; ai: the layers in `.importlinter`; frontend:
a feature's public entry points) or through events, and module dependencies have no cycles. Each
repository runs architecture tests for this; their lists of known violations may only shrink,
like every other baseline (R3). Duplicated code and dead code are measured and may not grow:
delete unused code instead of keeping it for later, and extract instead of copying (R14).

**R27 — Nothing merges red.** `dev` and `main` accept changes only through PRs whose required
checks — lint, types, tests, coverage gate, mutation gate, contract checks, ratchet, end-to-end —
are green, approved by a second person after the last push, with a code owner's approval for
quality configuration (R5). A red `dev` is fixed before anything else is merged.

## 7. How an agent works on a task

**R20 — Follow this sequence and report each step.**

1. Read this file and `AGENTS.md`.
2. Restate the task in two sentences. If an R16 trigger applies, draft the ADR and stop.
3. Search for existing code (R13). Report what you found.
4. For anything beyond ~50 changed lines, list the functions and types you will add or change
   and the single responsibility of each — before writing them.
5. Implement in small steps. Extraction commits (R14) come before behaviour commits.
6. Run the repo's full check command (repo section). Never report done while it fails.
7. Self-review the diff against the checklist below and include it in your report.

**R21 — Report the truth.** Say what you ran and what it printed. If you skipped a check,
say so and why. If you are unsure whether something works, say that instead of "should work".

**R22 — Change size.** One concern per PR, ≤ 400 changed lines excluding tests and generated
code. If the task is bigger, stop and propose a split before continuing.

### Self-review checklist (paste into your final report and the PR)

- [ ] R3 limits: no new function, file or class over a limit; touched baseline entries removed
- [ ] R4/R5/R6: no suppression, no loosened config, no weakened or skipped test
- [ ] R7–R9: new ids are value types; no new `String` for a closed set; no nullable-as-mode
- [ ] R10/R11: every new function has one responsibility; entry points are thin
- [ ] R13/R14: searched for existing code (say where); nothing copied and adapted
- [ ] R15: no swallowed exception
- [ ] R16: ADR linked, or "no trigger applies" with the reason
- [ ] R17: doc comments only, other comments only where the code cannot speak; no history, no rule citations
- [ ] R18/R19: tests that fail without the change; journey list updated if user-facing
- [ ] R25: changed lines covered; mutation gate passed; no hidden `now()`/random/ids in logic
- [ ] R26: no new module-boundary, layering or cycle violation; no new duplication or dead code
- [ ] Full check command run, output summarised

## 8. Humans who use AI

**R23 — You own every line you merge.** "The agent wrote it" is not an answer in review.
Read the whole diff before opening the PR, tick the AI box in the PR template, and do not
approve a PR whose code your own agent wrote — a second person reviews it.

**R24 — Do not give agents a way around the guard.** Do not run agents with
`--dangerously-skip-permissions` or an equivalent, do not delete or disable the hooks in
`.claude/settings.json`, and do not approve an agent's request to edit a protected file (R5)
without deciding the change yourself.

## Enforcement

| Rule                           | Local (Claude Code hook)                          | CI (blocks merge)                              | Review        |
| ------------------------------ | ------------------------------------------------- | ---------------------------------------------- | ------------- |
| R3 limits, R15 generic catches | —                                                 | linter + baseline                              | ✓             |
| R3 file length                 | sent back at end of turn                          | `scripts/quality/ratchet.sh`                   | ✓             |
| R4 suppressions                | blocked after each edit, rechecked at end of turn | ratchet: count may not rise                    |               |
| R5 protected config            | needs your confirmation before each edit          | ratchet: diff needs `quality-exception`        |               |
| R6 skipped tests               | blocked after each edit, rechecked at end of turn | ratchet: count may not rise                    | ✓             |
| R7 raw ids (backend, ai)       | sent back at end of turn                          | ratchet: count may not rise                    | ✓             |
| R12 contract drift             | —                                                 | contract tests + `contracts-sync.sh`           |               |
| R25 coverage                   | —                                                 | `coverage-gate.sh` (changed lines, total)      |               |
| R25 mutation score             | —                                                 | `mutation.sh` on changed files; nightly report |               |
| R25 hidden `now()`/random/ids  | sent back at end of turn                          | ratchet: count may not rise                    | ✓             |
| R26 boundaries, layers, cycles | —                                                 | architecture tests + known lists               | ✓             |
| R26 duplication, dead code     | —                                                 | `metrics.sh`: may not rise                     | ✓             |
| R27 merging                    | —                                                 | branch ruleset (`.github/rulesets/`)           |               |
| R8–R14, R16, R18, R19, R22     | —                                                 | —                                              | ✓ PR template |
| R17 history comments           | sent back once at end of turn                     | —                                              | ✓             |
| R17 rule citations in comments | sent back at end of turn                          | ratchet: fails on any added citation           | ✓             |
| R24 `--no-verify`, force-push  | blocked                                           | —                                              |               |

The hooks need Claude Code; agents without hooks are bound by the same rules and are caught
by CI. Run `bash scripts/quality/ratchet.sh` locally to see what CI will say, and
`bash scripts/quality/report.sh` for the whole quality picture of the repository.

<!-- ai-rules-core:end -->

## Repo section: sprintstart-frontend (TypeScript / React)

**Full check command:**
`npm run format:check && npm run build && npm run lint && npm run arch && npm run coverage && npm run a11y && bash scripts/quality/coverage-gate.sh && bash scripts/quality/mutation.sh && bash scripts/quality/ratchet.sh && bash scripts/quality/metrics.sh`
— and, for anything a user can see, `npm run e2e:stack && npm run e2e`.

**Architecture (R26):** `.dependency-cruiser.cjs` (`npm run arch`) forbids cycles, imports into another
feature's internals (use its `index.ts`), feature or page code in `components/ui/` and `services/`, and
pages imported by features. Known violations are in `.dependency-cruiser-known-violations.json`; never
regenerate it to make a new violation pass. **Dead code:** knip (`npm run deadcode`), counted by
`metrics.sh`. **Mutation (R25):** Stryker on the files a branch changed (`stryker.config.json`).

**Limits.** The R3 limits are rules in `eslint.config.js` for `src/`: `max-lines-per-function`
at 60 lines (blank lines and comments not counted), `complexity` 10, `max-depth` 3,
`max-params` 4, `max-lines` 400, and `no-explicit-any` as an error. Existing violations are
frozen in `eslint-suppressions.json` (ESLint bulk suppressions). When you fix one, run
`npx eslint . --prune-suppressions` — lint fails until you do, so the file can only shrink.
Never run `--suppress-all` or `--suppress-rule`: that is adding a suppression (R4).

**Components (R10/R11).** A component renders; a hook holds state and effects; a service talks
to the backend. A page composes feature components and holds no logic of its own. A component
over 60 lines is split into sub-components or a hook — the existing primitives in
`components/ui/` come first (`docs/FRONTEND_CODING_STANDARDS.md` §4).

**Value types (R7) — TypeScript idiom:** branded types, created only where data enters the app
(service responses, route params).

```ts
type Brand<T, B extends string> = T & { readonly __brand: B };
export type ProjectId = Brand<string, "ProjectId">;
export const projectId = (raw: string): ProjectId => raw as ProjectId; // parse boundary only

function openTeamBuddy(project: ProjectId): Promise<void>; // a SessionId no longer fits
```

`as` is allowed only in such a constructor at the parse boundary — nowhere else.

**Closed sets and events (R8/R9).** A streamed or polymorphic payload is a discriminated union
with one member per variant and an exhaustive `switch`:

```ts
type BuddyStreamEvent =
  | { type: "token"; content: string }
  | { type: "opening_action"; label: string; question: string }
  | { type: "done" }
  | { type: "error"; message: string };

function assertNever(value: never): never {
  throw new Error(`Unhandled event: ${JSON.stringify(value)}`);
}
```

> Seen here: `BuddyStreamChunk` in `services/buddyService.ts` has a union `type` but ~30
> optional fields shared by all variants, so every `case` checks for `undefined` by hand — the
> mirror of the backend's `BuddyStreamEvent` and the AI service's dict events. And
> `streamOpenBuddy(handlers, sessionId?, teamProjectId?)` carries the backend's
> nullable-as-mode switch into the UI. Both are one contract (R12) to be fixed on all three
> sides together.

**Contracts (R12):** `contracts/` holds a copy of the backend's buddy stream contract; it is never
edited here, only copied from sprintstart-backend (`scripts/quality/contracts-sync.sh` fails while it
differs). `tests/unit/contracts/` streams every example through the real service functions. Other
REST shapes mirror the backend's OpenAPI description; a change names the backend file in the PR.

**End-to-end (R19).** The journey list lives here: [`docs/testing/e2e-journeys.md`](./docs/testing/e2e-journeys.md),
with how the stack runs. Journeys are in `e2e/journeys/`, one file per journey id; they sign in through
the real Keycloak and use `e2e/ai-stub` for the AI. Elements a journey targets carry a `data-testid`
(`docs/FRONTEND_CODING_STANDARDS.md` §5).

**Existing conventions still apply:** everything `AGENTS.md` links to — the coding standards
(design tokens, UI primitives, accessibility), the access policy for new routes, and the
Keycloak theme's separate copies.
