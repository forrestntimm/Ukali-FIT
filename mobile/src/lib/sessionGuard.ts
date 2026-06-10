import type { Session } from "@supabase/supabase-js";

type SessionResult = {
  data: {
    session: Session | null;
  };
  error: unknown | null;
};

type SessionClient = {
  auth: {
    getSession: () => Promise<SessionResult>;
    signOut: (options?: { scope?: "global" | "local" | "others" }) => Promise<unknown>;
  };
};

const INVALID_REFRESH_TOKEN_PATTERNS = [
  /Invalid Refresh Token/i,
  /Refresh Token Not Found/i
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

export function isInvalidRefreshTokenError(error: unknown) {
  const message = getErrorMessage(error);
  return INVALID_REFRESH_TOKEN_PATTERNS.some((pattern) => pattern.test(message));
}

async function signOutLocally(client: SessionClient) {
  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    // Ignore cleanup failures and continue in a logged-out state.
  }
}

export async function safeClearSession(client: SessionClient) {
  try {
    const result = await client.auth.signOut();
    const error = typeof result === "object" && result && "error" in result ? (result as { error?: unknown }).error : null;
    if (error) {
      throw error;
    }
  } catch {
    await signOutLocally(client);
  }
}

export async function safeGetSession(client: SessionClient): Promise<SessionResult> {
  try {
    return await client.auth.getSession();
  } catch (error) {
    if (__DEV__) {
      const message = getErrorMessage(error);
      console.warn(
        isInvalidRefreshTokenError(error)
          ? `[auth] Clearing stale refresh token after getSession failure: ${message || "unknown auth error"}`
          : `[auth] Falling back to a logged-out state after getSession failure: ${message || "unknown session error"}`
      );
    }

    await safeClearSession(client);

    return {
      data: { session: null },
      error: null
    };
  }
}
