import http from "node:http";
import { keycloakify } from "keycloakify/vite-plugin";
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const keepAliveAgent = new http.Agent({ keepAlive: true });

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    keycloakify({
      accountThemeImplementation: "none",
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        agent: keepAliveAgent,
      },
      "/v1": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        agent: keepAliveAgent,
      },
      '/auth': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
        agent: keepAliveAgent,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/unit/setup/vitest.setup.ts',
  }
});
