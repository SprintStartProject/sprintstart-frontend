import http from "node:http";
import { fileURLToPath } from "node:url";
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
      "/auth": {
        target: "http://127.0.0.1:8081",
        changeOrigin: true,
        agent: keepAliveAgent,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/unit/setup/vitest.setup.ts",
    // An axe scan of a full page takes seconds, and the a11y suite runs many of them in
    // parallel. The default 5s bounds machine load rather than the code under test, so a
    // busy runner fails whichever file happens to be scheduled last.
    testTimeout: 30000,
    alias: [
      // Every test's `render`/`renderHook` gets a QueryClientProvider for free, without
      // touching the ~230 files that import them directly — see tests/unit/setup/rtl.tsx.
      // The array + RegExp form is load-bearing: Vitest's `test.alias`, unlike Vite's own
      // `resolve.alias`, does not special-case a "$"-suffixed *string* key as an exact-match
      // marker — `{"@testing-library/react$": ...}` was matched against the literal string
      // "@testing-library/react$" (with a trailing dollar sign that real imports never have)
      // and so never matched anything at all. This silently left every test rendering
      // through the *real* testing-library, with no QueryClientProvider, for as long as
      // that string-keyed form was in place — a real anchored RegExp is the only form
      // Vitest actually treats as "this exact specifier".
      {
        find: /^@testing-library\/react$/,
        replacement: fileURLToPath(new URL("./tests/unit/setup/rtl.tsx", import.meta.url)),
      },
    ],
  },
});
