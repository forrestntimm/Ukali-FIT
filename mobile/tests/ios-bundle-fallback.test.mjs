import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mobileRoot = path.resolve(__dirname, "..");

test("iOS debug bridge URL has embedded main.jsbundle fallback", () => {
  const iosRoot = path.join(mobileRoot, "ios");
  const appDelegatePath = fs
    .readdirSync(iosRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(iosRoot, entry.name, "AppDelegate.mm"))
    .find((candidate) => fs.existsSync(candidate));

  assert.ok(appDelegatePath, "ios should contain a generated AppDelegate.mm for the active variant");

  const source = fs.readFileSync(appDelegatePath, "utf8");

  assert.match(source, /jsBundleURLForBundleRoot:@\"\.expo\/\.virtual-metro-entry\"/, "AppDelegate should load the Expo debug entrypoint");
  assert.match(source, /fallbackURLProvider:\^NSURL \*/, "AppDelegate debug bundle URL should include a fallbackURLProvider block");
  assert.match(
    source,
    /URLForResource:@\"main\"\s+withExtension:@\"jsbundle\"/,
    "AppDelegate fallbackURLProvider should return the embedded main.jsbundle"
  );
});

test("iOS debug build unsets SKIP_BUNDLING so fallback bundle exists", () => {
  const updatesPath = path.join(mobileRoot, "ios", ".xcode.env.updates");
  const runnerPath = path.join(mobileRoot, "scripts", "run-variant.sh");
  const generatedSource = fs.existsSync(updatesPath) ? fs.readFileSync(updatesPath, "utf8") : "";
  const runnerSource = fs.readFileSync(runnerPath, "utf8");

  if (generatedSource) {
    assert.match(
      generatedSource,
      /CONFIGURATION[\s\S]*Debug[\s\S]*unset\s+SKIP_BUNDLING/,
      "ios/.xcode.env.updates should unset SKIP_BUNDLING only for Debug builds"
    );
    return;
  }

  assert.match(
    runnerSource,
    /unset\s+SKIP_BUNDLING/,
    "run-variant.sh should restore the Debug bundling safeguard even while ios/ is being regenerated"
  );
});

test("variant runner reapplies iOS fallback safeguards after prebuild", () => {
  const runnerPath = path.join(mobileRoot, "scripts", "run-variant.sh");
  const source = fs.readFileSync(runnerPath, "utf8");

  assert.match(
    source,
    /ensure_ios_debug_bundle_fallback\(\)/,
    "run-variant.sh should define ensure_ios_debug_bundle_fallback()"
  );
  assert.match(
    source,
    /ensure_native_variant "ios"[\s\S]*ensure_ios_debug_bundle_fallback/,
    "run-variant.sh should call ensure_ios_debug_bundle_fallback in iOS startup flow"
  );
  assert.match(
    source,
    /for app_delegate in "\$\{project_root\}"\/ios\/\*\/AppDelegate\.mm/,
    "run-variant.sh should patch whichever iOS AppDelegate Expo generated for the active variant"
  );
});
