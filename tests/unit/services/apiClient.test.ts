import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { apiClient, ApiError } from "../../../src/services/apiClient";
import { server, mockKeycloakInstance } from "../../unit/setup/vitest.setup";

describe("apiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKeycloakInstance.authenticated = true;
    mockKeycloakInstance.token = "test-token";
    mockKeycloakInstance.updateToken.mockResolvedValue(true);
    mockKeycloakInstance.login.mockResolvedValue(undefined);
  });

  it("refreshes the token (30s skew) before the request when authenticated", async () => {
    server.use(
      http.get("/api/v1/ping", ({ request }) =>
        HttpResponse.json({ auth: request.headers.get("Authorization") }),
      ),
    );

    const result = await apiClient.fetch<{ auth: string | null }>("/api/v1/ping");

    expect(mockKeycloakInstance.updateToken).toHaveBeenCalledWith(30);
    expect(result.auth).toBe("Bearer test-token");
  });

  it("skips the token refresh when not authenticated", async () => {
    mockKeycloakInstance.authenticated = false;
    server.use(http.get("/api/v1/ping", () => HttpResponse.json({ ok: true })));

    await apiClient.fetch<{ ok: boolean }>("/api/v1/ping");

    expect(mockKeycloakInstance.updateToken).not.toHaveBeenCalled();
  });

  it("still proceeds with the request after a failed token refresh", async () => {
    mockKeycloakInstance.updateToken.mockRejectedValue(new Error("refresh failed"));
    server.use(http.get("/api/v1/ping", () => HttpResponse.json({ ok: true })));

    const result = await apiClient.fetch<{ ok: boolean }>("/api/v1/ping");

    expect(mockKeycloakInstance.login).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("injects the Bearer token when one is present", async () => {
    mockKeycloakInstance.token = "abc-123";
    let capturedAuth: string | null = null;
    server.use(
      http.get("/api/v1/ping", ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        return HttpResponse.json({});
      }),
    );

    await apiClient.fetch("/api/v1/ping");
    expect(capturedAuth).toBe("Bearer abc-123");
  });

  it("sets Content-Type application/json by default", async () => {
    let capturedContentType: string | null = null;
    server.use(
      http.post("/api/v1/echo", ({ request }) => {
        capturedContentType = request.headers.get("Content-Type");
        return HttpResponse.json({});
      }),
    );

    await apiClient.fetch("/api/v1/echo", { method: "POST", body: JSON.stringify({ a: 1 }) });
    expect(capturedContentType).toContain("application/json");
  });

  it("does not set Content-Type when the body is FormData", async () => {
    let capturedContentType: string | null = null;
    server.use(
      http.post("/api/v1/upload", ({ request }) => {
        capturedContentType = request.headers.get("Content-Type");
        return HttpResponse.json({});
      }),
    );

    const formData = new FormData();
    formData.append("file", new Blob(["content"]), "f.txt");

    await apiClient.fetch("/api/v1/upload", { method: "POST", body: formData });
    expect(capturedContentType).not.toContain("application/json");
  });

  it("does not overwrite an explicitly-set Content-Type header", async () => {
    let capturedContentType: string | null = null;
    server.use(
      http.post("/api/v1/echo", ({ request }) => {
        capturedContentType = request.headers.get("Content-Type");
        return HttpResponse.json({});
      }),
    );

    await apiClient.fetch("/api/v1/echo", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello",
    });
    expect(capturedContentType).toBe("text/plain");
  });

  it("parses JSON response bodies", async () => {
    server.use(http.get("/api/v1/thing", () => HttpResponse.json({ id: 7, name: "thing" })));

    const result = await apiClient.fetch<{ id: number; name: string }>("/api/v1/thing");
    expect(result).toEqual({ id: 7, name: "thing" });
  });

  it("returns an empty object for an empty response body", async () => {
    server.use(http.get("/api/v1/empty", () => new HttpResponse("", { status: 200 })));

    const result = await apiClient.fetch<Record<string, never>>("/api/v1/empty");
    expect(result).toEqual({});
  });

  it("triggers re-login and throws ApiError(401) on 401 response", async () => {
    server.use(http.get("/api/v1/secret", () => new HttpResponse(null, { status: 401 })));

    await expect(apiClient.fetch("/api/v1/secret")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
    });
    expect(mockKeycloakInstance.login).toHaveBeenCalled();
  });

  it("throws ApiError with the response status and body for other non-OK responses", async () => {
    server.use(http.get("/api/v1/broken", () => HttpResponse.text("boom", { status: 500 })));

    await expect(apiClient.fetch("/api/v1/broken")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "boom",
    });
  });

  it("extracts `message` from a JSON error body", async () => {
    server.use(
      http.delete("/api/v1/github/connections/repo/projects/proj", () =>
        HttpResponse.json({ message: "You cannot access this project." }, { status: 403 }),
      ),
    );

    await expect(
      apiClient.fetch("/api/v1/github/connections/repo/projects/proj", { method: "DELETE" }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      message: "You cannot access this project.",
    });
  });

  it("surfaces the `error` field when a JSON body has no usable `message`", async () => {
    server.use(
      http.get("/api/v1/broken", () => HttpResponse.json({ error: "nope" }, { status: 400 })),
    );

    await expect(apiClient.fetch("/api/v1/broken")).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "nope",
    });
  });

  it("surfaces Spring's `error` phrase instead of the raw default error body", async () => {
    server.use(
      http.get("/api/v1/broken", () =>
        HttpResponse.json(
          {
            timestamp: "2026-07-31T10:00:00.000+00:00",
            status: 500,
            error: "Internal Server Error",
            message: "",
            path: "/api/v1/broken",
          },
          { status: 500 },
        ),
      ),
    );

    await expect(apiClient.fetch("/api/v1/broken")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "Internal Server Error",
    });
  });

  it("falls back to statusText when the error body cannot be read", async () => {
    server.use(
      http.get(
        "/api/v1/broken",
        () => new HttpResponse(null, { status: 502, statusText: "Bad Gateway" }),
      ),
    );

    await expect(apiClient.fetch("/api/v1/broken")).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
    });
  });

  it("ApiError exposes status and name", () => {
    const error = new ApiError(418, "teapot");
    expect(error.status).toBe(418);
    expect(error.name).toBe("ApiError");
    expect(error.message).toBe("teapot");
    expect(error).toBeInstanceOf(Error);
  });
});
