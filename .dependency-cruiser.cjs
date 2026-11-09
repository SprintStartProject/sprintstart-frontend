/**
 * Architecture rules for the frontend, checked by `npm run arch`.
 *
 * Violations that existed when these rules were introduced are listed in
 * `.dependency-cruiser-known-violations.json`; that list may only shrink. After fixing one, regenerate
 * it with `npm run arch:baseline` and check that the diff only removes entries.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment:
        "Modules that import each other cannot be understood, tested or changed one at a time.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-cross-feature-internals",
      comment:
        "A feature uses another feature only through that feature's index.ts. Anything shared by " +
        "several features belongs in components/, hooks/ or services/.",
      severity: "error",
      from: { path: "^src/features/([^/]+)/" },
      to: {
        path: "^src/features/([^/]+)/",
        pathNot: ["^src/features/$1/", "^src/features/[^/]+/index\\.tsx?$"],
      },
    },
    {
      name: "ui-primitives-stay-generic",
      comment:
        "components/ui is the design system; it knows nothing about features, pages or services.",
      severity: "error",
      from: { path: "^src/components/ui/" },
      to: { path: "^src/(features|pages|services|context)/" },
    },
    {
      name: "services-stay-below-the-ui",
      comment:
        "services/ talks to the backend; it never imports React components, features or pages.",
      severity: "error",
      from: { path: "^src/services/" },
      to: { path: "^src/(components|features|pages)/" },
    },
    {
      name: "features-do-not-import-pages",
      comment: "Pages compose features; a feature that imports a page inverts that.",
      severity: "error",
      from: { path: "^src/(features|components)/" },
      to: { path: "^src/pages/" },
    },
    {
      name: "no-test-code-in-src",
      severity: "error",
      from: { path: "^src/" },
      to: { path: "^tests/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^src/keycloak-theme/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.app.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
