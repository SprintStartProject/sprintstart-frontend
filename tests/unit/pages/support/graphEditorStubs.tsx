import { useState } from "react";
import type { ComponentProps } from "react";
import type { BlueprintGraphEditor } from "../../../../src/features/blueprints/components/BlueprintGraphEditor.tsx";
import type { BlueprintSubGraphEditor } from "../../../../src/features/blueprints/components/BlueprintSubGraphEditor.tsx";

type Action = { name: string; run: () => unknown };

/** Buttons that fire one editor callback each, and a line saying how each one ended. */
function ActionPanel({ actions }: { actions: Action[] }) {
  const [results, setResults] = useState<Record<string, string>>({});
  const record = (name: string, value: string) =>
    setResults((current) => ({ ...current, [name]: value }));
  return (
    <div>
      {actions.map((action) => (
        <button
          key={action.name}
          type="button"
          onClick={() => {
            Promise.resolve()
              .then(() => action.run())
              .then(
                () => record(action.name, "ok"),
                (reason: unknown) =>
                  record(action.name, reason instanceof Error ? reason.message : "failed"),
              );
          }}
        >
          {action.name}
        </button>
      ))}
      <output data-testid="results">{JSON.stringify(results)}</output>
    </div>
  );
}

/** Stands in for the top-level graph editor: shows what it was given and exposes its callbacks. */
export function GraphEditorStub(props: ComponentProps<typeof BlueprintGraphEditor>) {
  const [first, second] = props.phases;
  return (
    <section data-testid="graph-editor">
      <output data-testid="graph-props">
        {JSON.stringify({
          editable: props.editable,
          pathTitle: props.pathTitle,
          openPhaseTitle: props.openPhaseTitle ?? null,
          phases: props.phases.map((phase) => ({
            id: phase.id,
            revision: phase.revision,
            x: phase.graphX,
            y: phase.graphY,
            blockerIds: phase.blockerIds,
            title: phase.title,
          })),
        })}
      </output>
      <ActionPanel
        actions={[
          { name: "move phase", run: () => props.onPositionChange(first, 11, 22) },
          { name: "add blocker", run: () => props.onAddBlocker(second, first.id) },
          { name: "remove blocker", run: () => props.onRemoveBlocker(second, first.id) },
          { name: "create phase", run: () => props.onCreateNode(5, 6) },
          { name: "delete phase", run: () => props.onDeletePhase(first) },
          { name: "open sub-graph", run: () => props.onOpenSubGraph(first) },
          { name: "open AI sub-graph", run: () => props.onOpenSubGraph(second) },
          {
            name: "update phase",
            run: () =>
              props.onUpdatePhase(first, {
                title: "Renamed",
                description: "New text",
                type: "FIXED",
                aiPrompt: null,
              }),
          },
          { name: "request draft", run: () => props.onRequestDraft?.(first) },
          { name: "opened phase", run: () => props.onOpenedPhase?.() },
        ]}
      />
    </section>
  );
}

/** Stands in for the fixed-phase graph editor, the same way. */
export function SubGraphEditorStub(props: ComponentProps<typeof BlueprintSubGraphEditor>) {
  const [step] = props.phase.blueprintSteps;
  const [question] = props.phase.blueprintCheckQuestions;
  const [node, otherNode] = props.nodes;
  return (
    <section data-testid="sub-graph-editor">
      <output data-testid="sub-graph-props">
        {JSON.stringify({
          editable: props.editable,
          phase: props.phase.title,
          openNodeTitle: props.openNodeTitle ?? null,
          nodes: props.nodes.map((item) => ({
            id: item.id,
            revision: item.revision,
            x: item.graphX,
            y: item.graphY,
            blockerIds: item.blockerIds,
            title: item.title,
          })),
          steps: props.phase.blueprintSteps.map((item) => item.title),
          questions: props.phase.blueprintCheckQuestions.map((item) => item.title),
        })}
      </output>
      <ActionPanel
        actions={[
          { name: "back", run: () => props.onBack() },
          { name: "move node", run: () => props.onPositionChange(node, 31, 41) },
          { name: "add node blocker", run: () => props.onAddBlocker(otherNode, node.id) },
          { name: "remove node blocker", run: () => props.onRemoveBlocker(otherNode, node.id) },
          { name: "create step", run: () => props.onCreateNode("step", 7, 8) },
          { name: "create question", run: () => props.onCreateNode("question", 9, 10) },
          {
            name: "update question",
            run: () =>
              props.onUpdateQuestion(question, {
                title: "Retitled",
                type: "SHORT_TEXT",
                question: "New wording",
                explanation: null,
                correctAnswer: "main",
              }),
          },
          { name: "add option", run: () => props.onAddOption(question, "Maybe", true) },
          {
            name: "remove option",
            run: () => props.onRemoveOption(question.blueprintCheckOptions[0]),
          },
          {
            name: "update step",
            run: () =>
              props.onUpdateStep(step, {
                title: "Retitled step",
                description: "New",
                type: "VIDEO",
                aiAssisted: true,
                estimatedMinutes: 5,
                expectedOutcome: "Done",
              }),
          },
          { name: "add task", run: () => props.onAddTask(step) },
          { name: "remove task", run: () => props.onRemoveTask(step.blueprintTasks[0]) },
          { name: "add resource", run: () => props.onAddResource(step) },
          {
            name: "remove resource",
            run: () => props.onRemoveResource(step.blueprintResources[0]),
          },
          { name: "edit task", run: () => props.onEditTask(step.blueprintTasks[0]) },
          { name: "edit resource", run: () => props.onEditResource(step.blueprintResources[0]) },
          { name: "edit option", run: () => props.onEditOption(question.blueprintCheckOptions[0]) },
          { name: "delete step", run: () => props.onDeleteStep(step) },
          { name: "delete question", run: () => props.onDeleteQuestion(question) },
          { name: "request draft", run: () => props.onRequestDraft?.(node) },
          { name: "opened node", run: () => props.onOpenedNode?.() },
        ]}
      />
    </section>
  );
}
