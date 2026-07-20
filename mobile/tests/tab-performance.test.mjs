import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const athleteRootPath = path.join(packageRoot, "src/app/AthleteRoot.tsx");
const coachRootPath = path.join(packageRoot, "src/app/CoachRoot.tsx");
const authContextPath = path.join(packageRoot, "src/context/AuthContext.tsx");
const adminScanPath = path.join(packageRoot, "src/screens/AdminScanScreen.tsx");

test("both tab navigators mount every tab up front so switches never pay a mount penalty", () => {
  for (const [label, filePath] of [
    ["athlete", athleteRootPath],
    ["coach", coachRootPath]
  ]) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.match(
      source,
      /lazy:\s*false/,
      `${label} tab options should disable lazy mounting for instant tab switches`
    );
    assert.match(
      source,
      /detachInactiveScreens=\{false\}/,
      `${label} tabs should stay mounted while inactive`
    );
  }
});

test("sign-in shows the cached profile immediately and refreshes it in the background", () => {
  const source = fs.readFileSync(authContextPath, "utf8");

  assert.match(
    source,
    /getSafeCachedUserForSession\(await restoreCachedUser\(\), session\)/,
    "bootstrap should look for a safe cached profile before hitting the network"
  );
  assert.match(
    source,
    /void syncUserFromServer\(session\)/,
    "bootstrap should refresh a cache-hydrated profile in the background instead of blocking"
  );
  assert.match(
    source,
    /cachedUser\.supabaseUserId && cachedUser\.supabaseUserId === session\.user\.id/,
    "cached profile matching should compare the stored Supabase id, not the local profile id"
  );
  assert.doesNotMatch(
    source,
    /cachedUser\.user\.id === session\.user\.id/,
    "cached profile matching must not compare the local profile id against the Supabase auth id"
  );
});

test("explicit user refreshes bypass the cache so saved edits are never resurfaced stale", () => {
  const source = fs.readFileSync(authContextPath, "utf8");
  const refreshBlock = source.match(/const refreshUser = useCallback\([\s\S]*?\n  \}, \[/)?.[0] ?? "";

  assert.match(
    refreshBlock,
    /await syncUserFromServer\(data\.session\)/,
    "refreshUser should await the network sync directly"
  );
});

test("scan screen roster polling is silent and does not flash loading state", () => {
  const source = fs.readFileSync(adminScanPath, "utf8");

  assert.match(
    source,
    /setInterval\(\(\) => \{\s*void loadClassRoster\(selectedClassId, \{ silent: true \}\);/s,
    "background roster polling should use the silent option"
  );
  assert.match(
    source,
    /if \(!options\.silent\) setLoadingRoster\(true\);/,
    "roster loads should only toggle the spinner for non-silent loads"
  );
  assert.match(
    source,
    /setLoadingClasses\(\(current\) => current \|\| classes\.length === 0\);/,
    "class list refreshes should only show a spinner when nothing is on screen yet"
  );
});
