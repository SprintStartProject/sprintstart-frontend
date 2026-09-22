/** Shared look for a selectable card acting as a radio option — the edit drawer's scope pick and
 * the add-step wizard's kind/suggestion picks all read as one control family. */
export function radioCardClassName(active: boolean): string {
  return `rounded-xl border p-3 text-left transition-colors ${
    active
      ? "border-app-brand bg-app-brand-soft ring-2 ring-app-brand-glow"
      : "border-app-border bg-app-bg hover:border-app-border-strong"
  }`;
}
