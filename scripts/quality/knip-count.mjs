// Counts dead code for scripts/quality/metrics.sh: unused files, exports, types and
// members. Dependencies are left out — several are used from CSS, which knip does not read.
import { execFileSync } from "node:child_process";

const kinds = ["files", "exports", "types", "nsExports", "nsTypes", "enumMembers", "classMembers"];
let output;
try {
  output = execFileSync(process.execPath, ["node_modules/knip/bin/knip.js", "--reporter", "json"], {
    encoding: "utf8",
  });
} catch (error) {
  output = error.stdout; // knip exits non-zero when it finds something
}
const { issues } = JSON.parse(output);
const size = (value) => (Array.isArray(value) ? value.length : Object.keys(value ?? {}).length);
const total = issues.reduce(
  (sum, issue) => sum + kinds.reduce((n, kind) => n + size(issue[kind]), 0),
  0,
);
console.log(total);
