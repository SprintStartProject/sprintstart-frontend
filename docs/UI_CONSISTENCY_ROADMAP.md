# UI Consistency Roadmap

Bestandsaufnahme vom 2026-08-09 über `sprintstart-frontend/src`
(ohne `src/keycloak-theme`, das dem Keycloakify-Theme folgt und eigenen
Regeln unterliegt). Die Zahlen sind der Ausgangszustand und dienen als
Vergleichsmaßstab, nicht als Zielwert.

Die Punkte sind nach Hebelwirkung sortiert. Jeder ist für sich abschließbar.

---

## 1. Button-Vereinheitlichung — **erledigt (bis auf die Rest-Liste unten)**

**Befund.** 246 `<button>` plus 28 `<motion.button>`, verteilt auf 92 Dateien,
ohne gemeinsame Komponente. Jeder Aufrufer hat sein eigenes Styling erfunden:

| Eigenschaft | Ausgangsverteilung |
| --- | --- |
| `rounded` | `xl` 121 · `lg` 49 · keins 39 · `full` 12 · `md` 11 · `2xl` 11 · `rounded` 2 |
| Höhe | `h-11` 37 · `h-9` 15 · `h-8` 6 · `h-10` 4 · Rest über `py-*` |
| Padding | `px-2` … `px-8`, 13 Kombinationen |
| `font-*` | `medium` 117 · `semibold` 27 · `bold` 1 · keins 101 |
| `text-*` | `sm` 112 · `xs` 41 · `base` 1 · keins 92 |
| `transition` | `-colors` 142 · `-all` 38 · `transition` 26 · keins 34 |
| `disabled:` | keins 138 · `opacity-60` 61 · `opacity-50` 33 · `opacity-40` 4 |

Allein die 60 Primary-Buttons (`bg-app-brand`) hatten **28 verschiedene
Style-Signaturen**; der schlichte "Cancel"-Button existierte in 6 Varianten.

**Zusätzlich:** 196 von 246 Buttons hatten *keinen* Focus-Ring — ein Verstoß
gegen [`FRONTEND_CODING_STANDARDS.md`](./FRONTEND_CODING_STANDARDS.md) §5
("keep visible focus via `focus-visible:ring-app-focus`"). Wo einer vorhanden
war, in 5 unterschiedlichen Ausführungen (`ring-app-focus`, `ring-app-brand`,
`ring-app-brand/50`, `ring-app-brand-glow`, teils mit `ring-offset`, teils
`focus:` statt `focus-visible:`). Rund 59 Buttons lagen unter dem 44px
Touch-Target.

**Lösung.** [`src/components/ui/Button.tsx`](../src/components/ui/Button.tsx)
mit `variant` (`primary` | `secondary` | `ghost` | `danger` | `dangerSoft` |
`dangerGhost`) × `size` (`sm` | `md` | `lg`), plus `iconOnly`, `fullWidth`,
`loading`, `icon`, `trailingIcon`. Focus-Ring, `disabled`- und
`aria-busy`-Verhalten sind eingebaut und nicht mehr optional.

`SaveButton`, `AlertDialog` und `Modal` bauen darauf auf, statt eigene
Button-Styles mitzubringen — damit können die Primitives nicht mehr
auseinanderdriften. Die Regel steht in
[`FRONTEND_CODING_STANDARDS.md`](./FRONTEND_CODING_STANDARDS.md) §4, damit sie
im Review greift.

**Stand nach der Migration:** 246 → 112 rohe `<button>`, 139 `<Button>` in 53
Dateien. Alle Primary-, Secondary- und Danger-Aktionen sind migriert.

**Was bewusst roh geblieben ist** (kein Handlungsbedarf, aber begründet):

