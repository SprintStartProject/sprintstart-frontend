import { motion } from "framer-motion";
import { CheckCircle2, ExternalLink, Lightbulb } from "lucide-react";
import { centralSpringToken } from "../../../../../styles/tokens";
import type {
  OnboardingResourceEndpoint,
  OnboardingTaskEndpoint,
} from "../../../../../services/onboardingTypes";
import { TaskCheckItem } from "../../TaskCheckItem";
import type { TaskProgress } from "./workspaceRules";

/** The checklist with its progress bar, or the line that says there is none. */
export function TasksPanel({
  tasks,
  progress,
  onToggle,
}: {
  tasks: OnboardingTaskEndpoint[];
  progress: TaskProgress;
  onToggle: (task: OnboardingTaskEndpoint) => void;
}) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-app-border px-4 py-3 text-sm text-app-text-muted">
        No checklist for this one — do what the description says, then mark it complete.
      </p>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-app-text">Tasks</h4>
        <span className="text-xs text-app-text-muted tabular-nums">
          {progress.done}/{tasks.length} done
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-app-border-muted">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-app-brand to-app-progress-fill-end"
          initial={false}
          animate={{ width: `${progress.percent}%` }}
          transition={centralSpringToken}
        />
      </div>
      <div className="space-y-2">
        {tasks.map((task, index) => (
          <TaskCheckItem
            key={task.id}
            index={index}
            title={task.title}
            description={task.description}
            isDone={task.finished}
            onToggle={() => onToggle(task)}
          />
        ))}
      </div>
    </>
  );
}

/** What the step should lead to, and what helps, in the column beside the tasks. */
export function SidePanel({
  outcomes,
  resources,
}: {
  outcomes: string[];
  resources: OnboardingResourceEndpoint[];
}) {
  return (
    <div className="space-y-3">
      {outcomes.length > 0 ? <Outcomes outcomes={outcomes} /> : null}
      {resources.length > 0 ? <ResourceLinks resources={resources} /> : null}
    </div>
  );
}

function Outcomes({ outcomes }: { outcomes: string[] }) {
  return (
    <div className="rounded-2xl bg-app-surface-muted p-3">
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-app-text">
        <Lightbulb className="h-3.5 w-3.5 text-app-brand" aria-hidden="true" />
        You’re done when
      </h4>
      <ul className="space-y-1.5">
        {outcomes.map((outcome) => (
          <li key={outcome} className="flex items-start gap-2 text-xs text-app-text">
            <CheckCircle2
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-app-success-solid"
              aria-hidden="true"
            />
            {outcome}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResourceLinks({ resources }: { resources: OnboardingResourceEndpoint[] }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold text-app-text">Resources</h4>
      <div className="space-y-1.5">
        {resources.map((resource) => (
          <a
            key={resource.id}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-2 rounded-xl border border-app-border px-3 py-2 transition-colors hover:border-app-brand-border"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-app-text">
                {resource.title}
              </span>
              {resource.description ? (
                <span className="block truncate text-xs text-app-text-subtle">
                  {resource.description}
                </span>
              ) : null}
            </span>
            <ExternalLink
              className="h-3.5 w-3.5 shrink-0 text-app-text-subtle group-hover:text-app-brand"
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
