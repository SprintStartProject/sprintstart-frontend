import { BookOpen, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { DrawerCard } from "../../../components/ui/DrawerCard.tsx";
import { IconTile } from "../../../components/ui/IconTile.tsx";
import {
  knowledgeBaseHrefFor,
  knowledgeBaseScopeLabelFor,
} from "../connectors/knowledgeBaseLink.ts";
import { formatNumber } from "../data.ts";
import type { DataSource } from "../types.ts";

type KnowledgeBaseLinkCardProps = {
  source: DataSource;
  artifactCount: number;
  /** Position in the drawer's body stack, see {@link DrawerCard}. */
  index: number;
};

/**
 * A drawer section that is one big link into the knowledge base, already filtered to
 * the source. The whole card is the target and the chevron is its "opens the next
 * view" cue; the subtitle says how many artifacts to expect and what the list is
 * filtered to, so the click holds no surprise.
 */
export function KnowledgeBaseLinkCard({
  source,
  artifactCount,
  index,
}: KnowledgeBaseLinkCardProps) {
  return (
    <DrawerCard bare index={index} className="mt-4 sm:mt-5">
      <Link
        to={knowledgeBaseHrefFor(source)}
        className="group flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-5 transition-colors hover:border-app-brand-border hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none sm:p-6"
      >
        <IconTile icon={BookOpen} size="md" tone="brand" />

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-app-text">
            Browse in the knowledge base
          </span>
          <span className="mt-0.5 block text-xs wrap-anywhere text-app-text-muted">
            {formatNumber(artifactCount)} {artifactCount === 1 ? "artifact" : "artifacts"} ·{" "}
            {knowledgeBaseScopeLabelFor(source)}
          </span>
        </span>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-surface-muted text-app-text-muted transition-colors group-hover:bg-app-brand group-hover:text-white">
          <ChevronRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
            aria-hidden="true"
          />
        </span>
      </Link>
    </DrawerCard>
  );
}
