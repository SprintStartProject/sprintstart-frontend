/**
 * Everything the buddy asks of the backend: conversations, suggestions, actions and the two
 * streams (a visit's greeting and a message's reply).
 *
 * The functions live in `./buddy/`, one file per area; this file is the single address the rest of
 * the app imports them from.
 */
export * from "./buddy/actions";
export { streamOpenBuddy, type BuddyOpeningHandlers } from "./buddy/opening";
export { streamMessage, type BuddyMessageOptions } from "./buddy/messageStream";
export * from "./buddy/sessions";
export * from "./buddy/suggestions";
