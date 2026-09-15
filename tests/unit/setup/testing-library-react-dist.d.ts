// The deep import in rtl.tsx reaches past the `@testing-library/react` alias (see
// vite.config.ts) to the package's real entry file, which has no adjacent .d.ts —
// its types live at "types/index.d.ts" instead. Re-point TS at the real types.
declare module "@testing-library/react/dist/index.js" {
  export * from "@testing-library/react";
}
