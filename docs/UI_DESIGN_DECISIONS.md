# UI Design Decisions

[FRONTEND_CODING_STANDARDS.md](./FRONTEND_CODING_STANDARDS.md) §4 to §6 say _what_ to
do with buttons, fields, badges, dialogs, scales and motion. This document says
_why_: what was wrong before, what was decided, and what was deliberately left
alone. It started as the UI consistency audit of 2026-08-09 and the migrations that
followed it.

Numbers in the "Finding" paragraphs are from that audit and describe the state
before the fix. They are kept because they show the size of the problem, not as a
current count.

**Keeping it current:** when a rule in the coding standards changes, update the
matching section here in the same PR. When an open item is resolved, remove it from
the list below.

> **Related docs**
>
> - [FRONTEND_CODING_STANDARDS.md](./FRONTEND_CODING_STANDARDS.md) — the rules this document explains.
> - [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) — how the design system and animation tokens are built.

---

## Open items

Status as of 2026-10-04.

- **Two pagination components.** `ui/Pagination.tsx` and
  `features/admin/components/AdminPagination.tsx` do the same job. Both use `Button` by now,
  but one of them should go.
- **Clickable cards.** Only 5 files use `components/common/ClickableCard`; about 10
  places still build their own hover (`hover:scale-[1.01]`, `[1.02]`,
  `-translate-y-0.5`). Same problem as the buttons had, one level up.
- **`AutoResizeTextarea`.** It was meant to be deleted after §2a, but three
  components under `features/knowledge-request/` use it again. Either move them to
  `Textarea` and delete it, or decide to keep it and say why.
- **`Modal` names two elements "Close dialog".** The backdrop button and the header
  close button share one `aria-label`, so a screen reader hears it twice. The fix is
  easy (hide the backdrop with `aria-hidden`; Escape already covers keyboard users),
  but it changes the semantics of every dialog, so it needs a decision rather than a
  drive-by edit.

---

## 1. One `Button` component

**Finding.** 246 `<button>` and 28 `<motion.button>` across 92 files, with no shared
component. Every caller had invented its own styling: the 60 primary buttons
(`bg-app-brand`) came in 28 different style signatures, and the plain "Cancel"
button in 6. 196 of the 246 buttons had no focus ring at all; where there was one, it
came in 5 versions (`ring-app-focus`, `ring-app-brand`, `ring-app-brand/50`,
`ring-app-brand-glow`, some with `ring-offset`, some on `focus:` instead of
`focus-visible:`). About 59 buttons were below the 44px touch target.

**Decision.** [`ui/Button`](../src/components/ui/Button.tsx) with a `variant` and a
`size`, plus `iconOnly`, `fullWidth`, `loading`, `icon` and `trailingIcon`. The focus
ring and the `disabled` and `aria-busy` behaviour are built in and not optional.
`SaveButton`, `AlertDialog` and `Modal` build on `Button` instead of bringing their
own button styles, so the primitives cannot drift apart again.

**Deliberately not `Button`:**

- **Clickable cards and list rows.** They are navigation targets, not actions, and
  belong on `ClickableCard` (see open items).
- **Toggles, switches, filter chips.** `aria-pressed` / `role="switch"` semantics
  with their own on/off state.
- **Menu items and popup triggers.** `role="menuitem"` and `aria-haspopup` are a
  different interaction model.
- **Card overlays.** An invisible `absolute inset-0` click area over a card.
- **Chat micro-affordances, games, Storybook stories.** 11px inline buttons in the
  chat, game boards (2048, Dino, Space Invaders), and story files.

### 1a. Hover and press feedback

**Finding.** Two effects were applied by hand, with no rule: _magnifying_
(`buttonHoverMotion`, scale 1.03 on hover) at 18 places, and _glowing_ (an arbitrary
`hover:shadow-[0_10px_26px_-10px_var(--color-app-brand)]`) at 7 places, with no dark
mode value. The most visible result: the refresh icon button in `PageHeader` reacted
to hover on Data Ingestion and Knowledge Base, but not on Onboarding, Admin or
Connectors. Primary buttons were just as random: "Add sources" glowed and magnified,
"Add Token" did neither.

**First decision (2026-08-09).** Magnify every button, by having `Button` render a
`motion.button` with `buttonHoverMotion`, and make it impossible to switch off,
because opt-in was exactly what had caused the mess.

