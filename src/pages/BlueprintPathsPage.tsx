import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenCheck, FilePlus2, Layers3, Loader2, PencilLine } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import { Badge } from "../components/ui/Badge.tsx";
import { Button } from "../components/ui/Button.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { Field } from "../components/ui/Field.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { Textarea } from "../components/ui/Textarea.tsx";
import type { BlueprintPathOverview } from "../features/blueprints/types.ts";
import { blueprintService, type BlueprintScope } from "../services/blueprintService.ts";
import { useProjectContext } from "../features/projects/useProjectContext.ts";
import { useAuth } from "../context/useAuth.ts";

function statusVariant(status: BlueprintPathOverview["status"]) {
  return status === "ACTIVE" ? "success" : status === "DRAFT" ? "warning" : "neutral";
}

/** Lists all authoring Blueprint paths and starts the path-creation flow. */
export function BlueprintPathsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const { selectedProjectId } = useProjectContext();
  const isAdmin = profile?.permissionGroup === "ADMIN";
  const scope = useMemo<BlueprintScope>(
    () =>
      searchParams.get("scope") === "global" && isAdmin
        ? { kind: "global" }
        : { kind: "project", projectId: selectedProjectId },
    [isAdmin, searchParams, selectedProjectId],
  );
  const isGlobal = scope.kind === "global";
  const [paths, setPaths] = useState<BlueprintPathOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadPaths = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setPaths(await blueprintService.getPaths(scope));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Blueprint paths could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    const loadTimeout = window.setTimeout(() => {
      void loadPaths();
    }, 0);
    return () => window.clearTimeout(loadTimeout);
  }, [loadPaths]);

  async function createPath(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const path = await blueprintService.createPath(scope, { title, description });
      void navigate(`/blueprints/${path.id}${isGlobal ? "?scope=global" : ""}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Blueprint path could not be created.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={Layers3}
        title="Blueprint paths"
        subtitle="Design reusable onboarding paths without changing an employee's live onboarding progress."
        actions={
          <Button
            variant="primary"
            icon={<FilePlus2 className="h-4 w-4" />}
            onClick={() => setIsCreateOpen(true)}
          >
            New blueprint path
          </Button>
        }
      />

      {isAdmin ? (
        <div className="flex flex-wrap gap-2" aria-label="Blueprint scope">
          <Button
            variant={isGlobal ? "secondary" : "primary"}
            aria-pressed={!isGlobal}
            onClick={() => setSearchParams({})}
          >
            Project blueprints
          </Button>
          <Button
            variant={isGlobal ? "primary" : "secondary"}
            aria-pressed={isGlobal}
            onClick={() => setSearchParams({ scope: "global" })}
          >
            Global blueprints
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-app-danger-bg p-4 text-sm text-app-danger-text">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-3 py-12 text-app-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading blueprint paths…
        </div>
      ) : paths.length === 0 ? (
        <EmptyState icon={<BookOpenCheck className="h-8 w-8" />} title="No blueprint paths yet">
          Create the first reusable onboarding path to begin authoring.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {paths.map((path) => (
            <article
              key={path.id}
              className="flex min-w-0 flex-col rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-app-text">{path.title}</h2>
                  <p className="mt-1 text-sm text-app-text-muted">Version {path.version}</p>
                </div>
                <Badge variant={statusVariant(path.status)}>{path.status}</Badge>
              </div>
              <p className="mt-4 line-clamp-3 min-h-15 text-sm leading-6 text-app-text-subtle">
                {path.description || "No description yet."}
              </p>
              <Button
                className="mt-5 self-start"
                variant="secondary"
                icon={<PencilLine className="h-4 w-4" />}
                onClick={() =>
                  void navigate(`/blueprints/${path.id}${isGlobal ? "?scope=global" : ""}`)
                }
              >
                Open blueprint
              </Button>
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreateOpen}
        title="New blueprint path"
        description="Start with the purpose of this reusable onboarding path."
        onClose={() => setIsCreateOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="create-blueprint-path" loading={isSaving}>
              Create path
            </Button>
          </>
        }
      >
        <form
          id="create-blueprint-path"
          className="space-y-4"
          onSubmit={(event) => void createPath(event)}
        >
          <Field label="Title" required>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </Field>
          <Field label="Description" required>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </Field>
        </form>
      </Modal>
    </main>
  );
}