| Kategorie | Anzahl | Warum |
| --- | ---: | --- |
| Klickbare Karten und Listenzeilen | 20 | Sind Navigationsziele, keine Aktionen. Gehören auf `ClickableCard`, nicht auf `Button` — siehe Folgepunkt unten. |
| Toggles, Switches, Filter-Chips | 9 | `aria-pressed` / `role="switch"`-Semantik mit eigenem An/Aus-Zustand. |
| Menü-Items, Combobox-Trigger | 5 | `role="menuitem"` bzw. `aria-haspopup="listbox"` — anderes Interaktionsmodell. |
| Karten-Overlay (`absolute inset-0`) | 1 | Unsichtbare Klickfläche über einer Card. |
| Chat-Mikro-Affordances, Spiele, Stories | 77 | 11px-Inline-Buttons im Chat, Spielfelder (2048, Dino, Space Invaders) und Storybook-Dateien. |

### 1a. Hover-Verhalten — **erledigt**

**Befund.** Zwei Effekte wurden von Hand verteilt, ohne Regel:

- **Magnifizieren** (`buttonHoverMotion`, Scale 1.03 / Tap 0.97) an 18 Stellen
  als `<motion.button>`.
- **Aufleuchten** (`hover:shadow-[0_10px_26px_-10px_var(--color-app-brand)]`) an
  7 Stellen — als Arbitrary Value, also ohne Dark-Mode-Anpassung.

Sichtbarste Folge: Der Refresh-Icon-Button im `PageHeader` von Data Ingestion
und Knowledge Base reagierte auf Hover, derselbe Button im Onboarding-, Admin-
und Connectors-Header nicht. Bei den Primary-Buttons genauso zufällig — „Add
sources" leuchtete und magnifizierte, „Add Token" tat beides nicht.

**Entscheidung und Lösung.**

- Magnifizieren gilt jetzt für **alle** Buttons: `Button` rendert intern ein
  `motion.button` mit `buttonHoverMotion`. Bei `disabled`/`loading` greift
  `buttonHoverMotionDisabled`, bei `prefers-reduced-motion` entfällt die
  Bewegung. Nicht abschaltbar — genau das war die Fehlerquelle.
- Der Glow gilt **nur für `primary`** und ist jetzt der Token
  `--shadow-brand-lift` in `index.css`, mit eigenem Wert für Dark Mode (auf
  fast schwarzem Grund ist ein Schatten sonst unsichtbar, dort trägt ein
  Brand-Bloom).
- 16 der 18 `motion.button` sind auf `Button` migriert. Die zwei verbliebenen
  sind kein `Button`: der `role="combobox"`-Trigger in `FilterSelect` und die
  `aria-pressed`-Severity-Chips in `KnowledgeGapsPage`. Beide behalten
  `buttonHoverMotion`, damit sie sich identisch anfühlen.

Vier weitere `motion.button` mit **eigener** Gestik bleiben bewusst, weil sie
keine Buttons sind: Sidebar-Nav und `ProjectSwitcher` (Scale 1.02),
QuickChat-Vorschlagschips (`y: -2`), `TaskCheckItem` (`x: 3`). Die zwei
„Back"-Links, die früher seitlich wackelten (`x: -3`), sind jetzt normale
`ghost`-Buttons und magnifizieren wie alles andere.

Regel steht in [`FRONTEND_CODING_STANDARDS.md`](./FRONTEND_CODING_STANDARDS.md) §6.

---

**Verbleibende Folgearbeit für diesen Punkt:**

1. **Zwei Pagination-Komponenten** (`ui/Pagination.tsx` und
   `admin/AdminPagination.tsx`) tun dasselbe. Beide nutzen jetzt `Button`, aber
   eine davon sollte verschwinden.
2. **Klickbare Karten** auf `components/common/ClickableCard` vereinheitlichen —
   aktuell baut jede Stelle ihren eigenen Hover (`hover:scale-[1.01]` vs.
   `[1.02]` vs. `-translate-y-0.5`). Dieselbe Krankheit wie bei den Buttons,
   eine Ebene höher.

**Nebenbefund:** zwei nicht existierende Tokens gefunden und beim Migrieren
entfernt — `hover:bg-app-background` (`ui/Pagination.tsx`) und
`hover:bg-app-hover` (`pages/NotFoundPage.tsx`). Beide waren wirkungslos, der
Hover-Effekt fehlte dort schlicht.

