import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthToken } from "../src/utils/auth-token.js";

test("resolveAuthToken prefers local storage token when present", () => {
  const token = resolveAuthToken("local-token", "session-token");
  assert.equal(token, "local-token");
});

test("resolveAuthToken falls back to session token when local token missing", () => {
  const token = resolveAuthToken("", "session-token");
  assert.equal(token, "session-token");
});

test("resolveAuthToken returns null when both tokens are missing", () => {
  const token = resolveAuthToken("", "");
  assert.equal(token, null);
});
