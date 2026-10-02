import { apiClient } from "./apiClient";

const BASE = "/api/v1/users/me/dashboard/layout";

/** One placed widget as the server keeps it: the client's own id and size, stored as given. */
export type DashboardLayoutItemWire = {
  id: string;
  size: string;
};

export type DashboardLayoutWire = {
  version: number;
  items: DashboardLayoutItemWire[];
  /** Null when there is nothing to use — none stored, or stored under another version. */
  updatedAt: string | null;
};

export const dashboardLayoutService = {
  /**
   * The signed-in user's dashboard arrangement, if one was stored under `version`.
   *
   * No arrangement, or one written under another version, answers with no items and a null
   * `updatedAt` rather than a 404 — both mean "show the default".
   */
  async fetchLayout(version: number): Promise<DashboardLayoutWire> {
    return await apiClient.fetch<DashboardLayoutWire>(
      `${BASE}?version=${encodeURIComponent(String(version))}`,
    );
  },

  /** Stores the whole arrangement, replacing whatever was there. */
  async saveLayout(version: number, items: DashboardLayoutItemWire[]): Promise<void> {
    await apiClient.fetch<unknown>(BASE, {
      method: "PUT",
      body: JSON.stringify({ version, items }),
    });
  },

  /** Forgets the arrangement, so every device falls back to the default. */
  async resetLayout(): Promise<void> {
    await apiClient.fetch<unknown>(BASE, { method: "DELETE" });
  },
};
