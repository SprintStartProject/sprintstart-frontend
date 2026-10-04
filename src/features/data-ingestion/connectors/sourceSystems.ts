/**
 * The source systems the product ingests from, in the order they are offered.
 * The single definition of {@link SourceSystem}: every other module that names
 * a source system imports it from here.
 */
export const SOURCE_SYSTEMS = ["GITHUB", "JIRA", "UPLOAD", "CONFLUENCE"] as const;

export type SourceSystem = (typeof SOURCE_SYSTEMS)[number];

/**
 * Parses a source system out of free text (a project source's type, a backend
 * connector id), ignoring case. Null when the value names no known system.
 */
export function toSourceSystem(value: string): SourceSystem | null {
  const normalized = value.toUpperCase();

  return SOURCE_SYSTEMS.find((system) => system === normalized) ?? null;
}
