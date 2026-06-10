const RETRY_AFTER_SECONDS_REGEX = /after\s+(\d+)\s+seconds?/i;

export function extractRetryAfterSeconds(message, fallbackSeconds = 60) {
  const text = (message || "").trim();
  const match = text.match(RETRY_AFTER_SECONDS_REGEX);

  if (!match) {
    return { seconds: fallbackSeconds, derivedFromMessage: false };
  }

  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { seconds: fallbackSeconds, derivedFromMessage: false };
  }

  return { seconds: parsed, derivedFromMessage: true };
}

export function getSecondsRemaining(untilMs, nowMs = Date.now()) {
  if (!untilMs) return 0;
  const remainingMs = untilMs - nowMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}
