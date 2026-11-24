/**
 * Runs once before the journeys: seeds the stack, then signs every role in through the real Keycloak
 * form and keeps the session, so each journey starts signed in except the one that tests signing in.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import seed from "./seed.ts";
import { signIn } from "./sign-in.ts";
import { APP_URL, USERS, storageStateOf, type Role } from "./stack.ts";

export default async function globalSetup(): Promise<void> {
  await seed();
  mkdirSync("e2e/.auth", { recursive: true });
  const browser = await chromium.launch();
  for (const role of Object.keys(USERS) as Role[]) {
    const page = await browser.newPage({ baseURL: APP_URL });
    await signIn(page, USERS[role]);
    await page.context().storageState({ path: storageStateOf(role) });
    await page.close();
  }
  await browser.close();
}
