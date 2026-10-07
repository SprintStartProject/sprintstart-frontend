/**
 * Where the composer's drafts are kept: `localStorage`, one entry per user and conversation.
 *
 * The key carries the user because a browser is not always one person's. A draft filed under
 * `__new__` or `team:<projectId>` was the same entry for everybody who used the browser, so the
 * next manager of a project opened the box to the previous one's half-written question. Session
 * ids never collided (a conversation is one user's), but they share the scheme so one rule
 * covers every key.
 *
 * Without a user there is nobody to file a draft for: nothing is read or written.
 */
const PREFIX = "buddyDraft.";

function storageKey(userId: string, conversationKey: string): string {
  return `${PREFIX}${userId}.${conversationKey}`;
}

export function readDraft(userId: string | null, conversationKey: string): string {
  if (userId === null) return "";
  try {
    return localStorage.getItem(storageKey(userId, conversationKey)) ?? "";
  } catch {
    // Private modes can refuse storage outright. An empty box is not a failure.
    return "";
  }
}

/** An empty draft removes the entry rather than storing one: a box nobody has touched is not a draft. */
export function writeDraft(userId: string | null, conversationKey: string, draft: string): void {
  if (userId === null) return;
  try {
    if (draft) localStorage.setItem(storageKey(userId, conversationKey), draft);
    else localStorage.removeItem(storageKey(userId, conversationKey));
  } catch {
    // Nothing to do: the box still works, it just will not be remembered.
  }
}

/** Forgets a conversation's draft — for one that is gone, so its words do not outlive it. */
export function clearDraft(userId: string | null, conversationKey: string): void {
  writeDraft(userId, conversationKey, "");
}

/**
 * Removes the entries written before drafts were filed per user (`buddyDraft.<key>`, with no
 * user in it). Their shared keys would otherwise sit in storage for good: nothing reads them any
 * more, and they cannot be handed to a user they may not belong to.
 */
export function discardUnscopedDrafts(): void {
  try {
    const stale: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(PREFIX) && !key.slice(PREFIX.length).includes(".")) stale.push(key);
    }
    stale.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing to do: stale entries are inert.
  }
}
