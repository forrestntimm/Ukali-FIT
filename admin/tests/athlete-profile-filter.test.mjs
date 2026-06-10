import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import { hasRealAthleteProfile, filterRealAthleteProfiles } from "../src/utils/athleteProfiles.ts";

test("hasRealAthleteProfile only keeps members who have activated the app", () => {
  assert.equal(
    hasRealAthleteProfile({
      role: "MEMBER",
      inviteAcceptedAt: "2026-03-27T00:00:00.000Z",
      lastLoginAt: null
    }),
    true
  );

  assert.equal(
    hasRealAthleteProfile({
      role: "MEMBER",
      inviteAcceptedAt: null,
      lastLoginAt: "2026-03-27T00:00:00.000Z"
    }),
    true
  );

  assert.equal(
    hasRealAthleteProfile({
      role: "MEMBER",
      inviteAcceptedAt: null,
      lastLoginAt: null
    }),
    false
  );

  assert.equal(
    hasRealAthleteProfile({
      role: "ADMIN",
      inviteAcceptedAt: "2026-03-27T00:00:00.000Z",
      lastLoginAt: "2026-03-27T00:00:00.000Z"
    }),
    false
  );
});

test("filterRealAthleteProfiles keeps only activated athletes", () => {
  const users = [
    { id: "1", name: "Ready Athlete", role: "MEMBER", inviteAcceptedAt: "2026-03-27T00:00:00.000Z", lastLoginAt: null },
    { id: "2", name: "Invite Only", role: "MEMBER", inviteAcceptedAt: null, lastLoginAt: null },
    { id: "3", name: "Coach", role: "ADMIN", inviteAcceptedAt: "2026-03-27T00:00:00.000Z", lastLoginAt: "2026-03-27T00:00:00.000Z" }
  ];

  assert.deepEqual(
    filterRealAthleteProfiles(users).map((user) => user.name),
    ["Ready Athlete"]
  );
});

test("dashboard stats only count activated athletes", () => {
  const source = fs.readFileSync(
    "/Users/forresttimm/Documents/Ukali sign in app/admin/src/pages/DashboardPage.tsx",
    "utf8"
  );

  assert.match(
    source,
    /const athletes = filterRealAthleteProfiles\(users\)/,
    "dashboard should filter out invite-only athletes before calculating counts"
  );
});
