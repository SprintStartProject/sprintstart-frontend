import { vi } from "vitest";

type Mock = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

/** Every method of the blueprint service, created on first use so a test names only what it needs. */
export const service = new Proxy<Record<string, Mock>>(
  {},
  {
    get(target, key) {
      if (typeof key !== "string" || key === "then" || key === "toJSON") return undefined;
      return (target[key] ??= vi.fn<(...args: unknown[]) => unknown>());
    },
  },
);

export const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

/** Who is signed in and which project is selected, changed per test. */
export const session = {
  permissionGroup: "PM",
  selectedProjectId: "project-1" as string | null,
  isProjectLoading: false,
};

export function resetPageMocks() {
  vi.clearAllMocks();
  for (const key of Object.keys(service)) service[key].mockReset();
  session.permissionGroup = "PM";
  session.selectedProjectId = "project-1";
  session.isProjectLoading = false;
}
