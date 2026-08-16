import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { AccessConnector } from "../types";

type AccessAddMenuProps = {
  connectors: AccessConnector[];
  /** Receives the id of the source the new credential should be added to. */
  onSelect: (connectorId: string) => void;
};

/**
 * The one "add" entry point of the access view: pick a source, then fill in
 * that source's form.
 *
 * Without it, adding a credential for a source you do not use yet means first
 * working out that it is hidden behind the filter — the button has to be
 * reachable no matter what is currently listed.
 *
 * Built as a plain popover of buttons rather than an ARIA `menu`, matching the
 * project picker in `ProjectAccessPanel`: the full menu pattern owes the user
 * arrow-key navigation, and a popover of ordinary buttons owes them nothing
 * beyond what is here (Escape, click-outside, visible focus).
 */
export function AccessAddMenu({ connectors, onSelect }: AccessAddMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (connectorId: string) => {
    setIsOpen(false);
    onSelect(connectorId);
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="primary"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        data-testid="access-add-open"
        icon={<Plus className="h-4 w-4" aria-hidden />}
        trailingIcon={
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        }
        className="w-full sm:w-auto"
      >
        Add credential
      </Button>

      {isOpen && (
        <div
          className="absolute right-0 z-30 mt-2 w-[min(calc(100vw-2rem),16rem)] rounded-2xl border border-app-border bg-app-surface p-2 shadow-lg"
          aria-label="Choose a source"
        >
          {connectors.map((connector) => {
            const Icon = connector.icon;

            return (
              <button
                key={connector.id}
                type="button"
                onClick={() => handleSelect(connector.id)}
                data-testid={`access-add-source-${connector.id}`}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-app-border bg-app-surface-muted">
                  <Icon className="h-4 w-4 text-app-text-muted" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-app-text">
                    {connector.label}
                  </span>
                  <span className="block truncate text-xs text-app-text-muted">
                    New {connector.noun.one}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
