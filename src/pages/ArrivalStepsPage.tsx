import { useMemo, useState } from "react";
import { PlaneLanding } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { SegmentedTabs, type SegmentedTabOption } from "../components/ui/SegmentedTabs";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { ArrivalStepAuthoring } from "../features/arrival/components/ArrivalStepAuthoring";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useAuth } from "../context/useAuth";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import { PermissionGroup } from "../services/types";

/** The company-wide scope, as a tab value. Null is the scope; this is only how a tab spells it. */
const COMPANY = "__company__";

/**
 * Authoring the arrival list: what a new joiner needs before they can work.
 *
 * Company-wide is the default tab; a project tab is what that project needs on top, and a
 * hire's own list is the union of the two.
 *
 * A project step reusing a company step's key replaces its wording rather than adding a second
 * row — the key is what state is stored against, so sharpening a sentence costs nobody their
 * record of having done it.
 *
 * HR reads but does not write, matching the backend.
 *
 * The scopes are the app's shared `SegmentedTabs` rather than a tab bar of this page's own: same
 * sliding pill, same swipe between sections and same page shell as Starter Work, so moving between
 * the two surfaces does not feel like moving between two apps.
 */
export function ArrivalStepsPage() {
  const { profile } = useAuth();
  const { projects } = useProjectContext();
  const [scope, setScope] = useState<string>(COMPANY);

  const canAuthor =
    profile?.permissionGroup === PermissionGroup.PM ||
    profile?.permissionGroup === PermissionGroup.ADMIN;

  const selected = projects.find((project) => project.id === scope) ?? null;

  // Company-wide first, then one tab per project — the order the swipe steps through.
  const scopeOrder = useMemo(() => [COMPANY, ...projects.map((project) => project.id)], [projects]);

  const tabOptions: SegmentedTabOption<string>[] = scopeOrder.map((value) => ({
    value,
    label: value === COMPANY ? "Everyone" : (projects.find((p) => p.id === value)?.name ?? value),
  }));

  const swipeRef = useSwipeableTabs<string, HTMLElement>({
    order: scopeOrder,
    value: scope,
    onChange: setScope,
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={PlaneLanding}
            title="Arrival"
            subtitle="What somebody needs before they can start. Shown on every new joiner's board and raised by their buddy — never enforced."
          />
        </div>
      </header>

      <main ref={swipeRef} className="app-page-frame space-y-5 py-6 lg:py-8">
        {/*
              Rendered only when there is a second scope to switch to. A lone "Everyone" tab on an
              installation with no projects is a control that cannot do anything.
            */}
        {projects.length > 0 && (
          <SegmentedTabs
            value={scope}
            options={tabOptions}
            onChange={setScope}
            layoutId="arrival-scope-pill"
            ariaLabel="Which list to author"
          />
        )}

        <SlidingTabPanel activeKey={scope} index={scopeOrder.indexOf(scope)}>
          {/*
                HR reads the real list rather than a notice standing in for it: they are often the
                person who knows what it should say, and the backend already serves them the read.
              */}
          <ArrivalStepAuthoring
            // Remounted on a scope change rather than reusing state: an "add a step" form left
            // open in one scope would otherwise still be open, and submit, into the next.
            key={scope}
            readOnly={!canAuthor}
            projectId={selected?.id ?? null}
            projectName={selected?.name ?? null}
          />
        </SlidingTabPanel>
      </main>
    </div>
  );
}