---

## 2. Input / Select / Textarea vereinheitlichen — **erledigt**

**Befund.** 62 Textfelder (45 `<input>`, 9 `<select>`, 8 `<textarea>`) —
dasselbe Muster wie bei den Buttons, nur kleiner:

- Höhe: `h-11` (20) · `h-10` (8) · `h-9` (2) · 27 ganz ohne feste Höhe
- Focus in **10 Ausprägungen**, u. a. `ring-2 ring-app-brand-glow` (20) ·
  nur `focus:border-app-brand` ohne Ring (14) · `focus:ring-1` (3) · gar
  nichts (9)
- Placeholder-Farbe bei **34 von 62** überhaupt nicht gesetzt
- `disabled`-Behandlung bei 34 von 62 nicht gesetzt
- `<select>` und `<textarea>` folgten jeweils anderen Regeln als `<input>`

**Der wichtigste Befund war aber kein optischer.** Der häufigste Focus-Ring war
`ring-app-brand-glow` — ein Blau mit **10 % Deckkraft**, praktisch unsichtbar.
Und die Codebase hatte 65 `htmlFor`-Attribute, aber nur **3 Dateien mit
`aria-describedby`**: Fehlermeldungen standen visuell neben ihrem Feld und
waren für Screenreader nicht vorhanden.

**Lösung.**

- [`ui/fieldStyles.ts`](../src/components/ui/fieldStyles.ts) — eine Quelle für
  Rahmen, Radius, Höhe, Placeholder, `disabled` und Focus. Der Ring ist jetzt
  `--app-focus`, derselbe Token wie beim Button und der, den §5 der Standards
  ohnehin vorschreibt. Auf `:focus`, nicht `:focus-visible`: ein Textfeld muss
  seinen Fokus auch beim Klick zeigen, der Cursor allein ist zu klein.
- [`ui/Input`](../src/components/ui/Input.tsx),
  [`ui/Textarea`](../src/components/ui/Textarea.tsx),
  [`ui/Select`](../src/components/ui/Select.tsx) — `size` teilt sich die Skala
  mit `Button`, dazu `icon`/`trailing`-Slots statt handgesetzter Absolut-Positionen.
- [`ui/Field`](../src/components/ui/Field.tsx) — Label, Hint und Fehler als eine
  Einheit. Erzeugt die id, bindet das Label, sammelt Hint und Fehler in
  `aria-describedby` und setzt `aria-invalid`; die Verdrahtung läuft über
  [`fieldContext`](../src/components/ui/fieldContext.ts), damit der Aufrufer sie
  nicht vergessen *kann*.
### 2a. Mehrzeilen-Verhalten — **erledigt**

**Befund (im Review aufgefallen, nicht in der ersten Analyse).** Es gab zwei
Mehrzeilen-Komponenten mit unterschiedlichem *Verhalten*: ein handgeschriebenes
`AutoResizeTextarea`, das beim Tippen mitwuchs (nur im Add-Custom-Step-Dialog),
und `Textarea` mit fester Höhe und Ziehgriff (überall sonst). Dazu eine
**dritte** Implementierung inline im Chat-Composer.

Solange die drei auch unterschiedlich aussahen, fiel das kaum auf. Nachdem sie
sich Rahmen, Radius und Focus teilten, wurde daraus ein Bug: gleiches Aussehen,
unterschiedliches Verhalten je nach Bildschirm.

**Lösung.** Mitwachsen ist jetzt das Standardverhalten von `Textarea`, begrenzt
durch `minRows`/`maxRows` — danach wird intern gescrollt, damit ein
eingefügter Textblock keinen Dialog-Footer aus dem Bild schiebt. Die Höhenlogik
liegt in [`useAutoResize`](../src/components/ui/useAutoResize.ts), damit auch
der Chat-Composer sie nutzen kann, der randlos in seiner eigenen Box sitzt und
deshalb kein `Textarea` sein kann.

