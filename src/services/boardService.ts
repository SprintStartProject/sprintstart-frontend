import type { BoardDocumentWire } from "../features/board/sync/boardDocument";
import { apiClient } from "./apiClient";
import type {
  AuthoredCardRequest,
  Board,
  BoardCard,
  DiagramContent,
} from "../features/board/types";

const BASE = "/api/v1/onboarding";

export const boardService = {
  /**
   * The caller's own board on a project, cards hydrated.
   *
   * Every card's content is read live on the server from the same services the buddy's tools
   * read, so a card and the tool behind it cannot say different things. The board is created on
   * first read, holding the cards relevant to the caller's track — so a hire on their first day
   * gets a board, not an empty state.
   *
   * @param projectId The project the board belongs to.
   * @throws ApiError 404 when the caller is not a member of that project.
   */
  async fetchBoard(projectId: string): Promise<Board> {
    return await apiClient.fetch<Board>(
      `${BASE}/me/board?projectId=${encodeURIComponent(projectId)}`,
    );
  },

  /**
   * Checks a diagram card against the project's material as it is *now*.
   *
   * Separate from `fetchBoard`, which serves the picture last drawn and calls nothing. An
   * unchanged project answers without redrawing, so calling this once per board load is cheap; a
   * project that has moved comes back redrawn, and one that no longer supports the subject comes
   * back with no picture and a reason.
   *
   * @param cardId The diagram card to revalidate.
   * @throws ApiError 404 when it is not a diagram card on a board of theirs.
   */
  async refreshDiagram(cardId: string): Promise<DiagramContent> {
    return await apiClient.fetch<DiagramContent>(
      `${BASE}/me/board/cards/${encodeURIComponent(cardId)}/diagram`,
    );
  },

  /**
   * Takes a card off the caller's board, for good.
   *
   * The buddy will not put it back: the backend keeps the dismissed row so both the baseline
   * and the mentor consult it before adding anything. The affordance says "remove", not "hide".
   *
   * @param cardId The card to remove.
   * @throws ApiError 404 when it is not a card on a board of theirs.
   */
  async dismissCard(cardId: string): Promise<void> {
    await apiClient.fetch<void>(`${BASE}/me/board/cards/${encodeURIComponent(cardId)}`, {
      method: "DELETE",
    });
  },

  /**
   * Puts a card of the hire's own on their board.
   *
   * It is theirs: they can edit it, the buddy never touches it, and a board holds as many as they
   * like — unlike the live cards, of which there is one each.
   *
   * @throws ApiError 400 when the card would say nothing (an empty note, a link with no address).
   */
  async addCard(projectId: string, request: AuthoredCardRequest): Promise<BoardCard> {
    return await apiClient.fetch<BoardCard>(
      `${BASE}/me/board/cards?projectId=${encodeURIComponent(projectId)}`,
      { method: "POST", body: JSON.stringify(request) },
    );
  },

  /**
   * How this hire has arranged this board — stages, sequences, areas, folds, pins, widths, where a
   * card came from and what is highlighted in it.
   *
   * Separate from the board read on purpose. The cards are read live from half the onboarding
   * module on every load; the arrangement is a small document the client owns and the server only
   * keeps. Folding it into the board response would make one slow read out of one slow and one
   * instant one, and would send the whole arrangement back on every poll of the live cards.
   *
   * A board nobody has arranged answers with an empty arrangement rather than a 404.
   */
  async fetchStructure(projectId: string): Promise<BoardDocumentWire> {
    const response = await apiClient.fetch<{ structure: BoardDocumentWire }>(
      `${BASE}/me/board/structure?projectId=${encodeURIComponent(projectId)}`,
    );

    return response.structure;
  },

  /**
   * Stores the whole arrangement.
   *
   * Sent whole rather than as a patch, the same call `reorder` makes: an arrangement is a statement
   * about the board, and a patch language for "this card is `LATER` now and also that area was
   * renamed" would be more machinery than the thing it describes.
   */
  async saveStructure(projectId: string, structure: BoardDocumentWire): Promise<void> {
    await apiClient.fetch<unknown>(
      `${BASE}/me/board/structure?projectId=${encodeURIComponent(projectId)}`,
      { method: "PUT", body: JSON.stringify({ structure }) },
    );
  },

  /**
   * Replaces what one of the hire's own cards says — ticking a checklist item included.
   *
   * Replaces rather than patches: these are small and are read and written whole. Items keep
   * their ids across the round trip, which is what makes a tick an edit to that line rather than
   * to a position.
   *
   * @throws ApiError 404 when it is not a card of theirs.
   */
  async editCard(cardId: string, request: AuthoredCardRequest): Promise<BoardCard> {
    return await apiClient.fetch<BoardCard>(
      `${BASE}/me/board/cards/${encodeURIComponent(cardId)}`,
      { method: "PATCH", body: JSON.stringify(request) },
    );
  },

  /**
   * Sets the order of the hire's cards.
   *
   * Sends the whole order rather than one move: a drag is a statement about the board, and
   * reconstructing that from a single move is how two clients end up disagreeing.
   */
  async reorder(projectId: string, cardIds: string[]): Promise<void> {
    await apiClient.fetch<void>(
      `${BASE}/me/board/order?projectId=${encodeURIComponent(projectId)}`,
      { method: "PUT", body: JSON.stringify({ cardIds }) },
    );
  },
};
