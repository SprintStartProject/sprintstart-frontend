import { Archive, ArrowLeft, FilePlus2, History, Layers3, RotateCcw, Rocket } from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader.tsx";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { versionWord } from "../pathLifecycle.ts";
import type { BlueprintPath } from "../types.ts";

const STATUS_BADGE = { ACTIVE: "success", ARCHIVED: "neutral", DRAFT: "warning" } as const;

interface BlueprintPathHeaderProps {
  path: BlueprintPath;
  isArchiving: boolean;
  isLifecycleBusy: boolean;
  onBack: () => void;
  onOpenHistory: () => void;
  onArchive: () => void;
  onEditAsDraft: () => void;
  onRevert: () => void;
  onPublish: () => void;
}

type StatusActionsProps = Pick<
  BlueprintPathHeaderProps,
  | "path"
  | "isArchiving"
  | "isLifecycleBusy"
  | "onArchive"
  | "onEditAsDraft"
  | "onRevert"
  | "onPublish"
>;

/** The one or two actions that fit the version being looked at: publish, revert, or archive and edit. */
function StatusActions({
  path,
  isArchiving,
  isLifecycleBusy,
  onArchive,
  onEditAsDraft,
  onRevert,
  onPublish,
}: StatusActionsProps) {
  if (path.status === "ACTIVE") {
    return (
      <>
        <Button
          variant="dangerSoft"
          icon={<Archive className="h-4 w-4" />}
          loading={isArchiving}
          onClick={onArchive}
        >
          Archive
        </Button>
        <Button variant="primary" icon={<FilePlus2 className="h-4 w-4" />} onClick={onEditAsDraft}>
          Edit as draft
        </Button>
      </>
    );
  }
  if (path.status === "ARCHIVED") {
    return (
      <Button
        variant="primary"
        icon={<RotateCcw className="h-4 w-4" />}
        disabled={isLifecycleBusy}
        onClick={onRevert}
      >
        Revert to this version
      </Button>
    );
  }
  return (
    <Button
      variant="primary"
      icon={<Rocket className="h-4 w-4" />}
      disabled={isLifecycleBusy}
      onClick={onPublish}
    >
      Publish
    </Button>
  );
}

/** The blueprint's title and version, with the actions for the version being looked at. */
export function BlueprintPathHeader({
  path,
  isArchiving,
  isLifecycleBusy,
  onBack,
  onOpenHistory,
  onArchive,
  onEditAsDraft,
  onRevert,
  onPublish,
}: BlueprintPathHeaderProps) {
  return (
    <header className="border-b border-app-border bg-app-bg">
      <div className="app-page-frame py-6">
        <PageHeader
          icon={Layers3}
          title={path.title}
          subtitle={path.description || "No path description yet."}
          actions={
            <>
              <Badge variant={STATUS_BADGE[path.status]}>
                {versionWord(path.status)} · v{path.version}
              </Badge>
              <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={onBack}>
                All blueprints
              </Button>
              <Button
                variant="secondary"
                icon={<History className="h-4 w-4" />}
                onClick={onOpenHistory}
              >
                Version history
              </Button>
              <StatusActions
                path={path}
                isArchiving={isArchiving}
                isLifecycleBusy={isLifecycleBusy}
                onArchive={onArchive}
                onEditAsDraft={onEditAsDraft}
                onRevert={onRevert}
                onPublish={onPublish}
              />
            </>
          }
        />
      </div>
    </header>
  );
}
