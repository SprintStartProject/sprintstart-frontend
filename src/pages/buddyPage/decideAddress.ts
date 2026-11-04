export type AddressAction =
  | { kind: "none" }
  /** The list may be stale: re-read it once before calling the address unknown. */
  | { kind: "refresh"; target: string }
  /** The address cannot be followed now: put it back to the conversation on screen. */
  | { kind: "revert" }
  /** The address names a known conversation: open it. */
  | { kind: "select"; target: string }
  /** The conversation changed under the address: the address follows it. */
  | { kind: "follow"; sessionId: string };

export type AddressInput = {
  urlSessionId: string | undefined;
  /** The conversation on screen at the previous run, `null` before the first resolve. */
  previousSessionId: string | null;
  currentSessionId: string | null;
  knownSessionIds: readonly string[];
  /** The unknown address a list re-read is already answering, if any. */
  refreshedFor: string | null;
  /** The first open or the greeting is still running. */
  isSettling: boolean;
  /** A decision is running, or the buddy is in team mode. */
  cannotSwitch: boolean;
};

function followOrNothing(input: AddressInput): AddressAction {
  const { urlSessionId, previousSessionId, currentSessionId } = input;
  if (!currentSessionId || previousSessionId === null) return { kind: "none" };
  if (urlSessionId === currentSessionId) return { kind: "none" };
  if (urlSessionId !== undefined && urlSessionId !== previousSessionId) return { kind: "none" };
  return { kind: "follow", sessionId: currentSessionId };
}

function actOnExplicitAddress(input: AddressInput, target: string): AddressAction {
  if (input.knownSessionIds.length === 0 || input.isSettling) return { kind: "none" };

  if (!input.knownSessionIds.includes(target)) {
    return input.refreshedFor === target ? { kind: "none" } : { kind: "refresh", target };
  }
  return input.cannotSwitch ? { kind: "revert" } : { kind: "select", target };
}

/**
 * What the page should do about the address bar, given where the conversation and the address are.
 *
 * Precedence: an address that names neither where we are nor where we just were is explicit — a
 * deep link, a reload, the back button — and wins. Otherwise a conversation that *changed* takes
 * the address with it. The first resolve (`previousSessionId === null`) is left out on purpose: the
 * bare page keeps its bare address.
 */
export function decideAddress(input: AddressInput): AddressAction {
  const { urlSessionId, previousSessionId, currentSessionId } = input;
  const isExplicit =
    urlSessionId && urlSessionId !== previousSessionId && urlSessionId !== currentSessionId;

  return isExplicit ? actOnExplicitAddress(input, urlSessionId) : followOrNothing(input);
}
