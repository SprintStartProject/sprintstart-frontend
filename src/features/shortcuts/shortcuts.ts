import type { AppRoute } from "../../auth/accessPolicy";
import { isTypingTarget } from "../easter-eggs/lib/keyTargets";

/**
 * Every chord in the app, defined once.
 *
 * Before this module, each shortcut was a one-off listener with its own idea of what a
 * press is — `useNewConversationShortcut` refused Ctrl, `ProjectSwitcher` compared
 * `event.key`. Two spellings of one rule is how a chord starts disagreeing with the hint
 * that advertises it, so the matching lives here ({@link isShortcutPress}), the labels
 * live here ({@link shortcutChord}), and the components listen through these definitions
 * instead of their own.
 *
 * `code` rather than `key` is the convention for letter chords (`KeyH` is the H key
 * wherever the keyboard was made). `key` is for characters no single physical key owns:
 * `?` is Shift+ß on a German keyboard and Shift+/ on a US one, so the produced character
 * is the only honest match — a `code: "Slash"` chord is dead on half the team's keyboards.
 *
 * `scope` says who answers a press. `global` items are the shortcuts layer's own
 * (`GlobalShortcuts`): it navigates, or opens the help. `surface` items are answered by
 * the component the chord belongs to — the sidebar owns its drawer, the switcher owns its
 * dialog — and are listed here all the same, so the help view cannot drift from them.
 */
export type ShortcutCategory = "Navigation" | "Actions" | "General";

/** Who answers the keypress — see the module docstring. */
export type ShortcutScope = "global" | "surface";

export type ShortcutItem = {
  id: string;
  label: string;
  category: ShortcutCategory;
  scope: ShortcutScope;
  /** Physical key, layout-independent. One of `code` / `key` is set, never both. */
  code?: string;
  /** The produced character, for keys no single `code` owns. */
  key?: string;
  altKey?: boolean;
  /** Ctrl on Windows/Linux, Cmd on macOS. */
  ctrlOrMeta?: boolean;
  shiftKey?: boolean;
  /** Navigation destination. Its presence means `canAccessRoute` gates the chord. */
  path?: AppRoute;
  /** Fires while a text field has focus. Only the new-conversation chord wants that. */
  allowInInput?: boolean;
  /** A word for the odd one out, where a chord only works somewhere specific. */
  note?: string;
};

/**
 * The navigation chords, and why Alt: every Ctrl/Cmd combination a desktop browser uses
 * belongs to the browser and a page cannot refuse it — the same reason `Alt+N` was chosen
 * over `Ctrl+N` for a new conversation. The Alt row is free for all of these on Chrome,
 * Edge and Firefox on Windows, the platform this team works on, and the letters are the
 * destinations' first letters.
 */
const NAVIGATE_DASHBOARD: ShortcutItem = {
  id: "nav-home",
  label: "Dashboard",
  category: "Navigation",
  scope: "global",
  code: "KeyH",
  altKey: true,
  path: "/",
};

const NAVIGATE_BOARD: ShortcutItem = {
  id: "nav-board",
  label: "Board",
  category: "Navigation",
  scope: "global",
  code: "KeyB",
  altKey: true,
  path: "/board",
};

/**
 * The chat's own chord. The handed-over plan left Chat without one while giving `Alt+U` to
 * the buddy — which is the same sidebar entry's second half (`/buddy` lights up Chat), so
 * the entry people actually click every day would have stayed the only unlabelled one.
 */
const NAVIGATE_CHAT: ShortcutItem = {
  id: "nav-chat",
  label: "Chat",
  category: "Navigation",
  scope: "global",
  code: "KeyC",
  altKey: true,
  path: "/chat",
};

const NAVIGATE_BUDDY: ShortcutItem = {
  id: "nav-buddy",
  label: "Buddy",
  category: "Navigation",
  scope: "global",
  code: "KeyU",
  altKey: true,
  path: "/buddy",
};

