import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = fs.readFileSync(path.join(packageRoot, "src/App.tsx"), "utf8");
const recallPath = path.join(packageRoot, "src/components/ClientRecall.tsx");

test("topbar fast recall is a real client search component", () => {
  assert.ok(fs.existsSync(recallPath), "ClientRecall component should exist");
  assert.match(appSource, /import ClientRecall from "\.\/components\/ClientRecall"/);
  assert.match(appSource, /<ClientRecall \/>/);
  assert.doesNotMatch(appSource, /Fast recall ready/, "topbar should not render a static placeholder");
});

test("client recall searches cached members and hydrates selected client history", () => {
  const source = fs.readFileSync(recallPath, "utf8");

  assert.match(source, /ADMIN_MEMBERS_CACHE_KEY/, "recall should use the warmed full members cache");
  assert.match(source, /MEMBER_OPTIONS_CACHE_KEY/, "recall should fall back to warmed lightweight member options");
  assert.match(source, /api\.get\("\/users"\)/, "recall should refresh member search data from the users endpoint");
  assert.match(source, /\/users\/\$\{selectedClient\.id\}\/payments/, "recall should load selected client payment history");
  assert.match(source, /\/users\/\$\{selectedClient\.id\}\/workout-logs/, "recall should load selected client workout history");
  assert.match(source, /client-recall-input/, "recall should expose a typed search input in the topbar");
  assert.match(source, /client-recall-history/, "recall should render a selected client history panel");
});
