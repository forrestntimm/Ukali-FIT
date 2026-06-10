export type AthleteProfileCandidate = {
  role: "ADMIN" | "MEMBER";
  inviteAcceptedAt?: string | null;
  lastLoginAt?: string | null;
};

export function hasRealAthleteProfile(user: AthleteProfileCandidate) {
  if (user.role !== "MEMBER") return false;
  return Boolean(user.inviteAcceptedAt || user.lastLoginAt);
}

export function filterRealAthleteProfiles<T extends AthleteProfileCandidate>(users: T[]) {
  return users.filter(hasRealAthleteProfile);
}
