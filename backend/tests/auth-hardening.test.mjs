import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const backendRoot = path.resolve("/Users/forresttimm/Documents/Ukali sign in app/backend");
const configPath = path.join(backendRoot, "src", "utils", "config.ts");
const rateLimitPath = path.join(backendRoot, "src", "middleware", "rateLimit.ts");
const authRoutesPath = path.join(backendRoot, "src", "routes", "auth.ts");
const userRoutesPath = path.join(backendRoot, "src", "routes", "users.ts");
const errorMiddlewarePath = path.join(backendRoot, "src", "middleware", "error.ts");

test("backend CORS config no longer defaults production browser access to wildcard", () => {
  const source = fs.readFileSync(configPath, "utf8");

  assert.doesNotMatch(
    source,
    /process\.env\.CORS_ORIGIN\s*\|\|\s*"\*"/,
    "CORS_ORIGIN should not fall back to a wildcard because that silently fails open"
  );
  assert.match(
    source,
    /nodeEnv\s*===\s*"development"/,
    "config should explicitly distinguish development CORS defaults from non-development behavior"
  );
});

test("backend exposes dedicated limiters for OTP and password-sensitive flows", () => {
  const rateLimitSource = fs.readFileSync(rateLimitPath, "utf8");
  const authRoutesSource = fs.readFileSync(authRoutesPath, "utf8");
  const userRoutesSource = fs.readFileSync(userRoutesPath, "utf8");

  assert.match(rateLimitSource, /export const otpLimiter\s*=\s*rateLimit\(/, "rate-limit middleware should expose an OTP/invite limiter");
  assert.match(
    rateLimitSource,
    /export const passwordLimiter\s*=\s*rateLimit\(/,
    "rate-limit middleware should expose a password-sensitive limiter"
  );
  assert.match(
    userRoutesSource,
    /router\.post\("\/invite",\s*requireAuth,\s*requireRole\("ADMIN"\),\s*otpLimiter,/s,
    "invite route should be protected by the OTP limiter"
  );
  assert.match(
    userRoutesSource,
    /router\.post\("\/:id\/resend-invite",\s*requireAuth,\s*requireRole\("ADMIN"\),\s*otpLimiter,/s,
    "invite resend route should be protected by the OTP limiter"
  );
  assert.match(
    userRoutesSource,
    /router\.post\("\/me\/password",\s*requireAuth,\s*passwordLimiter,\s*validate\(updateMyPasswordSchema\)/s,
    "password update route should be protected by the password-sensitive limiter"
  );
  assert.match(
    authRoutesSource,
    /router\.post\("\/login",\s*authLimiter,\s*validate\(loginSchema\)/s,
    "break-glass password login should keep the auth limiter"
  );
});

test("500-level backend errors do not return raw internal messages to clients", () => {
  const source = fs.readFileSync(errorMiddlewarePath, "utf8");

  assert.match(
    source,
    /status\s*>=\s*500\s*\?\s*"Internal server error"/,
    "error middleware should mask raw internal messages for 500-level responses"
  );
  assert.doesNotMatch(
    source,
    /res\.status\(status\)\.json\(\{\s*code,\s*message\s*\}\)/,
    "error middleware should not directly echo the raw error message for every status"
  );
});

test("invite and web-approval routes return minimal operational responses instead of full user payloads", () => {
  const source = fs.readFileSync(userRoutesPath, "utf8");

  assert.match(
    source,
    /invite:\s*{\s*sent:\s*true,\s*redirectTo,\s*userId:\s*user\.id,\s*email:\s*normalizedEmail\s*}/s,
    "invite route should return only the fields the caller needs instead of echoing a full user record"
  );
  assert.match(
    source,
    /approval:\s*{\s*approved:\s*true,\s*alreadyApproved:\s*true,\s*userId:\s*targetUserId\s*}/s,
    "already-approved response should return a minimal approval payload"
  );
  assert.match(
    source,
    /approval:\s*{\s*approved:\s*true,\s*approvedByUserId:\s*approverId\s*}/s,
    "approval success response should return a minimal approval payload"
  );
});

test("self-serve profile updates allow changing the member name without exposing unrelated fields", () => {
  const routesSource = fs.readFileSync(userRoutesPath, "utf8");

  assert.match(
    routesSource,
    /const updateMeSchema = z\.object\(\{\s*body:\s*z\.object\(\{[\s\S]*name:\s*z\.string\(\)\.min\(2\)\.max\(120\)\.optional\(\)/s,
    "update-me schema should allow the profile editor to save a display name"
  );
  assert.match(
    routesSource,
    /router\.patch\("\/me",[\s\S]*name:\s*data\.name,[\s\S]*profileImageDataUrl:\s*data\.profileImageDataUrl,[\s\S]*age:\s*data\.age,[\s\S]*fitnessGoals:\s*data\.fitnessGoals/s,
    "self-serve profile updates should pass the edited name through alongside the existing age/goals/photo fields"
  );
  assert.match(
    routesSource,
    /personalRecords:\s*personalRecordsSchema/,
    "update-me schema should allow the profile screen to save personal record fields"
  );
  assert.match(
    routesSource,
    /router\.patch\("\/me",[\s\S]*personalRecords:\s*data\.personalRecords/s,
    "self-serve profile updates should pass personal record values through with the rest of the profile payload"
  );
});
