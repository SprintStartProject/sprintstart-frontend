import { describe, it, expect, vi, beforeEach } from "vitest";
import { userService } from "../../../src/services/userService";
import { http, HttpResponse } from "msw";
import { server } from "../../unit/setup/vitest.setup";

describe("userService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getProfile returns backend profile data", async () => {
    server.use(
      http.get("/api/v1/users/me", () =>
        HttpResponse.json({
          id: "123",
          authId: "auth-123",
          username: "testuser",
          email: "backend@example.com",
          firstName: "Backend",
          lastName: "User",
          projectRoles: [],
          permissionGroup: "USER",
          enabled: true,
          profileIcon: null,
          hasCompletedOnboarding: true,
        }),
      ),
    );

    const profile = await userService.getProfile();
    expect(profile?.id).toBe("123");
    expect(profile?.email).toBe("backend@example.com");
    expect(profile?.firstName).toBe("Backend");
  });

  it("getProfile returns null on error", async () => {
    server.use(http.get("/api/v1/users/me", () => HttpResponse.error()));

    const profile = await userService.getProfile();
    expect(profile).toBeNull();
  });

  it("updateProfile patches backend and returns updated profile", async () => {
    server.use(
      http.patch("/api/v1/users/me", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: "123",
          authId: "auth-123",
          username: "testuser",
          email: "test@example.com",
          firstName: body.firstName as string,
          lastName: "User",
          projectRoles: [],
          permissionGroup: "USER",
          enabled: true,
          profileIcon: (body.profileIcon as string) ?? null,
          hasCompletedOnboarding: true,
        });
      }),
    );

    const updated = await userService.updateProfile({
      firstName: "NewName",
      profileIcon: "icon1",
    });

    expect(updated.firstName).toBe("NewName");
    expect(updated.profileIcon).toBe("icon1");
  });

  it("updateProfile rejects if backend fails", async () => {
    server.use(http.patch("/api/v1/users/me", () => HttpResponse.error()));

    await expect(userService.updateProfile({ firstName: "FallbackName" })).rejects.toThrow();
  });

  it("getMyProjects returns the projects the user is assigned to", async () => {
    server.use(
      http.get("/api/v1/users/me/projects", () =>
        HttpResponse.json([{ id: "project-1", name: "Apollo" }]),
      ),
    );

    const projects = await userService.getMyProjects();

    expect(projects).toEqual([{ id: "project-1", name: "Apollo" }]);
  });
});
