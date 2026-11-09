/**
 * Seeds the end-to-end stack before any journey runs: Keycloak users, their backend projection, one
 * project with the hire as member and the PM as its manager. Idempotent, so a stack can be reused.
 */
import {
  AI_STUB_URL,
  BACKEND_URL,
  DEPLOY_GUIDE,
  KEYCLOAK_URL,
  PASSWORD,
  PROJECT_NAME,
  REALM,
  STACK,
  USERS,
  type E2eUser,
} from "./stack.ts";

type BackendUser = { id: string; authId: string; username: string; projectIds?: string[] };
type Project = { id: string; name: string };

async function request<T>(url: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, { ...init, headers });
  if (!response.ok)
    throw new Error(
      `${init.method ?? "GET"} ${url} -> ${response.status} ${await response.text()}`,
    );
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function passwordGrant(
  realm: string,
  clientId: string,
  username: string,
  password: string,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: clientId,
    username,
    password,
  });
  const token = await request<{ access_token: string }>(
    `${KEYCLOAK_URL}/realms/${realm}/protocol/openid-connect/token`,
    { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  return token.access_token;
}

/** A token for an end-to-end user, as the frontend's public client would get one. */
export const userToken = (user: E2eUser): Promise<string> =>
  passwordGrant(REALM, "sprintstart-frontend", user.username, PASSWORD);

async function ensureKeycloakUser(admin: string, user: E2eUser): Promise<string> {
  const users = `${KEYCLOAK_URL}/admin/realms/${REALM}/users`;
  const find = () =>
    request<{ id: string }[]>(`${users}?username=${user.username}&exact=true`, { token: admin });
  if ((await find()).length === 0) {
    const email = `${user.username}@e2e.test`;
    const body = JSON.stringify({
      username: user.username,
      email,
      firstName: user.firstName,
      lastName: "E2E",
      enabled: true,
      emailVerified: true,
    });
    await request(users, { method: "POST", token: admin, body });
  }
  const [{ id }] = await find();
  const credentials = JSON.stringify({ type: "password", value: PASSWORD, temporary: false });
  await request(`${users}/${id}/reset-password`, {
    method: "PUT",
    token: admin,
    body: credentials,
  });
  const available = await request<{ name: string }[]>(
    `${users}/${id}/role-mappings/realm/available`,
    { token: admin },
  );
  const missing = available.filter((role) => user.realmRoles.includes(role.name));
  if (missing.length) {
    await request(`${users}/${id}/role-mappings/realm`, {
      method: "POST",
      token: admin,
      body: JSON.stringify(missing),
    });
  }
  return id;
}

/** Keycloak forwards only self-registration to the backend, so admin-created users are announced here. */
async function registerWithBackend(user: E2eUser, authId: string): Promise<void> {
  const event = {
    source: "e2e",
    resourceType: "USER",
    eventType: "REGISTER",
    realmId: REALM,
    authId,
    username: user.username,
    email: `${user.username}@e2e.test`,
    firstName: user.firstName,
    lastName: "E2E",
    enabled: true,
    realmRoles: user.realmRoles,
  };
  await request(`${BACKEND_URL}/api/v1/internal/keycloak/events`, {
    method: "POST",
    headers: { "X-SprintStart-Keycloak-Secret": STACK.backendSharedSecret },
    body: JSON.stringify(event),
  });
}

async function ensureProject(admin: string): Promise<string> {
  const projects = await request<Project[]>(`${BACKEND_URL}/api/v1/admin/projects`, {
    token: admin,
  });
  const existing = projects.find((project) => project.name === PROJECT_NAME);
  if (existing) return existing.id;
  const body = JSON.stringify({
    name: PROJECT_NAME,
    description: "Seeded by the end-to-end tests",
  });
  return (
    await request<Project>(`${BACKEND_URL}/api/v1/admin/projects`, {
      method: "POST",
      token: admin,
      body,
    })
  ).id;
}

async function assignProject(admin: string, projectId: string): Promise<void> {
  const backendUsers = await request<BackendUser[]>(`${BACKEND_URL}/api/v1/admin/users`, {
    token: admin,
  });
  const idOf = (user: E2eUser) =>
    backendUsers.find((candidate) => candidate.username === user.username)?.id;
  const members = Object.values(USERS).filter((user) => user.memberOfProject);
  const userIds = members.map(idOf).filter((id): id is string => id !== undefined);
  const projectUsers = `${BACKEND_URL}/api/v1/admin/projects/${projectId}`;
  await request(`${projectUsers}/users`, {
    method: "POST",
    token: admin,
    body: JSON.stringify({ userIds }),
  });
  const manager = idOf(USERS.pm);
  await request(`${projectUsers}/manager`, {
    method: "PUT",
    token: admin,
    body: JSON.stringify({ managerUserId: manager }),
  });
}

type Upload = { id: string; filename: string };

const multipart = (request: object, files: Blob[] = [], filename = ""): FormData => {
  const form = new FormData();
  form.append("request", new Blob([JSON.stringify(request)], { type: "application/json" }));
  for (const file of files) form.append("files", file, filename);
  return form;
};

/**
 * Uploads the deploy guide afresh and waits until the AI stub has ingested it. Replaced on every run
 * rather than kept, because the stub only remembers what it was sent since it started.
 */
async function ensureDeployGuide(pm: string, projectId: string): Promise<void> {
  const uploads = `${BACKEND_URL}/api/v1/uploads`;
  const existing = (await request<Upload[]>(`${uploads}?projectId=${projectId}`, { token: pm }))
    .filter((upload) => upload.filename === DEPLOY_GUIDE.filename)
    .map((upload) => upload.id);
  if (existing.length) {
    await request(uploads, {
      method: "DELETE",
      token: pm,
      body: multipart({ artifactIds: existing, projectId }),
    });
  }
  const file = new Blob([DEPLOY_GUIDE.text], { type: "text/markdown" });
  await request(uploads, {
    method: "POST",
    token: pm,
    body: multipart({ projectId }, [file], DEPLOY_GUIDE.filename),
  });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const ingested = await request<{ title: string }[]>(`${AI_STUB_URL}/__e2e/ingested`);
    if (ingested.some((artifact) => artifact.title?.includes(DEPLOY_GUIDE.filename))) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`The AI stub never received ${DEPLOY_GUIDE.filename} from the backend`);
}

export default async function seed(): Promise<void> {
  const keycloakAdmin = await passwordGrant(
    "master",
    "admin-cli",
    "admin",
    STACK.keycloakAdminPassword,
  );
  for (const user of Object.values(USERS)) {
    const authId = await ensureKeycloakUser(keycloakAdmin, user);
    await registerWithBackend(user, authId).catch(() => undefined); // already registered on a reused stack
  }
  const admin = await userToken(USERS.admin);
  const projectId = await ensureProject(admin);
  await assignProject(admin, projectId);
  await ensureDeployGuide(await userToken(USERS.pm), projectId);
}