**Revised (2026-08-14).** Buttons no longer grow on hover. A control sitting flush
against the right end of a toolbar has nothing to grow into: the extra sliver landed
outside the surrounding panel and was visibly cut off (on the admin filters and on
the access view's add button). `buttonHoverMotion` now only gives press feedback
(`whileTap` scale 0.97) on a spring damped enough not to overshoot, and hover
feedback is carried by the `hover:` colours every variant already has, which no
layout can clip. What stayed from the first decision: the feedback is built into
`Button`, the same for every variant and size, switched off for `disabled` and
`loading`, and dropped under `prefers-reduced-motion`.

**The glow belongs to `primary` alone.** It marks the one action a screen wants; if
every button glowed, the cue would carry no information. It is now the token
`--shadow-brand-lift` in `index.css` (utility `shadow-app-brand-lift`) with its own
dark mode value: on a near-black background a shadow is invisible, so there a brand
bloom carries it.

**Outside `Button`,** `buttonHoverMotion` is used by the popup triggers of
`FilterSelect`, `DropdownSelect` and `MultiSelectFilter`, so they feel the same as a
button without being one. A few `motion.button`s keep their own gesture because they
are not action buttons, e.g. the sidebar navigation, `ProjectSwitcher` and the
QuickChat suggestion chips.

---

## 2. One field style for `Input`, `Select` and `Textarea`

**Finding.** 62 text fields (45 `<input>`, 9 `<select>`, 8 `<textarea>`), the same
pattern as the buttons on a smaller scale: four heights (27 fields with none), focus
in 10 variations, no placeholder colour on 34 of 62, no `disabled` treatment on 34 of
62, and `<select>` and `<textarea>` each following different rules from `<input>`.

The most important finding was not a visual one. The most common focus ring was
`ring-app-brand-glow`, a blue at **10% opacity**, practically invisible. And the
codebase had 65 `htmlFor` attributes but only **3 files with `aria-describedby`**:
error messages sat visually next to their field and did not exist for screen
readers.

**Decision.**

- [`ui/fieldStyles.ts`](../src/components/ui/fieldStyles.ts) is the one source for
  border, radius, height, placeholder, `disabled` and focus. The ring is
  `--app-focus`, the same token as the button's. It applies on `:focus`, not
  `:focus-visible`: a text field has to show focus after a click too, the caret alone
  is too small to notice.
- [`ui/Input`](../src/components/ui/Input.tsx),
  [`ui/Textarea`](../src/components/ui/Textarea.tsx) and
  [`ui/Select`](../src/components/ui/Select.tsx) share their `size` scale with
  `Button`, and offer `icon` / `trailing` slots instead of hand-positioned absolute
  elements.
- [`ui/Field`](../src/components/ui/Field.tsx) treats label, hint and error as one
  unit. It generates the id, binds the label, collects hint and error into
  `aria-describedby` and sets `aria-invalid`. The wiring runs through
  [`fieldContext`](../src/components/ui/fieldContext.ts), so a caller _cannot_
  forget it.

**Deliberately left as is:** `FilterSelect` and `Select` exist side by side.
`FilterSelect` rebuilds the popup in React and can look like an app-style dropdown;
`Select` leaves the popup to the operating system and is accessible and
touch-friendly for free. In practice `Select` is used in forms and editors and
`FilterSelect` in filter bars and toolbars; the TSDoc of `Select` says the same.

**Deliberately hand-written:** composite controls where several elements share one
border, such as the chat composer (including its date filter fields) and the
borderless QuickChat field.

### 2a. Multi-line fields grow with their content

**Finding (in review, not in the first audit).** There were two multi-line
components with different _behaviour_: a hand-written `AutoResizeTextarea` that grew
while typing (used only in one dialog), and `Textarea` with a fixed height and a drag
handle (used everywhere else). A third implementation lived inline in the chat
composer. As long as the three also looked different, nobody noticed. Once they
shared border, radius and focus, it became a bug: the same look, different behaviour
depending on the screen.

**Decision.** Growing is the default of `Textarea`, bounded by `minRows` / `maxRows`;
beyond that it scrolls internally, so a pasted block of text cannot push a dialog's
footer off screen. The height logic lives in
[`useAutoResize`](../src/components/ui/useAutoResize.ts), so the chat composer, which
sits borderless in its own box and therefore cannot be a `Textarea`, uses it too.

**Found and fixed on the way:** the chat composer's inline version only set the
height while typing. After sending a multi-line message, `value` was cleared from
outside but the height stayed, so the input stayed inflated. The hook re-measures on
outside changes as well.

---

## 3. `Badge`: tokens only

**Finding.** [`ui/Badge`](../src/components/ui/Badge.tsx) used raw Tailwind palettes
with `dark:` prefixes in 5 of its 10 variants (`purple`, `pink`, `yellow`, `navy`,
`orange`). That was **30 of only 38 raw colour uses in the whole project**; the rest
of the codebase stuck to the tokens in `src/styles/index.css`. On top of that there
were 37 hand-built badge spans, while `Badge` was imported in only 9 files.

**What the analysis showed.** `pink`, `yellow` and `navy` were completely unused,
neither statically nor through the functions that return a `BadgeVariant`
dynamically. `purple` and `orange` were used exactly once, for the onboarding status
in `UserStatusSection` ("Done" / "Pending"). That changed the task from "tokenize five
colour sets" to:

- **Delete `pink`, `yellow` and `navy`.** Dead code, and the standards say not to
  build abstractions in advance.
- **Move `orange` to the existing `--orange-*` tokens.** They had been in
  `index.css` all along; `Badge` just never used them.
- **Add `--purple-*` tokens** for light and dark. The reason is noted at the token:
  "Onboarding: Done" must not look like "Account: Active" right above it. Both green
  would read as the same statement, and they are not.
- **Add `size="sm"`,** so a badge in a dense row is not the size of a standalone
  page element.

**Result then:** raw Tailwind colours went from 38 to 0. The remaining `dark:`
prefixes are in Storybook files that toggle `.dark` for the preview, which is what
they are for. Inline badges went from 37 to 11, and those are deliberate: the HUD
chips of the games, suggestion chips that are really buttons, and a few card
markers. A `Badge` is a `<span>`; a chip that gets clicked does not belong there.

---

## 4. One `Modal`, and a shared scroll lock

**Finding.** [`ui/Modal`](../src/components/ui/Modal.tsx) was used in 11 files, next to
10 hand-built `fixed inset-0` overlays. They fell into three groups, and only one of
them was actually wrong:

- **Real dialogs.** `UploadArtifactModal` had rebuilt focus trap, Escape, focus
  restore and `aria-modal` by hand, about 100 lines that had to be kept in sync with
  the original. Migrated to `Modal`.
- **Drawer backdrops** (`SideBar`, `AdminPage`). Not dialogs, but the dimmed area
  behind a drawer. Nothing to do.
- **Full-screen scenes** (the three games, the four Moments overlays). Deliberately
  not `Modal`: in a game the keyboard belongs to the game, and `Modal`'s focus trap
  would fight it for the arrow keys.

**The real finding was a different one.** `document.body.style` appeared nowhere in
the project: **nobody locked background scrolling**, `Modal` included. With any dialog
open, the page underneath kept scrolling; on a long admin table you lose exactly the
row you opened the dialog from.

**Decision.** [`useScrollLock`](../src/components/ui/useScrollLock.ts) locks the page,
adds the width of the vanished scrollbar back as padding (otherwise every fixed header
jumps sideways when a dialog opens) and counts locks, so a dialog opened from inside
another does not release the page too early. `Modal` uses it, and so do the
full-screen scenes: a backdrop over a page that scrolls underneath is a bug whatever
built it.

**A follow-up found while checking.** The first version only locked `document.body`,
and so missed the access management page, the longest list in the app. It scrolls
in its own container (`h-dvh overflow-y-scroll`, needed for the swipe gesture), which
does not care about `overflow: hidden` on the body. Instead of passing a ref through
every dialog layer, such a page marks its container with `data-scroll-container` and
the hook finds it. The next page that handles its own scrolling needs exactly that
one attribute.

`Modal` also got a `testId` that covers its close button too (`${testId}-close`), so
migrated dialogs kept their test anchors.

---

## 5. Radius, shadow and heading scales

**Finding.** There was no written rule for which value applies when, but looked at
by context the picture differed a lot:

- **Radius was mostly consistent already.** Cards (`p-4` to `p-6`) used
  `rounded-2xl` 51 times, small cards `rounded-xl` 11 times. The rule existed in
  practice, with 32 outliers.
- **Shadow too,** with 41 uses and three recognisable roles: `sm` for a card at
  rest, `hover:lg` on hover, `2xl` for a dialog.
- **Headings were the real problem.** `<h2>` ranged from `text-sm` to `text-4xl`,
  because two roles were mixed up: hero headings (login, dashboard, onboarding) and
  ordinary section titles. Semantic level and visual size had come apart.

**Decision.** Four type rungs, one of them a dedicated hero rung so the big moments
stay big; every card on `rounded-2xl`. The scales are in the coding standards §4.

**Deliberately outside the scale:** the `404` on the error page (`text-5xl`) and the
dialog chrome in `Modal` / `SidePanel`, which brings its own title size.

---

## 6. `Spinner` and `EmptyState`

**Finding.** 47 hand-written `animate-spin` uses and 26 blocks with a dashed border.
Sorted by context: 13 full-area loading states, 8 icons that spin while refreshing
(not spinners, but a refresh symbol), 24 other inline cases, and 26 empty states.
The empty states came in two forms, a rich one (icon, title, text, sometimes an
action) and a terse one (one sentence in a dashed box), with padding anywhere from
`px-4 py-3` to `p-8`.

**The real finding was, again, a different one.** None of the 47 spinners announced
anything to a screen reader. Anyone who could not see the page got silence while it
waited.

**Decision.**

- [`ui/Spinner`](../src/components/ui/Spinner.tsx): three sizes along the button
  scale, `role="status"` and a label. `silent` for when the surroundings already
  announce the wait, because two announcements for one wait are worse than none.
- [`ui/EmptyState`](../src/components/ui/EmptyState.tsx): icon, title, text and an
  optional action; without a title it becomes the terse one-sentence form. The `icon`
  slot deliberately takes a `Spinner` too: **an empty list and a list that has not
  arrived yet should differ in their words, not in their shape**, or the page visibly
  rearranges itself when the answer lands.
- `ConnectorsLoadingState` and `DataIngestionLoadingState` no longer build their own
  circle spinner from `border-t-transparent`.

The refresh icons stay as they are: they rotate an existing symbol and are not a
spinner. Inline waiting inside a button is `Button`'s `loading` prop.

---

## 7. Prettier is enforced

**Finding.** Prettier was a dependency, but there was **no `.prettierrc`**.
`eslint.config.js` only includes `eslint-config-prettier`, which switches rules _off_
rather than formatting anything. The result: 131 files indented with 4 spaces, 52
with 2, sometimes within the same folder (`ui/Badge.tsx` 4, `ui/SaveButton.tsx` 2).
The order of Tailwind classes drifted as well.

**Decision.**

- [`.prettierrc`](../.prettierrc): 2 spaces, double quotes, `printWidth: 100`, plus
  `prettier-plugin-tailwindcss` to sort classes. Its
  `"tailwindStylesheet": "./src/styles/index.css"` is **not optional**: Tailwind v4
  has no `tailwind.config.js`, so without it the plugin cannot find our `app-*`
  utilities and sorts them to the end.
- [`.prettierignore`](../.prettierignore) keeps build output and `package-lock.json`
  out, and more importantly the **Keycloakify theme**. `keycloakify sync-extensions`
  rewrites almost everything under `src/keycloak-theme/` on every `npm install`, so
  formatting there would not survive the next install. The whole tree is ignored and
  only the files we own are included again. `public/keycloak-theme` and
  `public/keycloakify-dev-resources` stay out for the same reason: vendored, partly
  minified assets.
- `npm run format` writes, `npm run format:check` checks. The check is part of
  `npm run try` and of CI, so unformatted code cannot pass the Definition of Done.
- One reformat of the **whole repo** (`25f0bb6d`), not just `src/` and `tests/`,
  because `format:check` checks everything. It only moved line breaks and quotes and
  sorted classes; the single change in content was a pair of parentheses around a
  multi-line `return` in `public/easter-eggs/2048.html`. The commit is listed in
  [`.git-blame-ignore-revs`](../.git-blame-ignore-revs), together with the later
  formatting-only fixes, so `git blame` skips them once the file is enabled per clone
  (see the coding standards §10).

---

## Checked and found fine (2026-08-09)

So nobody goes looking for work where there is none:

- The **colour token system** in `src/styles/index.css` is clean and used throughout.
  Apart from `Badge.tsx` (§3) there were practically no raw Tailwind colours and
  almost no `dark:` prefixes.
- The **animation tokens** in `src/styles/tokens.ts` are centralised and documented.
- **Icon-only buttons** all had an `aria-label`: checked, 0 violations.
