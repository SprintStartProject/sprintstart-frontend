import type { KeyboardEvent } from "react";

/** A row that opens its item for editing on a click, Enter or the space bar. */
export function activatesOnKey(open: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };
}
