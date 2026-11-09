// Stand-in for sprintstart-ai in the end-to-end stack: answers the backend's calls with
// fixed, contract-shaped responses, so a journey never depends on a model. The stream events follow
// sprintstart-ai's `contracts/agent-stream-events.schema.json`. Anything not listed here answers 503
// and is logged — the journey then shows how the product copes with the AI being unavailable.
//
// Agent turns follow the hire's last message:
// - it mentions the PM: the turn asks the backend to propose `flag_to_pm` (a pending tool call);
// - it asks about the code freeze: the turn asks the backend to run `search_canonical_answers`, then
//   answers with the answers the backend found — what a PM published reaches the next hire this way;
// - it asks for the source: the turn answers `cited`, citing the ingested deploy guide;
// - anything else: the turn answers with `answer`.
//
// `/insights/faq/classify` files every question as a documentation question: into the entry asking
// exactly the same, or a new entry titled with the question.
//
// `/insights/knowledge-gaps/detect` reports one fixed gap, `deploy-pipeline` with no runbook.
//
// `/ingest/sync` records what the backend ingests, as the real service would index it;
// `/ingest/status` reports those as indexed and anything else as unknown; `GET /__e2e/ingested`
// lists them so the seed can wait until an upload has arrived.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8000);

// Shared with the journeys, which check that exactly these words reach the page.
const TEXT = JSON.parse(readFileSync(new URL("./answers.json", import.meta.url), "utf8"));

const sse = (events) => events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");

const message = (role, content, toolCalls = []) => ({
  role,
  content,
  tool_calls: toolCalls,
  tool_call_id: null,
});

/** Artifacts the backend has ingested, newest last: `{ artifactId, title }`. */
const ingested = [];

function ingest(body) {
  const removed = new Set(body.artifactsToDeindex ?? []);
  for (let i = ingested.length - 1; i >= 0; i--) {
    if (removed.has(ingested[i].artifactId)) ingested.splice(i, 1);
  }
  const added = (body.artifactsToIngest ?? []).map((a) => ({
    artifactId: a.artifactId,
    title: a.title ?? a.sourceId,
  }));
  ingested.push(...added);
  return {
    artifacts: added.map((a) => ({
      artifact_id: a.artifactId,
      chunk_count: 1,
      status: "completed",
    })),
    deindexed: [...removed].map((id) => ({ artifact_id: id, status: "completed" })),
  };
}

function ingestStatus(query) {
  const known = new Set(ingested.map((a) => a.artifactId));
  const ids = [...new Set(query.getAll("artifact_ids"))];
  return {
    items: ids.map((id) => ({
      artifact_id: id,
      status: known.has(id) ? "indexed" : "unknown",
      updated_at: null,
      chunk_count: known.has(id) ? 1 : null,
    })),
  };
}

const DEPLOY_PIPELINE_GAP = {
  component: "deploy-pipeline",
  missingTypes: ["runbook"],
  presentTypes: ["readme"],
  lastUpdated: "2026-10-01T09:00:00Z",
  severity: "high",
};

function classify(body) {
  const question = (body.question ?? "").trim();
  const same = (body.groups ?? []).find((group) => group.question === question);
  return { relevant: true, question, title: question, groupId: same?.id ?? null, documents: [] };
}

const result = (final, text, messages, pendingToolCalls = [], citations = []) => ({
  type: "result",
  final,
  text,
  messages,
  pending_tool_calls: pendingToolCalls,
  citations,
  reasoning: [],
});

const answerEvents = (messages, text, citations = []) => [
  { type: "token", content: text },
  result(true, text, [...messages, message("assistant", text)], [], citations),
];

const callTool = (messages, name, args) => {
  const call = { id: `call_${name}_1`, name, arguments: args };
  return sse([result(false, "", [...messages, message("assistant", "", [call])], [call])]);
};

/** The name of the tool call the backend's tool message answers. */
function answeredTool(messages) {
  const call = messages.findLast((m) => m.role === "assistant" && m.tool_calls?.length);
  return call?.tool_calls.at(-1)?.name;
}