const NAVIGATE_KNOWLEDGE_BASE: ShortcutItem = {
  id: "nav-kb",
  label: "Knowledge Base",
  category: "Navigation",
  scope: "global",
  code: "KeyK",
  altKey: true,
  path: "/knowledge-base",
};

/**
 * PM Dashboard. `path` gating means the `canAccessRoute` rule decides who may use it — a
 * hire pressing the chord is refused exactly like one typing the URL.
 */
const NAVIGATE_PM_DASHBOARD: ShortcutItem = {
  id: "nav-pm",
  label: "PM Dashboard",
  category: "Navigation",
  scope: "global",
  code: "KeyP",
  altKey: true,
  path: "/pm-dashboard",
};

/**
 * Character-matched like the other punctuation: the comma is the character somebody
 * presses for, and every layout spells it the same way while placing it differently
 * (QWERTZ and QWERTY leave it unshifted, AZERTY shifts it) — a `code` chord would work
 * here and fail there.
 */
const NAVIGATE_SETTINGS: ShortcutItem = {
  id: "nav-settings",
  label: "Settings",
  category: "Navigation",
  scope: "global",
  key: ",",
  altKey: true,
  path: "/settings",
};

/**
 * Ctrl/Cmd+K, the one chord with a platform split. The dialog it opens is the project
 * switcher's, so the switcher answers it (`scope: "surface"`) — the registry's job is only
 * to guarantee the hint on its trigger and its handler read the same definition.
 */
export const SWITCH_PROJECT_SHORTCUT: ShortcutItem = {
  id: "act-switcher",
  label: "Switch project",
  category: "Actions",
  scope: "surface",
  code: "KeyK",
  ctrlOrMeta: true,
};

/**
 * Alt+N fires even while the composer has focus — the moment somebody most wants a fresh
 * conversation is halfway through typing into the wrong one. The cost is named in the
 * hook: on macOS `Option+N` is the dead key for `ñ`, a trade this Windows-first team takes.
 */
export const NEW_CONVERSATION_SHORTCUT: ShortcutItem = {
  id: "act-new-chat",
  label: "New conversation",
  category: "Actions",
  scope: "surface",
  code: "KeyN",
  altKey: true,
  allowInInput: true,
};

/**
 * Alt+S works the drawer the mobile header's button works. There is no desktop collapse to
 * toggle yet (#244); until then the chord is a no-op on a wide screen rather than a second
 * behaviour, because inventing one here would only have to be undone there.
 */
export const SIDEBAR_TOGGLE_SHORTCUT: ShortcutItem = {
  id: "act-sidebar",
  label: "Toggle sidebar",
  category: "Actions",
  scope: "surface",
  code: "KeyS",
  altKey: true,
  note: "small screens",
};

/**
 * `/` focuses the chat composer (ChatPage, since before this registry existed, the way
 * Slack and GitHub do it). Character-matched: on a German keyboard `/` is Shift+7.
 */
const FOCUS_COMPOSER: ShortcutItem = {
  id: "act-focus-composer",
  label: "Jump to the message box",
  category: "Actions",
  scope: "surface",
  key: "/",
  note: "in Chat",
};

/**
 * The help itself. Character-matched for the same reason as `/`: `?` is Shift+ß on a
 * German keyboard and Shift+/ on a US one — no single `code` describes "the question
 * mark", and the handed-over plan's `code: "Slash"` would never have fired here.
 */
const SHOW_SHORTCUTS: ShortcutItem = {
  id: "gen-shortcuts",
  label: "Keyboard shortcuts",
  category: "General",
  scope: "global",
  key: "?",
};

/**
 * Esc is documented, not handled from here. Thirty-odd dialogs, popovers and the buddy
 * dock already own it locally — several of them checking `event.defaultPrevented` before
 * acting — and a global handler that also called `preventDefault` would break the layered
 * cases in the name of listing them.
 */
