/**
 * Anything that can change whether the PM dashboard still needs attention
 * announces itself here: deciding a skip request, or marking feedback read.
 *
 * A tiny emitter rather than a context, because the only listener is the
 * sidebar badge and the callers are plain service functions. Without it the
 * badge would keep bouncing until the next rate-limited check, long after the
 * user has dealt with the thing it was pointing at.
 */
type PmAttentionListener = () => void;

const pmAttentionListeners = new Set<PmAttentionListener>();

/**
 * Subscribes to changes of what waits on the project manager.
 *
 * @returns A function that removes the listener again.
 */
export function onPmAttentionChanged(listener: PmAttentionListener): () => void {
  pmAttentionListeners.add(listener);
  return () => {
    pmAttentionListeners.delete(listener);
  };
}

export function notifyPmAttentionChanged(): void {
  pmAttentionListeners.forEach((listener) => {
    listener();
  });
}
