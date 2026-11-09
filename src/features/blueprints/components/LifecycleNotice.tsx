import type { BlueprintPath } from "../types.ts";

/**
 * What this version of the blueprint means for the people it is for.
 *
 * The status badge says `DRAFT · v4`, which answers a question nobody asked. The question authors
 * actually have is whether editing this takes the thing out of service — and the answer is no: a
 * draft is a copy of the active version, and the active version keeps being handed to new hires
 * until the draft is published. Saying so is the difference between a surface people edit and one
 * they are afraid to touch.
 */
export function LifecycleNotice({
  status,
  version,
}: {
  status: BlueprintPath["status"];
  version: number;
}) {
  if (status === "DRAFT") {
    return (
      <p className="rounded-xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
        <strong className="font-semibold">Draft v{version}.</strong> Nothing here reaches anybody
        yet — the published version keeps being handed to new hires until you press Publish. Every
        change is saved as you make it; Publish is what swaps the two over.
      </p>
    );
  }

  if (status === "ARCHIVED") {
    return (
      <p className="rounded-xl border border-app-neutral-border bg-app-neutral-bg px-4 py-3 text-sm text-app-neutral-text">
        <strong className="font-semibold">Archived v{version}.</strong> Read-only. Hires who were
        given this path keep their copy; nobody new is given it. &ldquo;Revert to this
        version&rdquo; makes it the published one again.
      </p>
    );
  }

  return (
    <p className="rounded-xl border border-app-success-border bg-app-success-bg px-4 py-3 text-sm text-app-success-text">
      <strong className="font-semibold">Published v{version}.</strong> This is what a new hire on
      this project is given. To change it, open a draft — this version stays in service until the
      draft is published.
    </p>
  );
}
