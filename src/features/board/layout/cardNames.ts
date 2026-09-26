import { PATH_STEP_FALLBACK_TITLE, type BoardCard } from "../types";

/**
 * The invisible marks the retired "Build my path" generator put at the front of a checklist title:
 * U+2063 for a step of the onboarding path, U+2060 for a card blueprint. The generator is gone --
 * onboarding is the path on its own page -- but cards it made are still on boards, so the marks are
 * still taken off wherever a title is read.
 */
const LEGACY_TITLE_MARKS = /^[\u2060\u2063]/;

/** A checklist title as the hire reads it. */
export function readableTitle(title: string): string {
  return title.replace(LEGACY_TITLE_MARKS, "");
}

/**
 * What to call a card when it is being talked about from somewhere else on the board.
 *
 * Needed the moment cards can refer to each other: "waiting on …", the "after:" options in the
 * sequencing picker, the sentence a blocked card carries. Their own cards title themselves with
 * their content, so a note is named by its first line and a checklist by its title; a live card is
 * named by what it is. Never an id — the reader is a person looking for that card on the same page.
 */
export function cardName(card: BoardCard): string {
  const content = card.content;
  switch (content.kind) {
    case "CHECKLIST":
      return content.title ? readableTitle(content.title) : "Checklist";
    case "NOTE":
      return firstLine(content.text) || "Note";
    case "LINK":
      return content.label ?? content.url;
    case "DIAGRAM":
      return content.subject;
    case "ARRIVAL_STEPS":
      return "Your arrival steps";
    case "OPEN_PULL_REQUESTS":
      return "Your open pull requests";
    case "CURRENT_TASK":
      return content.title ?? "The task you are on";
    case "SUGGESTED_TASKS":
      return "Work worth picking up";
    case "COMPETENCY_PROGRESS":
      return "What you have shown";
    case "MEMORY_RECAP":
      return "What your buddy remembers";
    case "PATH_STEP":
      return content.title ?? PATH_STEP_FALLBACK_TITLE;
    default:
      return "Card";
  }
}

/** The first line, trimmed to something that fits in a dropdown option. */
function firstLine(text: string): string {
  const line =
    text
      .split("\n")
      .find((candidate) => candidate.trim().length > 0)
      ?.trim() ?? "";

  return line.length > 48 ? `${line.slice(0, 47)}…` : line;
}
