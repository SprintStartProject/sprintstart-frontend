/**
 * A timer that goes off when nothing has been heard for a while, and is pushed back by every
 * sign of life.
 */
export function createWatchdog(ms: number, onTimeout: () => void) {
  let id: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (id !== null) {
      clearTimeout(id);
      id = null;
    }
  };

  const arm = () => {
    clear();
    id = setTimeout(onTimeout, ms);
  };

  return { arm, clear };
}

export type Chunk = { content: string; reasoning: string };

/**
 * Text that has arrived but is not on screen yet.
 *
 * Tokens come faster than a frame, so they are gathered and handed over once per frame rather than
 * one render each. `flush` hands over whatever is waiting straight away.
 */
export function createDraftBuffer(apply: (chunk: Chunk) => void) {
  let content = "";
  let reasoning = "";
  let frame: number | null = null;

  const flush = () => {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    if (!content && !reasoning) return;

    const chunk = { content, reasoning };
    content = "";
    reasoning = "";
    apply(chunk);
  };

  return {
    addContent: (text: string) => {
      content += text;
    },
    addReasoning: (text: string) => {
      reasoning += text;
    },
    discardContent: () => {
      content = "";
    },
    schedule: () => {
      if (frame === null) frame = requestAnimationFrame(flush);
    },
    flush,
  };
}
