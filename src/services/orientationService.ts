import { apiClient } from "./apiClient";
import type {
  AuthorOrientationInput,
  MyOrientation,
  OrientationPacket,
} from "../features/orientation/types";

const BASE = "/api/v1/onboarding";

export const orientationService = {
  /**
   * Orientation for the authenticated hire's current task on a project.
   *
   * Having no task, and having a task the corpus cannot ground a packet for,
   * are both ordinary responses rather than errors — the caller renders which
   * one it got and never fills the gap with placeholder content. Reading this
   * is not a prerequisite for starting the task and never assigns one.
   *
   * @param projectId The project to read orientation for.
   * @throws ApiError 404 when the caller is not a member of the project.
   */
  async fetchMyOrientation(projectId: string): Promise<MyOrientation> {
    return await apiClient.fetch<MyOrientation>(
      `${BASE}/me/orientation?projectId=${encodeURIComponent(projectId)}`,
    );
  },

  /**
   * Replaces the orientation for the hire's *own* current task with their own
   * words, pinning it as human-authored so it is served as-is and never
   * AI-regenerated. This is what the "fix this" affordance does — a hire who
   * knows the orientation is wrong corrects it rather than reporting it into a
   * sink nobody reads.
   *
   * @param projectId The project whose current task to author for.
   * @param input The whole replacement packet.
   */
  async authorMyOrientation(
    projectId: string,
    input: AuthorOrientationInput,
  ): Promise<OrientationPacket> {
    return await apiClient.fetch<OrientationPacket>(
      `${BASE}/me/orientation?projectId=${encodeURIComponent(projectId)}`,
      { method: "PUT", body: JSON.stringify(input) },
    );
  },

  /**
   * Drops the hire's hand-authored packet for their current task, restoring AI
   * assembly on the next read.
   *
   * @param projectId The project whose current task to revert.
   */
  async revertMyOrientation(projectId: string): Promise<void> {
    await apiClient.fetch<void>(
      `${BASE}/me/orientation?projectId=${encodeURIComponent(projectId)}`,
      { method: "DELETE" },
    );
  },

  /**
   * The current orientation for a task, for a PM to author from — the cached
   * packet if there is one, otherwise a shell (task title and link) to start
   * blank. Never triggers AI assembly: opening the editor does not generate.
   *
   * @param taskId The starter-work task to author orientation for.
   * @param projectId The project the orientation is scoped to.
   */
  async fetchTaskOrientation(taskId: string, projectId: string): Promise<MyOrientation> {
    return await apiClient.fetch<MyOrientation>(
      `${BASE}/orientation/tasks/${encodeURIComponent(taskId)}?projectId=${encodeURIComponent(projectId)}`,
    );
  },

  /**
   * Replaces a task's orientation with a hand-authored packet (PM surface),
   * pinned as human-authored.
   *
   * @param taskId The starter-work task to author orientation for.
   * @param projectId The project the orientation is scoped to.
   * @param input The whole replacement packet.
   */
  async authorTaskOrientation(
    taskId: string,
    projectId: string,
    input: AuthorOrientationInput,
  ): Promise<OrientationPacket> {
    return await apiClient.fetch<OrientationPacket>(
      `${BASE}/orientation/tasks/${encodeURIComponent(taskId)}?projectId=${encodeURIComponent(projectId)}`,
      { method: "PUT", body: JSON.stringify(input) },
    );
  },

  /**
   * Drops the hand-authored packet for a task (PM surface), restoring AI
   * assembly on the next read.
   *
   * @param taskId The starter-work task to revert.
   * @param projectId The project the orientation is scoped to.
   */
  async revertTaskOrientation(taskId: string, projectId: string): Promise<void> {
    await apiClient.fetch<void>(
      `${BASE}/orientation/tasks/${encodeURIComponent(taskId)}?projectId=${encodeURIComponent(projectId)}`,
      { method: "DELETE" },
    );
  },
};
