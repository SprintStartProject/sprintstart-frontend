import { describe, it, expect } from "vitest";
import { ApiError } from "../../../src/services/apiClient";
import { parseApiError, describeRefreshFailure } from "../../../src/services/apiError";

describe("parseApiError", () => {
  it('returns "An unexpected error occurred" for a plain string', () => {
    expect(parseApiError("raw string", "fallback")).toBe("An unexpected error occurred.");
  });

  it("returns Error.message for a standard Error", () => {
    expect(parseApiError(new Error("something broke"), "fallback")).toBe("something broke");
  });

  it("returns the ApiError message (apiClient has already unwrapped the body)", () => {
    const error = new ApiError(400, "Github user pat with name default already exists.");
    expect(parseApiError(error, "fallback")).toBe(
      "Github user pat with name default already exists.",
    );
  });

  it("returns fallback when the ApiError message is empty", () => {
    const error = new ApiError(500, "   ");
    expect(parseApiError(error, "fallback")).toBe("fallback");
  });
});

describe("describeRefreshFailure", () => {
  it("describes a generic error", () => {
    const result = describeRefreshFailure(new Error("network error"));
    expect(result).toContain("couldn't be refreshed");
    expect(result).toContain("network error");
  });

  it("describes an unknown error type", () => {
    const result = describeRefreshFailure("something");
    expect(result).toContain("Unknown error");
  });
});
