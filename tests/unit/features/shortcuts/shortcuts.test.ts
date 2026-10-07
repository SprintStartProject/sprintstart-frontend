import { describe, expect, it } from "vitest";
import {
  NEW_CONVERSATION_SHORTCUT,
  SHORTCUTS,
  SIDEBAR_TOGGLE_SHORTCUT,
  SWITCH_PROJECT_SHORTCUT,
  isShortcutPress,
  navigationShortcut,
  shortcutChord,
  type ShortcutItem,
} from "../../../../src/features/shortcuts/shortcuts";

/**
 * A real keydown, dispatched at an element so `event.target` is what a listener would see —
 * that is the field half of the typing guard, and a hand-built object would only test the
 * function's opinion of its own input.
 */
function pressFrom(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", init);
  target.dispatchEvent(event);
  return event;
}

function shortcutById(id: string): ShortcutItem {
  const item = SHORTCUTS.find((shortcut) => shortcut.id === id);
  if (!item) throw new Error(`No shortcut registered under "${id}"`);
  return item;
}

describe("the registered chords", () => {
  it("prints each chord the way a person reads it", () => {
    expect(navigationShortcut("/")).toBe("Alt + H");
    expect(navigationShortcut("/board")).toBe("Alt + B");
    expect(navigationShortcut("/buddy")).toBe("Alt + U");
    expect(navigationShortcut("/knowledge-base")).toBe("Alt + K");
    expect(navigationShortcut("/pm-dashboard")).toBe("Alt + P");
    // The comma is a key, not a word: "Alt + ," is what is printed on the cap.
    expect(navigationShortcut("/settings")).toBe("Alt + ,");
    expect(shortcutChord(SIDEBAR_TOGGLE_SHORTCUT)).toBe("Alt + S");
    expect(shortcutChord(NEW_CONVERSATION_SHORTCUT)).toBe("Alt + N");
  });

  it("prints the help and the platform chord as their own characters", () => {
    // "?" and "Esc" are not derivable from a `Key…` code; this pins the label map both ways.
    expect(shortcutChord(shortcutById("gen-shortcuts"))).toBe("?");
    expect(shortcutChord(shortcutById("gen-dismiss"))).toBe("Esc");
    // jsdom is not a Mac, so `ctrlOrMeta` renders as Ctrl; the ⌘ spelling is the same branch.
    expect(shortcutChord(SWITCH_PROJECT_SHORTCUT)).toBe("Ctrl + K");
  });

  it("gives every destination a chord and no two entries an id", () => {
    const ids = SHORTCUTS.map((shortcut) => shortcut.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(navigationShortcut("/settings")).toBeDefined();
  });

  it("describes every chord with a code, a key, or both — never neither", () => {
    // Neither would make a dead entry. Both is legitimate: the comma declares its character
    // and its physical key, because macOS rewrites the character under Option but not the code.
    for (const shortcut of SHORTCUTS) {
      const described = [shortcut.code !== undefined, shortcut.key !== undefined].filter(
        Boolean,
      ).length;

      expect(described, `${shortcut.id} needs a code or a key`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("isShortcutPress", () => {
  const dashboard = shortcutById("nav-home");
  const knowledgeBase = shortcutById("nav-kb");
  const help = shortcutById("gen-shortcuts");

  it("matches an Alt chord for its own key only", () => {
    expect(isShortcutPress(pressFrom(window, { code: "KeyH", altKey: true }), dashboard)).toBe(
      true,
    );
    expect(isShortcutPress(pressFrom(window, { code: "KeyB", altKey: true }), dashboard)).toBe(
      false,
    );
    expect(isShortcutPress(pressFrom(window, { code: "KeyH" }), dashboard)).toBe(false);
  });

  it("refuses Ctrl+Alt, which is how Windows reports AltGr", () => {
    // A German layout types `@` and `{` with AltGr; those chords must never navigate.
    const altGr = pressFrom(window, { code: "KeyH", altKey: true, ctrlKey: true });

    expect(isShortcutPress(altGr, dashboard)).toBe(false);
  });

  it("refuses a held key repeating and modifiers it was not told about", () => {
    expect(
      isShortcutPress(pressFrom(window, { code: "KeyH", altKey: true, repeat: true }), dashboard),
    ).toBe(false);
    expect(
      isShortcutPress(pressFrom(window, { code: "KeyH", altKey: true, shiftKey: true }), dashboard),
    ).toBe(false);
    expect(
      isShortcutPress(pressFrom(window, { code: "KeyH", altKey: true, metaKey: true }), dashboard),
    ).toBe(false);
  });

  it("keeps apart the two chords that share the K key", () => {
    const switcher = pressFrom(window, { code: "KeyK", ctrlKey: true });
    const altK = pressFrom(window, { code: "KeyK", altKey: true });

    expect(isShortcutPress(switcher, SWITCH_PROJECT_SHORTCUT)).toBe(true);
    expect(isShortcutPress(switcher, knowledgeBase)).toBe(false);
    expect(isShortcutPress(altK, SWITCH_PROJECT_SHORTCUT)).toBe(false);
    expect(isShortcutPress(altK, knowledgeBase)).toBe(true);
  });

  it("accepts Cmd for the chord that declares the platform modifier", () => {
    expect(
      isShortcutPress(pressFrom(window, { code: "KeyK", metaKey: true }), SWITCH_PROJECT_SHORTCUT),
    ).toBe(true);
    expect(isShortcutPress(pressFrom(window, { code: "KeyK" }), SWITCH_PROJECT_SHORTCUT)).toBe(
      false,
    );
  });

  it("takes either spelling of a character the platform rewrites under a modifier", () => {
    const settings = shortcutById("nav-settings");

    // Windows and Linux: the character. macOS: Option+, is a literal "≤", so the physical key
    // answers — both spellings are the one chord, and neither may drift from the label.
    expect(isShortcutPress(pressFrom(window, { key: ",", altKey: true }), settings)).toBe(true);
    expect(
      isShortcutPress(pressFrom(window, { key: "≤", code: "Comma", altKey: true }), settings),
    ).toBe(true);
    // A neighbour key on some layouts is not a spelling of it.
    expect(
      isShortcutPress(pressFrom(window, { key: ";", code: "Semicolon", altKey: true }), settings),
    ).toBe(false);
    // Shift has to match exactly for a chord with modifiers of its own — the shift exemption
    // belongs to bare character chords like `?`, not to `Alt+Shift+,`.
    expect(
      isShortcutPress(
        pressFrom(window, { key: ",", code: "Comma", altKey: true, shiftKey: true }),
        settings,
      ),
    ).toBe(false);
  });

  it("routes the switcher chord through a focused text field — it always did", () => {
    const input = document.createElement("input");
    document.body.append(input);

    try {
      // The chord predates the registry as a bare window listener with no typing guard;
      // `allowInInput` is what keeps Ctrl/Cmd+K from silently dying in any composer.
      expect(
        isShortcutPress(pressFrom(input, { code: "KeyK", ctrlKey: true }), SWITCH_PROJECT_SHORTCUT),
      ).toBe(true);
    } finally {
      input.remove();
    }
  });

  it("treats text entry as typing — a checkbox is focusable, not a keyboard owner", () => {
    function focusableInput(type: string): HTMLInputElement {
      const input = document.createElement("input");
      input.type = type;
      document.body.append(input);
      return input;
    }

    const board = shortcutById("nav-board");
    const text = focusableInput("text");
    const password = focusableInput("password");
    const number = focusableInput("number");
    const checkbox = focusableInput("checkbox");
    const radio = focusableInput("radio");
    const range = focusableInput("range");
    const chord = { code: "KeyB", altKey: true };

    try {
      // Typing goes on in the first three.
      for (const typing of [text, password, number]) {
        expect(isShortcutPress(pressFrom(typing, chord), board)).toBe(false);
      }

      // The rest merely happen to be inputs: focus parked on one of them — after a click on a
      // settings checkbox, say — must not silence the page's chords until focus moves on.
      for (const control of [checkbox, radio, range]) {
        expect(isShortcutPress(pressFrom(control, chord), board)).toBe(true);
      }
    } finally {
      for (const input of [text, password, number, checkbox, radio, range]) input.remove();
    }
  });

  it("answers the switcher chord by the character, so Dvorak keeps Ctrl+K", () => {
    // The pre-registry listener matched the produced character. Dvorak puts "k" on another
    // physical key, so a code-only chord would answer the wrong key and swallow that one; the
    // matcher takes either spelling, exactly as `Alt+,` does.
    const byCharacter = pressFrom(window, { key: "k", code: "KeyC", ctrlKey: true });
    const offChord = pressFrom(window, { key: "t", code: "KeyT", ctrlKey: true });

    expect(isShortcutPress(byCharacter, SWITCH_PROJECT_SHORTCUT)).toBe(true);
    expect(isShortcutPress(offChord, SWITCH_PROJECT_SHORTCUT)).toBe(false);
  });

  it("matches the produced character, whatever Shift the layout needed for it", () => {
    // US: Shift+/. German QWERTZ: Shift+ß. Neither is `code: "Slash"`, and both are "?".
    expect(isShortcutPress(pressFrom(window, { key: "?", shiftKey: true }), help)).toBe(true);
    expect(isShortcutPress(pressFrom(window, { key: "?" }), help)).toBe(true);
    expect(isShortcutPress(pressFrom(window, { key: "?", ctrlKey: true }), help)).toBe(false);
    expect(isShortcutPress(pressFrom(window, { key: "/" }), help)).toBe(false);
  });

  it("leaves a text field's keys to the text field", () => {
    const input = document.createElement("input");
    document.body.append(input);

    try {
      const altB = { code: "KeyB", altKey: true };

      expect(isShortcutPress(pressFrom(input, altB), shortcutById("nav-board"))).toBe(false);
      expect(isShortcutPress(pressFrom(window, altB), shortcutById("nav-board"))).toBe(true);
      expect(isShortcutPress(pressFrom(input, { key: "?", shiftKey: true }), help)).toBe(false);
      // …except the one chord that explicitly asks for the composer: a fresh conversation is
      // most wanted halfway through typing into the wrong one.
      expect(
        isShortcutPress(
          pressFrom(input, { code: "KeyN", altKey: true }),
          NEW_CONVERSATION_SHORTCUT,
        ),
      ).toBe(true);
    } finally {
      input.remove();
    }
  });
});