const DISMISS: ShortcutItem = {
  id: "gen-dismiss",
  label: "Close a dialog or menu",
  category: "General",
  scope: "surface",
  code: "Escape",
};

/**
 * The catalogue, in the order the help view reads it: what you navigate with, what you do
 * with, and the two general keys.
 */
export const SHORTCUTS: readonly ShortcutItem[] = [
  NAVIGATE_DASHBOARD,
  NAVIGATE_BOARD,
  NAVIGATE_CHAT,
  NAVIGATE_BUDDY,
  NAVIGATE_KNOWLEDGE_BASE,
  NAVIGATE_PM_DASHBOARD,
  NAVIGATE_SETTINGS,
  SWITCH_PROJECT_SHORTCUT,
  NEW_CONVERSATION_SHORTCUT,
  SIDEBAR_TOGGLE_SHORTCUT,
  FOCUS_COMPOSER,
  SHOW_SHORTCUTS,
  DISMISS,
];

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Keys whose `code` is not their character, mapped to what a person sees on the cap. */
const KEY_LABELS: Partial<Record<string, string>> = {
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  Backquote: "`",
  Escape: "Esc",
  Space: "Space",
};

/** One key of a chord, as it is printed: "H" for `KeyH`, "," for `Comma`, "?" for `?`. */
function shortcutKeyLabel(shortcut: ShortcutItem): string {
  if (shortcut.key !== undefined) return shortcut.key;

  const code = shortcut.code ?? "";
  if (KEY_LABELS[code] !== undefined) return KEY_LABELS[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);

  return code;
}

/**
 * The chord as a person reads it — "Alt + H", "⌘ + K", "?". One spelling for the hint on
 * a control, the help view and the handler's own definition, so they cannot drift.
 */
export function shortcutChord(shortcut: ShortcutItem): string {
  const parts: string[] = [];

  if (shortcut.ctrlOrMeta) parts.push(IS_MAC ? "⌘" : "Ctrl");
  if (shortcut.altKey) parts.push("Alt");
  if (shortcut.shiftKey) parts.push("Shift");
  parts.push(shortcutKeyLabel(shortcut));

  return parts.join(" + ");
}

/**
 * Whether this keypress is the shortcut — the only key-matching rule in the app.
 *
 * - Auto-repeat is refused: holding a navigation chord down should walk nowhere.
 * - AltGr is refused by refusing Ctrl+Alt. Windows reports AltGr as exactly that pair,
 *   so a bare `altKey` check fires on every `{`/`[`/`@` a German layout types with it.
 * - Text fields own their keys, except where a chord says otherwise (`allowInInput`).
 * - Modifiers must match exactly. Shift is the exception for character chords: producing
 *   `?` *requires* Shift on every layout that has it, so the character is the whole claim.
 */
export function isShortcutPress(event: KeyboardEvent, shortcut: ShortcutItem): boolean {
  if (event.repeat) return false;
  if (event.altKey && event.ctrlKey) return false;
  if (!shortcut.allowInInput && isTypingTarget(event.target)) return false;

  if ((shortcut.ctrlOrMeta === true) !== (event.ctrlKey || event.metaKey)) return false;
  if ((shortcut.altKey === true) !== event.altKey) return false;
  if (!shortcut.key && (shortcut.shiftKey === true) !== event.shiftKey) return false;

  if (shortcut.code !== undefined) return event.code === shortcut.code;
  if (shortcut.key !== undefined) return event.key === shortcut.key;

  return false;
}

/**
 * The chord for the destination a control leads to, or `undefined` for one without a
 * shortcut. The sidebar draws its hints through this, so an entry's hint and the global
 * listener read the same line of the registry.
 */
export function navigationShortcut(path: AppRoute): string | undefined {
  const shortcut = SHORTCUTS.find((item) => item.path === path);

  return shortcut ? shortcutChord(shortcut) : undefined;
}
