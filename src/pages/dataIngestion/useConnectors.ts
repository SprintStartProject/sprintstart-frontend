import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useToast } from "../../context/useToast";
import { toConnectorListItems } from "../../features/connectors/data.ts";
import type { ConnectorListItem } from "../../features/connectors/types.ts";
import { connectorService } from "../../services/connectorService.ts";
import { queryKeys } from "../../services/queryKeys.ts";

/**
 * The connector state decides whether a source reaches chat at all, so it is loaded with the page
 * rather than only when the connectors modal opens -- otherwise a globally disabled connector
 * stays invisible while every card still claims "Connected".
 *
 * A failure is not retried and not reported on the page: the endpoint is PM/ADMIN-only, but HR
 * may open this page, and an unknown connector state must not fake a disabled source. The
 * connectors modal shows the failure.
 */
export function useConnectors() {
  const query = useQuery({
    queryKey: queryKeys.ingestion.connectors(),
    queryFn: async () => toConnectorListItems(await connectorService.listConnectors()),
    retry: false,
  });
  const connectors = useMemo(() => query.data ?? [], [query.data]);
  const enabledById = useMemo(
    () => new Map(connectors.map((connector) => [connector.id.toLowerCase(), connector.enabled])),
    [connectors],
  );

  return { query, connectors, enabledById };
}

/** The connectors modal: whether it is open, and switching a connector on or off. */
export function useConnectorsModal(connectors: ReturnType<typeof useConnectors>) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggle(connector: ConnectorListItem) {
    setTogglingId(connector.id);
    try {
      const response = await connectorService.setConnectorEnabled(connector.id, !connector.enabled);

      queryClient.setQueryData<ConnectorListItem[]>(queryKeys.ingestion.connectors(), (current) =>
        current?.map((item) => (item.id === connector.id ? { ...item, ...response } : item)),
      );
      toast.success(connector.enabled ? "Connector disabled" : "Connector enabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update the connector.");
    } finally {
      setTogglingId(null);
    }
  }

  return {
    isOpen,
    togglingId,
    toggle,
    close: () => setIsOpen(false),
    open: () => {
      setIsOpen(true);
      // A load that failed earlier (the list is not retried in the background) is tried again
      // when the user asks for the modal.
      if (connectors.query.isError) void connectors.query.refetch();
    },
  };
}
