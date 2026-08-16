import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ChevronsLeft, FileText, KeyRound, X } from "lucide-react";
import { SOURCE_META } from "../../../../data-ingestion/data";
import { Button } from "../../../../../components/ui/Button";
import { useMediaQuery } from "../../../../../hooks/useMediaQuery";
import {
  GithubRepositoryDiscovery,
  type DiscoverySelection,
} from "../../../../data-ingestion/components/GithubRepositoryDiscovery";
import { JiraConnectStep } from "../../../../data-ingestion/components/JiraConnectStep";
import { SourceTypeStep } from "../../../../data-ingestion/components/SourceTypeStep";
import { FileUploadZone } from "../../../../knowledge-base/components/FileUploadZone";
import { TokenAddForm } from "../../../../settings/components/TokenAddForm";
import { JiraCredentialAddForm } from "../../../../settings/components/jira/JiraCredentialAddForm";
import type { SourceSystem } from "../../../../data-ingestion/types";
import type { JiraCredentialsDto } from "../../../../../services/sources/jiraService";

/**
 * Below this width the credential form stays inline (phone/tablet); at or above
 * it there is room to slide the wizard aside and show the companion beside it
 * with only a minimal loss of modal width.
 */
const DESKTOP_QUERY = "(min-width: 1280px)";

/** The two screens of the add-source sub-flow: pick a type, then fill it in. */
export type AddSourceStep = "type" | "detail";

/** GitHub detail is fully controlled so the footer's "Add to list" can read it. */
type GithubDetailProps = {
  tokenNames: string[];
  tokenName: string;
  onTokenNameChange: (name: string) => void;
  /** Must be stable (a state setter) — the picker only re-reports on change. */
  onSelectionChange: (selection: DiscoverySelection[]) => void;
  /** Refetches the token list and selects the newly added one. */
  onTokenSaved: () => Promise<void>;
};

/** Jira detail — a staged form; nothing connects until provisioning. */
type JiraDetailProps = {
  displayName: string;
  url: string;
  credentialName: string;
  credentials: JiraCredentialsDto[];
  credentialsLoaded: boolean;
  credentialsLoading: boolean;
  credentialsError: string | null;
  /** Prefill for the inline "add credential" form's account-email field. */
  defaultUserEmail: string | null;
  onDisplayNameChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onCredentialNameChange: (value: string) => void;
  /** Enter in a field stages the source (guarded), matching "Add to list". */
  onSubmit: () => void;
  /** Refetches credentials and selects the newly added one. */
  onCredentialSaved: () => Promise<void>;
};

/** Upload detail — files are staged in memory and uploaded during provisioning. */
type UploadDetailProps = {
  files: File[];
  /** Appends the newly selected/dropped valid files to the staged list. */
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
};

type AddSourceFlowProps = {
  step: AddSourceStep;
  selectedType: SourceSystem;
  /**
   * The source types that can actually be staged here. Any type not listed
   * still renders in the grid (with a "Soon" badge), so the shape of the flow
   * does not change as later phases enable them.
   */
  availableTypes: SourceSystem[];
  onSelectType: (type: SourceSystem) => void;
  /** Returns from a type's detail screen to the type grid (the header's back). */
  onBack: () => void;
  isBusy?: boolean;
  github: GithubDetailProps;
  jira: JiraDetailProps;
  upload: UploadDetailProps;
  /**
   * Told when the desktop credential companion opens/closes, so the wizard can
   * slide its modal left to make room for it.
   */
  onCompanionOpenChange?: (open: boolean) => void;
};

/**
 * A "＋ Add credential" toggle that reveals an inline credential form in place,
 * so a user with no stored token/credential can create one without leaving the
 * wizard.
 *
 * On a phone the form opens inline in place (the trigger is replaced by it); on
 * a wider screen it opens in a right-hand drawer that slides in over the wizard
 * and closes itself once the token/credential is saved. The form owns save +
 * cancel; this only decides where it is shown.
 */
function TriggerButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} icon={<KeyRound className="h-4 w-4" />}>
      {label}
    </Button>
  );
}

