/// <reference types="vite/client" />
import Keycloak from "keycloak-js";

/**
 * Keycloak configuration for the SprintStart frontend.
 *
 * The Keycloak server is proxied through the same origin as the frontend at
 * /auth (see nginx.conf / frontend-nginx-config), so the URL never needs
 * per-environment configuration.
 */
const clientId = String(import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "sprintstart-frontend");

const keycloak = new Keycloak({
  url: `${window.location.origin}/auth`,
  realm: "sprintstart",
  clientId,
});

export default keycloak;