**Dabei gefunden und behoben:** Die Inline-Variante im Chat-Composer setzte die
Höhe nur beim Tippen. Nach dem Absenden einer mehrzeiligen Nachricht wurde
`value` von außen geleert, die Höhe blieb aber stehen — das Eingabefeld blieb
dauerhaft aufgebläht. Der Hook misst auch bei Änderungen von außen neu.

**Zu löschen:** `src/components/ui/AutoResizeTextarea.tsx` wird nicht mehr
importiert und kann weg (die Sandbox darf keine Dateien löschen).

**Stand:** 62 → 16 rohe Textfelder, davon 6 in den ui-Komponenten selbst.
Bleiben 10 bewusste Ausnahmen: zusammengesetzte Controls, bei denen mehrere
Elemente sich einen Rahmen teilen (die „Every _n_ minutes"-Zeile, der
Chat-Composer, das randlose QuickChat-Feld, die Datumsfelder im Chat-Filter),
plus die Task-Titel-Zeile in `AddCustomStepModal`. Regel steht in
[`FRONTEND_CODING_STANDARDS.md`](./FRONTEND_CODING_STANDARDS.md) §4.

**Offen geblieben:** `FilterSelect` und das neue `Select` existieren
nebeneinander. Das ist vertretbar — `FilterSelect` baut das Popup in React nach
und kann dadurch aussehen wie ein Dropdown im App-Stil, `Select` überlässt es
dem Betriebssystem und ist dafür barrierefrei und mobiltauglich ohne Zutun.
Wer welches nimmt, steht im TSDoc von `Select`.

---

## 3. Badge: Token-System reparieren und Komponente durchsetzen — **erledigt**

**Befund.** [`ui/Badge.tsx`](../src/components/ui/Badge.tsx) nutzte in 5 von 10
Varianten (`purple`, `pink`, `yellow`, `navy`, `orange`) rohe
Tailwind-Paletten mit `dark:`-Prefixes statt CSS-Tokens. Das waren **30 der
insgesamt nur 38 rohen Farbnutzungen im gesamten Projekt** — der Rest der
Codebase hält sich vorbildlich an die Tokens aus `src/styles/index.css`.

Dazu 37 inline nachgebaute Badge-Spans, während `Badge` nur in 9 Dateien
importiert wurde.

**Was die Analyse ergeben hat.** `pink`, `yellow` und `navy` waren
**vollständig unbenutzt** — weder statisch noch über die beiden Funktionen, die
dynamisch eine `BadgeVariant` liefern (`getPermissionGroupVariant`,
`getSourceStatusVariant` geben nur `success`, `warning`, `danger`, `neutral`,
`brand` zurück). `purple` und `orange` gab es genau einmal: der
Onboarding-Status in `UserStatusSection` („Done" / „Pending").

Das änderte die Aufgabe. Statt fünf Farbsätze zu tokenisieren:

- **`pink`, `yellow`, `navy` gelöscht.** Toter Code, und Standards §1 sagt
  ausdrücklich, keine Abstraktionen auf Vorrat zu bauen.
- **`orange` auf die bestehenden `--orange-*`-Tokens umgestellt.** Die gab es
  längst in `index.css` — `Badge` hatte sie nur nie benutzt.
- **`--purple-*` neu angelegt** (hell und dunkel), nach demselben Muster. Die
  Begründung steht am Token: „Onboarding: Done" darf nicht wie „Account: Active"
  aussehen, das direkt darüber steht — beides grün liest sich als dieselbe
  Aussage, ist es aber nicht.
- **`size="sm"` ergänzt**, damit ein Badge in einer dichten Zeile nicht die
  Größe eines eigenständigen Seitenelements hat.

**Stand:** rohe Tailwind-Farben **38 → 0**. `dark:`-Prefixes 38 → 23, und die
verbleibenden stecken alle in Storybook-Dateien, die die `.dark`-Klasse zur
Vorschau umschalten — genau wofür sie da sind. Inline-Badges 37 → 11.

