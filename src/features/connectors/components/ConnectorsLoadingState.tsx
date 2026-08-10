import { EmptyState } from "../../../components/ui/EmptyState.tsx";
import { Spinner } from "../../../components/ui/Spinner.tsx";

/**
 * Shown while the connector list is being fetched. Deliberately the same box as
 * the empty state that may follow it — only the words differ, so the page does
 * not visibly reshape when the answer arrives.
 */
export function ConnectorsLoadingState() {
  return (
    <EmptyState icon={<Spinner size="lg" silent />} title="Loading connectors">
      Fetching registered connectors and their configuration from the backend.
    </EmptyState>
  );
}
