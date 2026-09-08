import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup/vitest.setup";
import {
  addAtlassianCredential,
  changeAtlassianCredentialName,
  changeAtlassianCredentialToken,
  deleteAtlassianCredential,
  getMyAtlassianCredentials,
} from "../../../src/services/sources/atlassianService";

describe("atlassianService credential endpoints", () => {
  it("addAtlassianCredential posts the credential payload", async () => {
    expect.assertions(1);

    server.use(
      http.post("/api/v1/atlassian/credentials", async ({ request }) => {
        expect(await request.json()).toEqual({
          userEmail: "pm@example.com",
          tokenName: "token-a",
          authToken: "secret",
        });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await addAtlassianCredential({
      userEmail: "pm@example.com",
      tokenName: "token-a",
      authToken: "secret",
    });
  });

  it("getMyAtlassianCredentials lists the authenticated user's credentials", async () => {
    server.use(
      http.get("/api/v1/atlassian/credentials", () =>
        HttpResponse.json([{ userEmail: "pm+user@example.com", displayName: "token-a" }]),
      ),
    );

    const credentials = await getMyAtlassianCredentials();

    expect(credentials).toHaveLength(1);
    expect(credentials[0]).toEqual({
      userEmail: "pm+user@example.com",
      displayName: "token-a",
    });
  });

  it("deleteAtlassianCredential sends a DELETE with the credential identity", async () => {
    expect.assertions(1);

    server.use(
      http.delete("/api/v1/atlassian/credentials", async ({ request }) => {
        expect(await request.json()).toEqual({
          userEmail: "pm@example.com",
          tokenName: "token-a",
        });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteAtlassianCredential({
      userEmail: "pm@example.com",
      tokenName: "token-a",
    });
  });

  it("deleteAtlassianCredential rejects with an ApiError on 404", async () => {
    server.use(
      http.delete("/api/v1/atlassian/credentials", () =>
        HttpResponse.json({ message: "unknown credential" }, { status: 404 }),
      ),
    );

    await expect(
      deleteAtlassianCredential({ userEmail: "pm@example.com", tokenName: "gone" }),
    ).rejects.toThrow();
  });

  it("changeAtlassianCredentialName patches the name and returns the credential", async () => {
    server.use(
      http.patch("/api/v1/atlassian/credentials/patch/name", async ({ request }) => {
        expect(await request.json()).toEqual({
          userEmail: "pm@example.com",
          oldName: "token-a",
          newName: "token-b",
        });

        return HttpResponse.json({
          userEmail: "pm@example.com",
          displayName: "token-b",
        });
      }),
    );

    const credential = await changeAtlassianCredentialName({
      userEmail: "pm@example.com",
      oldName: "token-a",
      newName: "token-b",
    });

    expect(credential.displayName).toBe("token-b");
  });

  it("changeAtlassianCredentialToken patches the token secret", async () => {
    server.use(
      http.patch("/api/v1/atlassian/credentials/patch/token", async ({ request }) => {
        expect(await request.json()).toEqual({
          userEmail: "pm@example.com",
          tokenName: "token-a",
          newToken: "new-secret",
        });

        return HttpResponse.json({
          userEmail: "pm@example.com",
          displayName: "token-a",
        });
      }),
    );

    const credential = await changeAtlassianCredentialToken({
      userEmail: "pm@example.com",
      tokenName: "token-a",
      newToken: "new-secret",
    });

    expect(credential.displayName).toBe("token-a");
  });
});
