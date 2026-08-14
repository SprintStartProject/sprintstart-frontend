import { AlertCircle, BookOpen, Loader2, PencilLine, RefreshCw, UserRound } from "lucide-react";
import { OrientationSectionCard } from "./OrientationSectionCard";
import { ReportOrientationProblem } from "./ReportOrientationProblem";
import { SourceLinks } from "./SourceLinks";
import { useOpenSteps } from "../hooks/useOpenSteps";
import { AiActivityLog } from "../../ai-activity/AiActivityLog";
import type { AiActivityEntry } from "../../ai-activity/useAiStream";
import type { MyOrientation, OrientationPacket } from "../types";

type OrientationPanelProps = {
  orientation: MyOrientation | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  /**
   * When set, shows a "fix this" affordance that opens the editor. Omitted in read-only contexts
   * (like the editor's own live preview) so the panel doesn't offer to edit itself.
   */
  onEdit?: () => void;
  /**
   * When true, offers "something here is wrong" beside the edit affordance.
   *
   * Hire surfaces only. Correcting is the right move for somebody who knows the answer,
   * and it was the *only* move — which left out the newcomer who can tell a step is stale but not
   * what replaced it. A PM gets no report control: they own the content, so reporting it to
   * themselves is a loop with one person in it.
   */
  canReport?: boolean;
  /** The live assembly log; when streaming, it replaces the spinner. */
  activity?: AiActivityEntry[];
  isStreaming?: boolean;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-xl border border-app-border bg-app-surface-muted p-4">
      <div className="mb-3 flex items-center gap-2">
        <BookOpen className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-app-text">
          What the team already wrote about this
        </h3>
      </div>
      {children}
    </section>
  );
}

function EditButton({ onEdit, label }: { onEdit: () => void; label: string }) {
  return (
    <button
      type="button"
      data-testid="edit-orientation"
      onClick={onEdit}
      className="inline-flex items-center gap-1 text-xs font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
    >
      <PencilLine className="h-3 w-3" aria-hidden="true" />
      {label}
    </button>
  );
}

function Packet({ packet, onEdit }: { packet: OrientationPacket; onEdit?: () => void }) {
  const { isOpen, toggle } = useOpenSteps(packet.taskId, packet.sections[0]?.step);
  const isHuman = packet.origin === "HUMAN";

  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {isHuman && (
            <span className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-app-text-subtle">
              <UserRound className="h-3 w-3" aria-hidden="true" />
              Written by a person, not assembled
            </span>
          )}
          {packet.summary && <p className="text-xs text-app-text-muted">{packet.summary}</p>}
        </div>
        {onEdit && <EditButton onEdit={onEdit} label={isHuman ? "Edit" : "Fix this"} />}
      </div>
      <ul className="space-y-2">
        {packet.sections.map((section) => (
          <OrientationSectionCard
            key={`${section.step}-${section.title}`}
            section={section}
            isOpen={isOpen(section.step)}
            onToggle={() => toggle(section.step)}
          />
        ))}
      </ul>
      <SourceLinks label={isHuman ? "Sources" : "Assembled from"} items={packet.sources} />
      <p className="mt-2 text-[11px] text-app-text-subtle">
        {isHuman
          ? "Written by the team for this task. Reading it is optional."
          : "Gathered from what the team has already written — nothing here was written for you, and it is not something you have to finish. Reading it is optional."}
      </p>
    </>
  );
}

/**
 * Orientation shown beside the task it belongs to.
 *
 * Three honest states, and no fourth: the packet, an explicit "we could not put
 * this together" that still links the task, and a load failure with a retry.
 * Nothing is ever invented to fill the gap — a hire following fabricated
 * setup instructions on a task they will be reviewed on loses more time than
 * having no instructions at all.
 *
 * When `onEdit` is passed, a "fix this" affordance turns the same panel into the
 * entry point for correcting the orientation in place — including when the corpus
 * grounded nothing, where the honest move is to write it yourself.
 *
 * `canReport` adds the other half for hire surfaces: correct it if you know the
 * answer, report it if you only know it is wrong. Correcting was the only route
 * for a long time, which quietly asked the newest person on the team to rewrite
 * shared material on a hunch.
 */
export function OrientationPanel({
  orientation,
  isLoading,
  error,
  onRetry,
  onEdit,
  canReport,
  activity,
  isStreaming,
}: OrientationPanelProps) {
  if (isLoading) {
    return (
      <Shell>
        {isStreaming && activity !== undefined ? (
          <AiActivityLog phase="streaming" entries={activity} title="Assembling your orientation" />
        ) : (
          <div className="flex items-center gap-2 text-xs text-app-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Gathering what already exists…
          </div>
        )}
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="flex items-start gap-2 text-xs text-app-danger-text">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p>{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-1.5 inline-flex items-center gap-1 font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Try again
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // No current task means there is nothing to orient for; the caller's own
  // empty state covers it.
  if (!orientation?.taskId) return null;

  if (!orientation.packet) {
    return (
      <Shell>
        <p className="text-xs text-app-text-muted">
          Nothing in this project&apos;s docs matched this task closely enough to be worth handing
          you, so there is no guide here. {orientation.reason ? `(${orientation.reason}.)` : ""}{" "}
          That is a gap in the documentation, not something you did — open the task itself and ask
          your buddy: it knows this project, and it&apos;ll flag your PM if it can&apos;t help.
        </p>
        {orientation.taskUrl && (
          <SourceLinks
            label="Start from"
            items={[
              {
                filename: orientation.taskTitle ?? "The task",
                sourceUrl: orientation.taskUrl,
                artifactType: "ISSUE",
              },
            ]}
          />
        )}
        {onEdit && (
          <div className="mt-3">
            <EditButton onEdit={onEdit} label="Write it yourself" />
          </div>
        )}
      </Shell>
    );
  }

  return (
    <Shell>
      <Packet packet={orientation.packet} onEdit={onEdit} />
      {/* Only where there is a packet: "this is wrong" needs a *this*. The no-packet state
                above already says the gap is in the documentation and points at the buddy, which is
                a better route than reporting an absence somebody already knows about. */}
      {canReport && <ReportOrientationProblem taskTitle={orientation.taskTitle ?? "this task"} />}
    </Shell>
  );
}
