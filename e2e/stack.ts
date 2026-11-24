/** Addresses and seeded accounts of the end-to-end stack (e2e/stack.sh). */

export const APP_URL = "http://localhost:5173";
export const KEYCLOAK_URL = "http://localhost:8081/auth";
export const BACKEND_URL = "http://localhost:8080";
export const AI_STUB_URL = "http://localhost:8000";
export const REALM = "sprintstart";
export const PROJECT_NAME = "E2E Project";

/** Must match e2e/stack.env — the stack is throw-away, so these are not secrets. */
export const STACK = { keycloakAdminPassword: "e2e-only", backendSharedSecret: "e2e-only" };

export type E2eUser = {
  username: string;
  firstName: string;
  realmRoles: string[];
  memberOfProject: boolean;
  managesProject: boolean;
};

export const PASSWORD = "e2e-only-password";

export const USERS = {
  hire: {
    username: "e2e.hire",
    firstName: "Hana",
    realmRoles: ["user"],
    memberOfProject: true,
    managesProject: false,
  },
  secondHire: {
    username: "e2e.hire2",
    firstName: "Kai",
    realmRoles: ["user"],
    memberOfProject: true,
    managesProject: false,
  },
  pm: {
    username: "e2e.pm",
    firstName: "Pia",
    realmRoles: ["user", "project-manager"],
    memberOfProject: true,
    managesProject: true,
  },
  admin: {
    username: "e2e.admin",
    firstName: "Ada",
    realmRoles: ["user", "admin"],
    memberOfProject: false,
    managesProject: false,
  },
} satisfies Record<string, E2eUser>;

export type Role = keyof typeof USERS;

export const storageStateOf = (role: Role): string => `e2e/.auth/${role}.json`;

/** The document the seed uploads into the project, so the buddy has something to cite (J05). */
export const DEPLOY_GUIDE = {
  filename: "e2e-deploy-guide.md",
  text: "# Deploy guide\n\nReleases are cut from the release branch every Thursday at 18:00.\n",
};
