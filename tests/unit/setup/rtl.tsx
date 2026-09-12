import type { ReactElement, ReactNode } from "react";
import type { RenderOptions, RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// Deep import, not "@testing-library/react": vite.config.ts aliases that exact
// specifier to this file, so importing it here would just import this file again.
import * as RTL from "@testing-library/react/dist/index.js";

export * from "@testing-library/react/dist/index.js";

/**
 * Drop-in replacement for RTL's `render`, picked up automatically by every test file
 * (see the `test.alias` entry in vite.config.ts) so none of them need to know about
 * TanStack Query. Every render gets its own client — a fresh cache per test, and
 * `retry: false`/`gcTime: 0` so a component's error state shows up immediately
 * instead of after RTL's retry backoff, and nothing lingers into the next test.
 */
export function render(ui: ReactElement, options: RenderOptions = {}): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const { wrapper: InnerWrapper, ...rest } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    const content = InnerWrapper ? <InnerWrapper>{children}</InnerWrapper> : children;
    return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
  }

  return RTL.render(ui, { ...rest, wrapper: Wrapper });
}
