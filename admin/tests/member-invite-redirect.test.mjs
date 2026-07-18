import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const membersPagePath = path.resolve(
  path.join(packageRoot, "src/pages/MembersPage.tsx")
);

test("member invites use the athlete app callback instead of the admin web callback", () => {
  const source = fs.readFileSync(membersPagePath, "utf8");

  assert.doesNotMatch(
    source,
    /window\.location\.origin}\/auth\/callback/,
    "MembersPage should not send athlete invites to the admin web auth callback"
  );
});