Die 11 verbliebenen sind begründet: die HUD-Chips der beiden Spiele, zwei
Vorschlags-Chips, die in Wahrheit Buttons sind (Chat-Leerzustand, QuickChat),
und einige Karten-interne Marker. Ein `Badge` ist ein `<span>`; wo ein Chip
geklickt wird, gehört er nicht dorthin.

**Nebenbefund:** Eine letzte rohe Farbe steckte gar nicht im Badge, sondern als
`hover:text-red-500` an einem Icon-Button in `TeamMemberDetailPage` — jetzt
`Button variant="ghost"` mit `hover:text-app-danger-text`.

Regel steht in [`FRONTEND_CODING_STANDARDS.md`](./FRONTEND_CODING_STANDARDS.md) §4.

---

## 4. Modal: eine Implementierung statt neun — **erledigt**

**Befund.** [`ui/Modal.tsx`](../src/components/ui/Modal.tsx) wurde in 11 Dateien
genutzt, daneben gab es 10 eigene `fixed inset-0`-Overlays.

Beim Durchsehen zerfielen die in drei Gruppen — und nur eine davon war
tatsächlich ein Fehler:

| | | |
| --- | --- | --- |
| **Echte Dialoge** | `UploadArtifactModal` | Hatte Focus-Trap, Escape, Focus-Rückgabe und `aria-modal` — alles von Hand nachgebaut, rund 100 Zeilen, die mit dem Original von Hand synchron gehalten werden mussten. → auf `Modal` migriert. |
| **Drawer-Backdrops** | `SideBar`, `AdminPage` | Kein Dialog, sondern die abdunkelnde Fläche hinter einer Schublade. Kein Handlungsbedarf. |
| **Vollbild-Inszenierungen** | die 3 Spiele, die 4 Moments-Overlays | Bewusst kein `Modal`: bei den Spielen gehört die Tastatur dem Spiel, und Modals Focus-Trap würde sich mit ihm um die Pfeiltasten streiten. Bleiben, sind jetzt im Code als Ausnahme begründet. |

**Der eigentliche Fund war ein anderer.** `document.body.style` kam im gesamten
Projekt **kein einziges Mal** vor: **niemand sperrte das Hintergrund-Scrollen**,
`Modal` eingeschlossen. Bei jedem offenen Dialog scrollte die Seite darunter
weiter — auf einer langen Admin-Tabelle verliert man damit genau die Zeile, aus
der man den Dialog geöffnet hat.

**Lösung.** [`useScrollLock`](../src/components/ui/useScrollLock.ts): sperrt den
Body, gibt die Breite der verschwundenen Scrollbar als Padding zurück (sonst
springt jeder fixierte Header seitwärts, sobald ein Dialog aufgeht) und zählt
die Sperren, damit ein Dialog im Dialog die Seite nicht vorzeitig freigibt.
`Modal` nutzt ihn, die sieben Ausnahmen ebenfalls — ein Backdrop über einer
scrollenden Seite ist unabhängig von der Bauart ein Fehler.

**Und ein Nachtrag, der beim Prüfen auffiel.** Die erste Fassung sperrte nur
`document.body` — und traf damit ausgerechnet die Access-Management-Seite
nicht, die längste Liste der App. Sie scrollt nämlich nicht im Dokument,
sondern in einem eigenen Container (`h-dvh overflow-y-scroll`, nötig für die
Swipe-Geste), und den interessiert ein `overflow: hidden` auf dem Body nicht.

Statt einen Ref durch jede Dialog-Ebene zu reichen, markiert so eine Seite
ihren Container mit `data-scroll-container`; der Hook findet ihn. Ein Attribut
statt einer Prop-Kette — und die nächste Seite, die ihr Scrollen selbst
übernimmt, braucht genau diese eine Zeile.

`Modal` hat außerdem ein `testId` bekommen, das auch den Schließen-Button
bedient (`${testId}-close`), damit migrierte Dialoge ihre E2E-Anker behalten.

