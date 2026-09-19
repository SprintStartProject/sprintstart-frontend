import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../setup/vitest.setup";

/**
 * The open-escalation count is asked for on every navigation, so what it does when the backend does
 * not have the endpoint matters more than what it does when it works.
 *
 * The module remembers a 404 for the life of the tab, so each case needs a fresh import.
 */
async function freshService() {
  vi.resetModules();
  return (await import("../../../src/services/knowledgeRequestService")).knowledgeRequestService;
}

const COUNT = "/api/v1/onboarding/knowledge-requests/count";

describe("knowledgeRequestService.countOpen", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("reports the count the backend gives it", async () => {
    server.use(http.get(COUNT, () => HttpResponse.json({ open: 3 })));
    const service = await freshService();

    await expect(service.countOpen("project-1")).resolves.toBe(3);
  });

  it("reports nothing when the endpoint is missing, instead of throwing", async () => {
    server.use(http.get(COUNT, () => new HttpResponse(null, { status: 404 })));
    const service = await freshService();

    await expect(service.countOpen("project-1")).resolves.toBe(0);
  });

  it("stops asking once the endpoint has answered 404", async () => {
    let calls = 0;
    server.use(
      http.get(COUNT, () => {
        calls += 1;
        return new HttpResponse(null, { status: 404 });
      }),
    );
    const service = await freshService();

    await service.countOpen("project-1");
    await service.countOpen("project-1");
    await service.countOpen("project-2");

    // A backend does not grow the endpoint mid-session, and the sidebar asks on every view.
    expect(calls).toBe(1);
  });

  it("keeps asking after a server error, which may well be gone by the next check", async () => {
    let calls = 0;
    server.use(
      http.get(COUNT, () => {
        calls += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const service = await freshService();

    await expect(service.countOpen("project-1")).rejects.toThrow();
    await expect(service.countOpen("project-1")).rejects.toThrow();

    expect(calls).toBe(2);
  });
});
