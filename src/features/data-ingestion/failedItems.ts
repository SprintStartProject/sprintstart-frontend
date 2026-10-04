import type { FailedArtifact } from "./types.ts";

const ARTIFACT_LABELS: Record<string, { singular: string; plural: string }> = {
  COMMIT: { singular: "Commit", plural: "Commits" },
  FILE: { singular: "File", plural: "Files" },
  ISSUE: { singular: "Issue", plural: "Issues" },
  PULL_REQUEST: { singular: "Pull request", plural: "Pull requests" },
  PAGE: { singular: "Page", plural: "Pages" },
};

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function labelsFor(artifactType: string) {
  const known = ARTIFACT_LABELS[artifactType];
  if (known) return known;

  const readable = capitalize(artifactType.toLowerCase().replace(/_/g, " "));
  return { singular: readable, plural: readable };
}

/**
 * Title of a failed item. An item with a reference is one artifact that could
 * not be processed; one without is a whole fetch of that artifact type that
 * failed, so it reads as such instead of naming an unknown artifact.
 */
export function describeFailedItem(item: FailedArtifact): string {
  const labels = labelsFor(item.artifactType);

  return item.reference
    ? `${labels.singular}: ${item.reference}`
    : `${labels.plural} could not be fetched`;
}