**Nebenbefund, nicht behoben:** `Modal` rendert **zwei** Elemente mit demselben
`aria-label` — den Backdrop-Button und den Schließen-Button im Header. Ein
Screenreader liest also zweimal „Close dialog". Beim Migrieren fiel das auf,
weil ein `getByLabelText` plötzlich zwei Treffer hatte. Zu beheben wäre es
leicht (Backdrop `aria-hidden`, Escape deckt Tastaturnutzer ohnehin ab), aber
es ändert die Semantik jedes Dialogs und gehört deshalb entschieden, nicht
nebenbei gemacht.

---

## 5. Radius-, Shadow- und Typo-Skala festschreiben

**Befund.** Keine erkennbare Regel, welcher Wert wann gilt:

- Container/Cards: `rounded-xl` 132 · `rounded-2xl` 93 · `rounded-lg` 28 ·
  `rounded-3xl` 17 · `rounded-md` 5 — zwei fast gleich häufige Konkurrenten
- Shadows: `shadow-sm` 30 · `shadow-lg` 26 · `shadow-2xl` 12 · `shadow-md` 6 ·
  `shadow-xl` 4
- Headings: `h1`/`h2`/`h3` reichen von `text-sm` bis `text-4xl`, wobei
  `text-sm` mit 23 Vorkommen die *häufigste* `h*`-Größe ist. Semantische
  Ebene und visuelle Hierarchie sind vollständig entkoppelt.

**Vorschlag.** Eine kurze Tabelle in `FRONTEND_CODING_STANDARDS.md`
("Card = `rounded-2xl`, Control = `rounded-xl`, dichte Control =
`rounded-lg`"; Seitentitel = `text-2xl`, Sektionstitel = `text-lg`, …) und
danach angleichen. Ohne die festgeschriebene Regel driftet das sofort wieder.

---

## 6. Spinner / Loading-State als Komponente

**Befund.** 73 handgeschriebene `animate-spin`-Stellen in 48 Dateien, dazu
zwei feature-spezifische Loading-States (`ConnectorsLoadingState`,
`DataIngestionLoadingState`) ohne gemeinsame Basis.

**Vorschlag.** `ui/Spinner.tsx` (Größen passend zur Button-Skala) und ein
generisches `ui/EmptyState.tsx` — es gibt ~25 Dateien mit handgebauten
"noch nichts da"-Zuständen.

---

## 7. Formatter erzwingen

**Befund.** Prettier ist als Dependency vorhanden, aber es existiert **keine
`.prettierrc`**. `eslint.config.js` bindet nur `eslint-config-prettier` ein,
das Regeln lediglich *abschaltet*, statt zu formatieren.

Ergebnis: 131 Dateien mit 4-Space-Indent, 52 mit 2-Space — teils innerhalb
desselben Ordners (`ui/Badge.tsx` 4er, `ui/SaveButton.tsx` 2er). Auch die
Reihenfolge der Tailwind-Klassen driftet (`w-3.5 h-3.5` vs. `h-4 w-4`).

**Vorschlag.** `.prettierrc` anlegen, `prettier-plugin-tailwindcss`
ergänzen, einmalig über die Codebase laufen lassen und den Formatier-Commit
in `.git-blame-ignore-revs` eintragen, damit `git blame` brauchbar bleibt.
Reihenfolge beachten: **nach** der Button-Migration, sonst kollidiert der
Reformat mit den offenen Änderungen.

---

## Nicht zu beanstanden

Zur Abgrenzung, damit hier niemand Arbeit sucht, wo keine ist:

- Das **Farb-Token-System** in `src/styles/index.css` ist sauber und
  durchgängig adoptiert — bis auf `Badge.tsx` (Punkt 3) gibt es praktisch
  keine rohen Tailwind-Farben und fast keine `dark:`-Prefixes.
- Die **Animations-Tokens** in `src/styles/tokens.ts` sind zentralisiert und
  gut dokumentiert.
- **Icon-only-Buttons** haben durchgängig ein `aria-label` — geprüft, 0
  Verstöße.
