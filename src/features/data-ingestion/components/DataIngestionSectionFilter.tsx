import {
  SegmentedTabs,
  type SegmentedTabOption,
} from "../../../components/ui/SegmentedTabs.tsx";
import { SECTION_ORDER, type SectionKey } from "../types.ts";

const SECTION_LABELS: Record<SectionKey, string> = {
  overview: "Overview",
  sources: "Sources",
  runs: "Runs",
};

type DataIngestionSectionFilterProps = {
  active: SectionKey;
  onChange: (section: SectionKey) => void;
  sourceCount: number;
  runCount: number;
};

/**
 * Section navigation for the overview-first Data Ingestion page: `Overview` is
 * the dashboard and shows everything (overview + sources + runs); the other two
 * narrow to a single section.
 */
export function DataIngestionSectionFilter({
  active,
  onChange,
  sourceCount,
  runCount,
}: DataIngestionSectionFilterProps) {
  // Overview is a dashboard over everything, so it carries no count of its own.
  const counts: Partial<Record<SectionKey, number>> = {
    sources: sourceCount,
    runs: runCount,
  };

  const options: SegmentedTabOption<SectionKey>[] = SECTION_ORDER.map((key) => ({
    value: key,
    label: SECTION_LABELS[key],
    count: counts[key],
  }));

  return (
    <SegmentedTabs
      value={active}
      options={options}
      onChange={onChange}
      layoutId="data-ingestion-section-pill"
      ariaLabel="Filter sections"
    />
  );
}
