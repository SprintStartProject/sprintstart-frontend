import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useContext } from "react";
import { AuthProvider } from "../../../src/context/AuthProvider";
import { AuthContext } from "../../../src/context/AuthContext";
import { http, HttpResponse } from "msw";
import { server } from "../../unit/setup/vitest.setup";
import { mockKeycloakInstance } from "../../unit/setup/vitest.setup";

const DummyConsumer = () => {
  const { status, profile } = useContext(AuthContext)!;
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="profile-name">{profile ? profile.username : "none"}</span>
    </div>
  );
};

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while keycloak initializes", () => {
    mockKeycloakInstance.init.mockReturnValue(new Promise(() => {}));

    render(
      <AuthProvider>
        <DummyConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
  });

  it("transitions to authenticated on successful SSO", async () => {
    mockKeycloakInstance.init.mockResolvedValue(true);

    server.use(
      http.get("/api/v1/users/me", () =>
        HttpResponse.json({
          id: "1",
          authId: "auth-1",
          username: "test",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          projectRoles: [],
          permissionGroup: "USER",
          enabled: true,
          profileIcon: null,
          hasCompletedOnboarding: true,
        }),
      ),
    );

    render(
      <AuthProvider>
        <DummyConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    expect(screen.getByTestId("profile-name")).toHaveTextContent("test");
  });

  it("transitions to unauthenticated when SSO fails", async () => {
    mockKeycloakInstance.init.mockResolvedValue(false);

    render(
      <AuthProvider>
        <DummyConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    });
  });

  it("retries fetching profile on null response", async () => {
    mockKeycloakInstance.init.mockResolvedValue(true);

    let callCount = 0;
    server.use(
      http.get("/api/v1/users/me", () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json(null, { status: 404 });
        }
        return HttpResponse.json({
          id: "1",
          authId: "auth-1",
          username: "retried",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          projectRoles: [],
          permissionGroup: "USER",
          enabled: true,
          profileIcon: null,
          hasCompletedOnboarding: true,
        });
      }),
    );

    render(
      <AuthProvider>
        <DummyConsumer />
      </AuthProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
        expect(screen.getByTestId("profile-name")).toHaveTextContent("retried");
      },
      { timeout: 3000 },
    );
  });
});
