import type { ArtifactContent, ArtifactSummaryCitation } from "./types";

export type ViewMode = "raw" | "summary";
export type MarkdownViewMode = "rendered" | "source";

export interface DrawerState {
  viewMode: ViewMode;
  markdownViewMode: MarkdownViewMode;
  content: ArtifactContent | null;
  summary: string;
  citations: ArtifactSummaryCitation[];
  isLoading: boolean;
  isFetchingSummary: boolean;
  isIndexing: boolean;
  isDeleting: boolean;
  isConfirmDeleteOpen: boolean;
  stageDetail?: string;
  error: string | null;
}

export type DrawerAction =
  | { type: "reset" }
  | { type: "loadStart" }
  | { type: "loadSuccess"; content: ArtifactContent }
  | { type: "loadError"; error: string }
  | { type: "skipContentLoad" }
  | { type: "setMarkdownViewMode"; mode: MarkdownViewMode }
  | { type: "summarizeStart" }
  | { type: "summarizeIndexing" }
  | { type: "summarizeStage"; name: string; detail: string }
  | { type: "summarizeToken"; chunk: string }
  | { type: "summarizeCitation"; citation: ArtifactSummaryCitation }
  | { type: "summarizeDone" }
  | { type: "summarizeError"; error: string }
  | { type: "showRaw" }
  | { type: "deleteStart" }
  | { type: "deleteSuccess" }
  | { type: "deleteFailed" }
  | { type: "openDeleteConfirm" }
  | { type: "closeDeleteConfirm" };

export const initialState: DrawerState = {
  viewMode: "raw",
  markdownViewMode: "rendered",
  content: null,
  summary: "",
  citations: [],
  isLoading: false,
  isFetchingSummary: false,
  isIndexing: false,
  isDeleting: false,
  isConfirmDeleteOpen: false,
  stageDetail: undefined,
  error: null,
};

function reduceLoading(state: DrawerState, action: DrawerAction): DrawerState | null {
  switch (action.type) {
    case "reset":
      return { ...initialState, isLoading: true };
    case "loadStart":
      return { ...state, isLoading: true, error: null };
    case "loadSuccess":
      return { ...state, isLoading: false, content: action.content };
    case "skipContentLoad":
      // Artifacts shown from their metadata have no stored content (an organization's
      // content endpoint redirects), so nothing to fetch — just end the loading state.
      return { ...state, isLoading: false };
    case "loadError":
      return { ...state, isLoading: false, error: action.error };
    case "setMarkdownViewMode":
      return { ...state, markdownViewMode: action.mode };
    default:
      return null;
  }
}

function reduceSummary(state: DrawerState, action: DrawerAction): DrawerState | null {
  switch (action.type) {
    case "summarizeStart":
      return {
        ...state,
        viewMode: "summary",
        summary: "",
        citations: [],
        isFetchingSummary: true,
        isIndexing: false,
        stageDetail: undefined,
        error: null,
      };
    case "summarizeIndexing":
      return { ...state, isFetchingSummary: true, isIndexing: true, stageDetail: undefined };
    case "summarizeStage":
      return { ...state, isFetchingSummary: true, isIndexing: false, stageDetail: action.detail };
    case "summarizeToken":
      return { ...state, summary: state.summary + action.chunk };
    case "summarizeCitation":
      return { ...state, citations: [...state.citations, action.citation] };
    case "summarizeDone":
      return { ...state, isFetchingSummary: false, isIndexing: false };
    case "summarizeError":
      return { ...state, isFetchingSummary: false, isIndexing: false, error: action.error };
    case "showRaw":
      return { ...state, viewMode: "raw" };
    default:
      return null;
  }
}

function reduceDeletion(state: DrawerState, action: DrawerAction): DrawerState | null {
  switch (action.type) {
    case "deleteStart":
      return { ...state, isDeleting: true };
    case "deleteSuccess":
    case "deleteFailed":
      return { ...state, isDeleting: false };
    case "openDeleteConfirm":
      return { ...state, isConfirmDeleteOpen: true };
    case "closeDeleteConfirm":
      return { ...state, isConfirmDeleteOpen: false };
    default:
      return null;
  }
}

export function drawerReducer(state: DrawerState, action: DrawerAction): DrawerState {
  return (
    reduceLoading(state, action) ??
    reduceSummary(state, action) ??
    reduceDeletion(state, action) ??
    state
  );
}
