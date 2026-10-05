// ============================================================
// questionIntegrity.ts
// ============================================================
// Keeps a knowledge check a check: multiple-choice options are
// shown in a shuffled order, and a short-text answer may not be
// the sample answer a wrong attempt just revealed.
// ============================================================

import type { OnboardingQuestionOptionEndpoint } from "./types";

/** Options whose meaning depends on standing last, e.g. "All of the above". */
const PINNED_LAST = /^(all|none|both|neither) of (the )?(above|these|them)\b/i;

/** A 32-bit hash of `text`, as the seed for {@link seededRandom}. */
function hashString(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32: a small, seeded generator of numbers in [0, 1). */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The options in an order that says nothing about which are correct.
 *
 * The generated questions tend to list the right answer first, so the stored order gives it away.
 * The order is seeded rather than random so it holds still across re-renders and visits; a new seed
 * (another attempt) gives a new order. "All of the above" and its kind stay at the end, where they
 * still make sense.
 */
export function shuffleOptions(
  options: readonly OnboardingQuestionOptionEndpoint[],
  seed: string,
): OnboardingQuestionOptionEndpoint[] {
  const ordered = [...options].sort((a, b) => a.position - b.position);
  const pinned = ordered.filter((option) => PINNED_LAST.test(option.label.trim()));
  const shuffled = ordered.filter((option) => !pinned.includes(option));
  const random = seededRandom(hashString(seed));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return [...shuffled, ...pinned];
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Word-level edit distance: how many words to insert, drop or swap to get from `a` to `b`. */
function wordDistance(a: readonly string[], b: readonly string[]): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Below this many words a sample answer is a fact ("The Scrum Master"), and repeating a fact after
 * reading it is not copying -- there is no other way to say it.
 */
export const MIN_GUARDED_SAMPLE_WORDS = 5;

/** How alike an answer and a sample may be (1 = the same words) before it counts as copied. */
const COPY_SIMILARITY = 0.75;

/**
 * Whether `answer` is the revealed `sample` handed back: the same words, a few of them changed, or
 * the whole sample with something added around it. Short samples never count, see
 * {@link MIN_GUARDED_SAMPLE_WORDS}.
 */
export function isCopyOfSample(answer: string, sample: string | null | undefined): boolean {
  if (!sample) return false;
  const sampleWords = words(sample);
  if (sampleWords.length < MIN_GUARDED_SAMPLE_WORDS) return false;
  const answerWords = words(answer);
  if (answerWords.length === 0) return false;

  if (` ${answerWords.join(" ")} `.includes(` ${sampleWords.join(" ")} `)) return true;

  const similarity =
    1 - wordDistance(answerWords, sampleWords) / Math.max(answerWords.length, sampleWords.length);
  return similarity >= COPY_SIMILARITY;
}

export const COPIED_SAMPLE_WARNING =
  "That's the sample answer. Put it in your own words — that's how it sticks.";

const REVEALED_SAMPLE_KEY = "sprintstart.onboarding.revealedSample";

/**
 * The sample answer a wrong attempt revealed for a question, remembered past a reload -- otherwise
 * copying it, reloading and pasting would be all it takes.
 */
export function readRevealedSample(questionId: string): string | null {
  try {
    return window.localStorage.getItem(`${REVEALED_SAMPLE_KEY}.${questionId}`);
  } catch {
    return null;
  }
}

export function writeRevealedSample(questionId: string, sample: string): void {
  try {
    window.localStorage.setItem(`${REVEALED_SAMPLE_KEY}.${questionId}`, sample);
  } catch {
    // Without storage the guard only lasts until the page reloads.
  }
}

export function clearRevealedSample(questionId: string): void {
  try {
    window.localStorage.removeItem(`${REVEALED_SAMPLE_KEY}.${questionId}`);
  } catch {
    // Nothing to forget.
  }
}