/**
 * A compact "nothing stored yet" chip shown beside a credential trigger button.
 * Styled after the warning toast (icon + warning ink) but pushed a touch more
 * yellow, so it reads as a small hint rather than a full-width banner.
 */
function MissingCredentialChip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-yellow-400 bg-yellow-200 px-3 text-xs font-medium text-app-warning-text dark:border-yellow-400/50 dark:bg-yellow-400/15">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Gap between the wizard modal and the companion, and the companion's width. */
export const COMPANION_GAP = 16;
export const COMPANION_WIDTH = 360;
const VIEWPORT_MARGIN = 12;

/**
 * The desktop companion: a small modal-like card portalled to `<body>` and
 * positioned just to the right of the wizard modal, with a small gap. It is a
 * separate floating panel (no backdrop) so the wizard stays visible beside it,
 * and it slides in/out. Escape closes only the companion — a capture-phase
 * handler stops the event before the wizard modal's own Escape-to-close fires.
 *
 * The position is measured from the wizard dialog (found via `anchorRef`) and
 * re-measured on scroll/resize; it clamps into the viewport if the modal sits
 * too far right for the full gap.
 */
function CompanionModal({
  isOpen,
  onClose,
  title,
  anchorRef,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", top: -9999, left: -9999 });
  // Remembers the last applied top/left so the per-frame tracker only triggers a
  // re-render when the position actually moves.
  const lastPositionRef = useRef({ top: -9999, left: -9999 });

  const position = useCallback(() => {
    const dialog = anchorRef.current?.closest('[role="dialog"]') as HTMLElement | null;
    const rect = dialog?.getBoundingClientRect();

    const top = rect ? rect.top : 80;
    let left = rect
      ? rect.right + COMPANION_GAP
      : window.innerWidth - VIEWPORT_MARGIN - COMPANION_WIDTH;
    // Keep it on-screen if the modal sits too far right for the full gap.
    const maxLeft = window.innerWidth - VIEWPORT_MARGIN - COMPANION_WIDTH;
    if (left > maxLeft) left = Math.max(VIEWPORT_MARGIN, maxLeft);

    if (lastPositionRef.current.top === top && lastPositionRef.current.left === left) return;
    lastPositionRef.current = { top, left };

    setStyle({
      position: "fixed",
      top,
      left,
      width: COMPANION_WIDTH,
      maxHeight: window.innerHeight - top - VIEWPORT_MARGIN,
    });
  }, [anchorRef]);

  // Measure before paint so the card never flashes at the wrong spot, then keep
  // it glued to the wizard modal every frame while open — the modal's entrance
  // and its slide-left both move continuously, and staying flush with its top
  // edge means following that. `position` no-ops when nothing moved, so the loop
  // only ever costs a `getBoundingClientRect` per frame.
  useLayoutEffect(() => {
    if (!isOpen) return;

    lastPositionRef.current = { top: -9999, left: -9999 };

    let frame = 0;
    const loop = () => {
      position();
      frame = window.requestAnimationFrame(loop);
    };
    loop();

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, position]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  // Portal wraps AnimatePresence (not the reverse) — an AnimatePresence whose
  // child is a `createPortal(...)` drops it in the browser.
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="false"
          aria-label={title}
          style={style}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          className="z-[70] flex flex-col overflow-hidden rounded-[22px] border border-app-border bg-app-bg shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-2">
            <h2 className="text-lg font-semibold text-app-text">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close credential form"
              className="rounded-lg p-1.5 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Places a credential form either inline (phone) or in a small companion modal
 * to the right of the wizard (desktop), behind a trigger button. `renderForm`
 * is given a `close` callback to wire into the form's save/cancel, so the
 * container closes on both — and, since the form calls it after a save, the
 * companion closes once the token/credential is added.
 */
function CredentialSlot({
  buttonLabel,
  panelTitle,
  renderForm,
  onCompanionOpenChange,
  missingLabel,
}: {
  buttonLabel: string;
  panelTitle: string;
  /**
   * `embedded` is true only when the form is rendered inside the desktop
   * companion — which already provides the card and title — so the form can
   * drop its own chrome and sit directly in the panel.
   */
  renderForm: (close: () => void, embedded: boolean) => ReactNode;
  /** Told when the desktop companion opens/closes, so the wizard can slide left. */
  onCompanionOpenChange?: (open: boolean) => void;
  /**
   * When set, a compact warning chip with this text is shown beside the trigger
   * button (e.g. "No token yet") — a hint that nothing is stored yet. Omit it
   * once a credential exists.
   */
  missingLabel?: string;
}) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const close = () => setIsOpen(false);

  const companionOpen = isDesktop && isOpen;
  useEffect(() => {
    onCompanionOpenChange?.(companionOpen);
    return () => onCompanionOpenChange?.(false);
  }, [companionOpen, onCompanionOpenChange]);

  if (!isDesktop) {
    // Phone: unchanged inline behaviour — the trigger is replaced by the
    // self-contained form card (its own chrome, so not embedded).
    return isOpen ? (
      <>{renderForm(close, false)}</>
    ) : (
      <div className="flex flex-wrap items-center gap-3">
        <TriggerButton label={buttonLabel} onClick={() => setIsOpen(true)} />
        {missingLabel && <MissingCredentialChip label={missingLabel} />}
      </div>
    );
  }

  return (
    <div ref={anchorRef} className="flex flex-wrap items-center gap-3">
      <TriggerButton label={buttonLabel} onClick={() => setIsOpen(true)} />
      {missingLabel && <MissingCredentialChip label={missingLabel} />}
      <CompanionModal isOpen={isOpen} onClose={close} title={panelTitle} anchorRef={anchorRef}>
        {renderForm(close, true)}
      </CompanionModal>
    </div>
  );
}

/** GitHub detail with an "add token" trigger above the picker. */
function GithubDetail({
  isBusy,
  github,
  onCompanionOpenChange,
}: {
  isBusy: boolean;
  github: GithubDetailProps;
  onCompanionOpenChange?: (open: boolean) => void;
}) {
  const hasTokens = github.tokenNames.length > 0;

  return (
    <div className="space-y-4">
      <CredentialSlot
        buttonLabel="Add GitHub token"
        panelTitle="New GitHub token"
        renderForm={(close, embedded) => (
          <TokenAddForm onClose={close} onSaved={github.onTokenSaved} embedded={embedded} />
        )}
        onCompanionOpenChange={onCompanionOpenChange}
        missingLabel={hasTokens ? undefined : "No token yet"}
      />

      <GithubRepositoryDiscovery
        tokenNames={github.tokenNames}
        projectId={null}
        tokenName={github.tokenName}
        onTokenNameChange={github.onTokenNameChange}
        onSelectionChange={github.onSelectionChange}
        isConnecting={isBusy}
        suppressMissingTokenNotice
      />
    </div>
  );
}

/** Jira detail with an "add credential" trigger above the form. */
function JiraDetail({
  isBusy,
  jira,
  onCompanionOpenChange,
}: {
  isBusy: boolean;
  jira: JiraDetailProps;
  onCompanionOpenChange?: (open: boolean) => void;
}) {
  // Only hint "nothing stored" once the list has loaded, so the chip does not
  // flash while credentials are still being fetched.
  const missingCredential = jira.credentialsLoaded && jira.credentials.length === 0;

  return (
    <div className="space-y-4">
      <CredentialSlot
        buttonLabel="Add Jira credential"
        panelTitle="New Jira credential"
        onCompanionOpenChange={onCompanionOpenChange}
        missingLabel={missingCredential ? "No credential yet" : undefined}
        renderForm={(close, embedded) => (
          <JiraCredentialAddForm
            defaultUserEmail={jira.defaultUserEmail}
            onClose={close}
            onSaved={jira.onCredentialSaved}
            embedded={embedded}
          />
        )}
      />

      <JiraConnectStep
        displayName={jira.displayName}
        url={jira.url}
        credentialName={jira.credentialName}
        credentials={jira.credentials}
        credentialsLoaded={jira.credentialsLoaded}
        credentialsLoading={jira.credentialsLoading}
        credentialsError={jira.credentialsError}
        isBusy={isBusy}
        canIngest
        errorMessage={null}
        onDisplayNameChange={jira.onDisplayNameChange}
        onUrlChange={jira.onUrlChange}
        onCredentialNameChange={jira.onCredentialNameChange}
        onSubmit={jira.onSubmit}
        suppressMissingCredentialNotice
      />
    </div>
  );
}

/** The staged-files detail screen for an upload source. */
function UploadDetail({ files, onAddFiles, onRemoveFile }: UploadDetailProps) {
  return (
    <div className="space-y-4">
      <FileUploadZone onUpload={onAddFiles} isUploading={false} />

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-full border border-app-border bg-app-surface px-3 py-1 text-xs text-app-text"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-app-text-muted" />
              <span className="max-w-[16rem] truncate">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={() => onRemoveFile(index)}
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One-line brief shown under the detail header, per source type. */
const DETAIL_SUBTITLE: Record<SourceSystem, string> = {
  GITHUB: "Pick the repositories to index, then add them to your source list.",
  JIRA: "Point to your Jira instance and pick a credential, then add it to the list.",
  UPLOAD: "Files are staged now and uploaded right after the project is created.",
};

/**
 * The navigation header of a source's detail screen: a back control, then the
 * chosen type's icon, name and a short brief. Picking a type does not advance the
 * wizard's own stepper (it stays on "Sources") — choosing a type branches into
 * one of several forms rather than stepping forward — so this is master-detail:
 * paired with the slide-in, the title changing to the type name (with a back
 * arrow to the grid) reads as drilling into that source, not a step or a tab.
 */
function DetailHeader({ type, onBack }: { type: SourceSystem; onBack: () => void }) {
  const meta = SOURCE_META[type];
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-3 border-b border-app-border pb-4">
      <Button variant="ghost" size="sm" iconOnly onClick={onBack} aria-label="Back to source types">
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-app-brand-soft">
        <Icon size={22} className="text-app-brand" aria-hidden="true" />
      </div>

      <div>
        <p className="text-[15px] font-semibold text-app-text">{meta.type}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-app-text-muted">
          {DETAIL_SUBTITLE[type]}
        </p>
      </div>
    </div>
  );
}

/**
 * The "Add source" sub-flow shown inside the wizard's Sources step: a type grid
 * that advances into the type-specific detail screen. It stages a source rather
 * than connecting one — the detail screens capture what is needed and the wizard
 * turns it into a draft when the user commits from the footer.
 *
 * The sub-flow is presentational (the wizard owns which screen is shown and the
 * captured detail state); the only local state it owns is the collapsed/open
 * state of each inline credential form. Choosing a type is not a wizard step, so
 * the detail screen carries its own header (the type's icon and name) and slides
 * in from the right — type sits on the left, detail on the right — so it reads as
 * drilling into that source rather than switching a tab or advancing a step.
 */
export function AddSourceFlow({
  step,
  selectedType,
  availableTypes,
  onSelectType,
  onBack,
  isBusy = false,
  github,
  jira,
  upload,
  onCompanionOpenChange,
}: AddSourceFlowProps) {
  const prefersReducedMotion = useReducedMotion();

  const detail =
    selectedType === "JIRA" ? (
      <JiraDetail isBusy={isBusy} jira={jira} onCompanionOpenChange={onCompanionOpenChange} />
    ) : selectedType === "UPLOAD" ? (
      <UploadDetail
        files={upload.files}
        onAddFiles={upload.onAddFiles}
        onRemoveFile={upload.onRemoveFile}
      />
    ) : (
      <GithubDetail isBusy={isBusy} github={github} onCompanionOpenChange={onCompanionOpenChange} />
    );

  const screen =
    step === "type" ? (
      <SourceTypeStep
        selectedType={selectedType}
        onSelectType={onSelectType}
        heading="Add a source"
        description="Which source type do you want to connect?"
        availableTypes={availableTypes}
      />
    ) : (
      <div className="space-y-5">
        <DetailHeader type={selectedType} onBack={onBack} />
        {detail}
      </div>
    );

  // Type is the left page, detail the right one: advancing slides the incoming
  // screen in from the right and pushes the outgoing one left, and going back
  // reverses it, so the transition reads as moving between two pages.
  const offset = step === "type" ? -24 : 24;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={step}
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: offset }}
        animate={{ opacity: 1, x: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: offset }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      >
        {screen}
      </motion.div>
    </AnimatePresence>
  );
}
