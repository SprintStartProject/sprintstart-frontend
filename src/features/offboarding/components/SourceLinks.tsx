import { ExternalLink } from "lucide-react";

import type { FileRisk } from "../../../services/offboardingTypes";
import { sourceLinks } from "../sourceLinks";

function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

/** A small icon that opens the file at its source, for a row of a list. Nothing for an unknown host. */
export function SourceLinkIcon({ file }: { file: FileRisk }) {
  const links = sourceLinks(file.repository, file.path);
  if (!links) return null;
  return (
    <a
      href={links.file}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${fileName(file.path)} on ${links.provider}`}
      className="focus-ring inline-flex items-center rounded-md px-1.5 py-0.5 text-app-brand-text hover:bg-app-brand-soft"
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </a>
  );
}
