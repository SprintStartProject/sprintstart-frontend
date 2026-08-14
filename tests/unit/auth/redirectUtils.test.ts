import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AUTH_REDIRECT_STORAGE_KEY,
  sanitizeRedirectPath,
  extractFullPath,
  storeRedirectTarget,
  retrieveRedirectTarget,
  retrieveAndClearRedirectTarget,
  clearRedirectTarget,
  resolveRedirectTarget,
  buildRedirectUri,
} from "../../../src/auth/redirectUtils";

describe("redirectUtils", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe("sanitizeRedirectPath", () => {
    it("returns valid relative paths intact", () => {
      expect(sanitizeRedirectPath("/")).toBe("/");
      expect(sanitizeRedirectPath("/chat")).toBe("/chat");
      expect(sanitizeRedirectPath("/insights/faq/42?tab=1#sec")).toBe("/insights/faq/42?tab=1#sec");
      expect(sanitizeRedirectPath("/team/user-123")).toBe("/team/user-123");
    });

    it("trims whitespace from candidate paths", () => {
      expect(sanitizeRedirectPath("  /dashboard  ")).toBe("/dashboard");
    });

    it("returns null for non-string or empty inputs", () => {
      expect(sanitizeRedirectPath(null)).toBeNull();
      expect(sanitizeRedirectPath(undefined)).toBeNull();
      expect(sanitizeRedirectPath("")).toBeNull();
      expect(sanitizeRedirectPath("   ")).toBeNull();
    });

    it("rejects absolute URLs and protocol schemes", () => {
      expect(sanitizeRedirectPath("https://evil.com")).toBeNull();
      expect(sanitizeRedirectPath("http://evil.com/steal")).toBeNull();
      expect(sanitizeRedirectPath("javascript:alert(1)")).toBeNull();
      expect(sanitizeRedirectPath("data:text/html,test")).toBeNull();
    });

    it("rejects protocol-relative URLs", () => {
      expect(sanitizeRedirectPath("//evil.com")).toBeNull();
      expect(sanitizeRedirectPath("//evil.com/path")).toBeNull();
      expect(sanitizeRedirectPath("/\\evil.com")).toBeNull();
      expect(sanitizeRedirectPath("\\evil.com")).toBeNull();
    });

    it("rejects /login targets to prevent loop", () => {
      expect(sanitizeRedirectPath("/login")).toBeNull();
      expect(sanitizeRedirectPath("/login?redirect=/foo")).toBeNull();
    });
  });

  describe("extractFullPath", () => {
    it("returns pathname only when search and hash are omitted", () => {
      expect(extractFullPath({ pathname: "/chat" })).toBe("/chat");
    });

    it("concatenates pathname, search, and hash", () => {
      expect(
        extractFullPath({
          pathname: "/insights/faq/42",
          search: "?filter=true",
          hash: "#heading",
        }),
      ).toBe("/insights/faq/42?filter=true#heading");
    });
  });

  describe("sessionStorage helpers", () => {
    it("stores and retrieves sanitized targets", () => {
      storeRedirectTarget("/insights/knowledge-gaps/g1");
      expect(sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY)).toBe("/insights/knowledge-gaps/g1");
      expect(retrieveRedirectTarget()).toBe("/insights/knowledge-gaps/g1");
    });

    it("does not store invalid targets", () => {
      storeRedirectTarget("https://malicious.example.com");
      expect(sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY)).toBeNull();
      expect(retrieveRedirectTarget()).toBeNull();
    });

    it("retrieves and clears the stored target in one call", () => {
      storeRedirectTarget("/settings");
      const retrieved = retrieveAndClearRedirectTarget();
      expect(retrieved).toBe("/settings");
      expect(sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY)).toBeNull();
    });

    it("clears the target without throwing", () => {
      storeRedirectTarget("/onboarding");
      clearRedirectTarget();
      expect(retrieveRedirectTarget()).toBeNull();
    });
  });

  describe("resolveRedirectTarget", () => {
    it("prioritizes query parameters (?redirect= or ?from=)", () => {
      const searchParams = new URLSearchParams("?redirect=%2Fchat%3Fid%3D123");
      const target = resolveRedirectTarget({
        searchParams,
        locationState: { from: "/team-management" },
        sessionTarget: "/settings",
        fallback: "/",
      });
      expect(target).toBe("/chat?id=123");
    });

    it("supports ?from= query parameter", () => {
      const searchParams = new URLSearchParams("?from=%2Fpm-dashboard");
      const target = resolveRedirectTarget({
        searchParams,
        fallback: "/",
      });
      expect(target).toBe("/pm-dashboard");
    });

    it("falls back to locationState.from when query param is absent or invalid", () => {
      const searchParams = new URLSearchParams("?redirect=https://evil.com");
      const target = resolveRedirectTarget({
        searchParams,
        locationState: {
          from: { pathname: "/insights/faq/1", search: "?tab=2", hash: "#top" },
        },
        sessionTarget: "/settings",
        fallback: "/",
      });
      expect(target).toBe("/insights/faq/1?tab=2#top");
    });

    it("supports string locationState.from", () => {
      const target = resolveRedirectTarget({
        locationState: { from: "/data-ingestion" },
        fallback: "/",
      });
      expect(target).toBe("/data-ingestion");
    });

    it("falls back to sessionStorage when query and locationState are absent", () => {
      const target = resolveRedirectTarget({
        sessionTarget: "/team/user-99",
        fallback: "/",
      });
      expect(target).toBe("/team/user-99");
    });

    it("uses safe fallback when all sources are absent or invalid", () => {
      const searchParams = new URLSearchParams("?redirect=//phishing.com");
      const target = resolveRedirectTarget({
        searchParams,
        locationState: { from: "javascript:void(0)" },
        sessionTarget: "http://attacker.com",
        fallback: "/dashboard",
      });
      expect(target).toBe("/dashboard");
    });
  });

  describe("buildRedirectUri", () => {
    it("prepends window.location.origin to the relative path", () => {
      const uri = buildRedirectUri("/insights/faq/42?tab=1");
      expect(uri).toBe(`${window.location.origin}/insights/faq/42?tab=1`);
    });

    it("strips hash fragments for OAuth 2.0 compliance", () => {
      const uri = buildRedirectUri("/knowledge-base?search=guide#top");
      expect(uri).toBe(`${window.location.origin}/knowledge-base?search=guide`);
    });

    it("sanitizes unsafe paths and falls back to origin root", () => {
      const uri = buildRedirectUri("https://evil.com");
      expect(uri).toBe(`${window.location.origin}/`);
    });
  });
});
