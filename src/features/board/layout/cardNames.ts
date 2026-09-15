import { readableTitle } from "../generation/pathToCards";
import type { BoardCard } from "../types";

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
    case "PATH_TO_FIRST_CONTRIBUTION":
      return "Your path to a first contribution";
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
