import assert from "node:assert/strict";
import test from "node:test";
import { extractRetryAfterSeconds, getSecondsRemaining } from "../src/utils/rate-limit.js";

test("extractRetryAfterSeconds parses explicit seconds from provider message", () => {
  const result = extractRetryAfterSeconds("For security purposes, you can only request this after 43 seconds.", 60);

  assert.equal(result.seconds, 43);
  assert.equal(result.derivedFromMessage, true);
});

test("extractRetryAfterSeconds uses fallback when no seconds are present", () => {
  const result = extractRetryAfterSeconds("email rate limit exceeded", 60);

  assert.equal(result.seconds, 60);
  assert.equal(result.derivedFromMessage, false);
});

test("getSecondsRemaining rounds up and never returns negative values", () => {
  const nowMs = 1_000;

  assert.equal(getSecondsRemaining(4_999, nowMs), 4);
  assert.equal(getSecondsRemaining(1_000, nowMs), 0);
  assert.equal(getSecondsRemaining(500, nowMs), 0);
});
