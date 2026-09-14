import type { ReactElement, ReactNode } from "react";
import type {
  RenderOptions,
  RenderResult,
  RenderHookOptions,
  RenderHookResult,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// Deep import, not "@testing-library/react": vite.config.ts aliases that exact
// specifier to this file, so importing it here would just import this file again.
import * as RTL from "@testing-library/react/dist/index.js";

// Named re-exports rather than `export * from ".../dist/index.js"`, so this file is exactly
// what it claims to be — everything test files actually use from "@testing-library/react" —
// instead of relying on however a bundler happens to interop-copy a CommonJS module's exports.
export const { screen, waitFor, within, fireEvent, act, cleanup, configure } = RTL;

/** A fresh, per-test client: no retries, no lingering cache between tests. */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Drop-in replacement for RTL's `render`, picked up automatically by every test file
 * (see the `test.alias` entry in vite.config.ts) so none of them need to know about
 * TanStack Query. Every render gets its own client — a fresh cache per test, and
 * `retry: false`/`gcTime: 0` so a component's error state shows up immediately
 * instead of after RTL's retry backoff, and nothing lingers into the next test.
 */
export function render(ui: ReactElement, options: RenderOptions = {}): RenderResult {
  const queryClient = createTestQueryClient();
  const { wrapper: InnerWrapper, ...rest } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    const content = InnerWrapper ? <InnerWrapper>{children}</InnerWrapper> : children;
    return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
  }

  return RTL.render(ui, { ...rest, wrapper: Wrapper });
}

/** Same wrapping as {@link render}, for hooks tested directly with `renderHook`. */
export function renderHook<Result, Props>(
  callback: (props: Props) => Result,
  options: RenderHookOptions<Props> = {},
): RenderHookResult<Result, Props> {
  const queryClient = createTestQueryClient();
  const { wrapper: InnerWrapper, ...rest } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    const content = InnerWrapper ? <InnerWrapper>{children}</InnerWrapper> : children;
    return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
  }

  return RTL.renderHook(callback, { ...rest, wrapper: Wrapper });
}
