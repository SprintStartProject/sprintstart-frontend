import { Check, LayoutDashboard, RefreshCw } from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/Button";

type Props = {
  frameClass: string;
  isArranging: boolean;
  planChanges: number;
  onCancelPlanning: () => void;
  onFinishPlanning: () => void;
  onRefresh: () => void;
  /** Whether there is a project to refresh. */
  canRefresh: boolean;
  loading: boolean;
};

function PlanningActions(props: Props) {
  const { planChanges } = props;
  return (
    <>
      <span className="text-sm text-app-text-muted" role="status">
        {planChanges === 0
          ? "No changes yet"
          : `${planChanges} ${planChanges === 1 ? "change" : "changes"}`}
      </span>
      <Button variant="secondary" onClick={props.onCancelPlanning}>
        Cancel
      </Button>
      <Button
        variant="primary"
        onClick={props.onFinishPlanning}
        icon={<Check className="h-4 w-4" aria-hidden="true" />}
      >
        Done
      </Button>
    </>
  );
}

/** The title row. Gone in focus mode, with everything on it either in the tool rail already or one Escape away. */
export function BoardHeader(props: Props) {
  return (
    <header className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
      <div className={`${props.frameClass} py-6`}>
        <PageHeader
          icon={LayoutDashboard}
          title="Board"
          subtitle={
            props.isArranging
              ? "Put cards into piles and areas, and move them where they belong."
              : "Where your work stays put between conversations."
          }
          actions={
            props.isArranging ? (
              <PlanningActions {...props} />
            ) : (
              <Button
                variant="secondary"
                onClick={props.onRefresh}
                disabled={!props.canRefresh}
                loading={props.loading}
                icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
              >
                Refresh
              </Button>
            )
          }
        />
      </div>
    </header>
  );
}