/** The answers in a `search_canonical_answers` result ("Q: …\nA: …" per match). */
const publishedAnswers = (content) =>
  [...(content ?? "").matchAll(/^A: (.*)$/gm)].map((match) => match[1]);

function afterTool(messages) {
  const last = messages.at(-1);
  if (answeredTool(messages) !== "search_canonical_answers") {
    return sse(answerEvents(messages, TEXT.flagged));
  }
  const found = publishedAnswers(last.content);
  const text = found.length ? `${TEXT.reused} ${found.join(" ")}` : TEXT.unanswered;
  return sse(answerEvents(messages, text));
}

function cite(messages) {
  // The deploy guide by name, not whatever came last: other journeys upload documents too.
  const source = ingested.findLast((artifact) => /deploy/i.test(artifact.title ?? ""));
  if (!source) return sse(answerEvents(messages, TEXT.unanswered));
  const citation = { artifact_id: source.artifactId, start_line: 1, start_page: null };
  return sse(answerEvents(messages, TEXT.cited, [citation]));
}

function agentTurn(body) {
  const messages = body.messages ?? [];
  const last = messages.at(-1) ?? {};
  const said = last.role === "user" ? (last.content ?? "") : "";
  if (last.role === "tool") return afterTool(messages);
  if (/\bPM\b/.test(said)) return callTool(messages, "flag_to_pm", { question: said });
  if (/code freeze/i.test(said)) {
    return callTool(messages, "search_canonical_answers", { query: said });
  }
  if (/\bsource\b/i.test(said)) return cite(messages);
  const search = { type: "tool_use", name: "search_docs", arguments: { query: "deploy" } };
  return sse([search, ...answerEvents(messages, TEXT.answer)]);
}

const opening = () =>
  sse([
    { type: "token", content: TEXT.greeting },
    {
      type: "done",
      greeting: TEXT.greeting,
      action: { label: "Find me a task", question: "What should I work on first?" },
    },
  ]);

const routes = {
  "/api/v1/onboarding/buddy/agent/stream": (body) => ({ stream: agentTurn(body) }),
  "/api/v1/onboarding/buddy/open/stream": () => ({ stream: opening() }),
  "/api/v1/generate-title": () => ({ json: { title: "Deploying a release" } }),
  "/api/v1/onboarding/buddy/compact": () => ({ json: { summary: "", summarized_count: 0 } }),
  "/api/v1/artifacts/projects/sync": () => ({ json: {} }),
  "/api/v1/ingest/sync": (body) => ({ json: ingest(body) }),
  "/api/v1/ingest/status": (_, query) => ({ json: ingestStatus(query) }),
  "/api/v1/insights/faq/classify": (body) => ({ json: classify(body) }),
  "/api/v1/insights/knowledge-gaps/detect": () => ({ json: { gaps: [DEPLOY_PIPELINE_GAP] } }),
  "/__e2e/ingested": () => ({ json: ingested }),
};

function routeFor(path) {
  if (/^\/api\/v1\/projects\/[^/]+\/memberships$/.test(path)) return () => ({ json: {} });
  return routes[path];
}

function parse(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://stub");
  const path = url.pathname;
  const route = routeFor(path);
  let raw = "";
  request.on("data", (chunk) => (raw += chunk));
  request.on("end", () => {
    if (!route) {
      console.log(`[ai-stub] 503 ${request.method} ${path}`);
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ detail: "not stubbed for end-to-end tests" }));
      return;
    }
    const { stream, json } = route(parse(raw), url.searchParams);
    console.log(`[ai-stub] 200 ${request.method} ${path}`);
    response.writeHead(200, { "Content-Type": stream ? "text/event-stream" : "application/json" });
    response.end(stream ?? JSON.stringify(json));
  });
}).listen(PORT, () => console.log(`[ai-stub] listening on ${PORT}`));
