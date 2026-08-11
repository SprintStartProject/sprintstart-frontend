import { EmptyState } from "../../../components/ui/EmptyState.tsx";
import { Spinner } from "../../../components/ui/Spinner.tsx";

/**
 * Shown while sources and runs are being fetched — same box as the empty state
 * that may follow, so the page does not reshape when the answer arrives.
 */
export function DataIngestionLoadingState() {
  return (
    <EmptyState icon={<Spinner size="lg" silent />} title="Loading ingestion data">
      Fetching source statuses and recent ingestion runs from the backend.
    </EmptyState>
  );
}
