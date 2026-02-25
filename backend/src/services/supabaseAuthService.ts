import { createClient, User } from "@supabase/supabase-js";
import { config } from "../utils/config";
import {
  createUser,
  getUserById,
  getUserAuthIdentityById,
  getUserForAuthByEmail,
  getUserForAuthBySupabaseId,
  linkSupabaseUser,
  markAuthSuccess,
  markInviteSent
} from "./userService";

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
};

const supabaseAdmin =
  config.supabaseUrl && config.supabaseServiceRoleKey
    ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, clientOptions)
    : null;

const supabasePublic =
  config.supabaseUrl && config.supabaseAnonKey
    ? createClient(config.supabaseUrl, config.supabaseAnonKey, clientOptions)
    : null;

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured");
  }
  return supabaseAdmin;
}

function requirePublicClient() {
  if (!supabasePublic) {
    throw new Error("Supabase public client is not configured");
  }
  return supabasePublic;
}

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export async function getSupabaseUserFromToken(accessToken: string): Promise<User | null> {
  const client = requireAdminClient();
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user;
}

export async function resolveLocalUserFromSupabaseToken(
  accessToken: string,
  options: { markLogin?: boolean } = {}
) {
  const supabaseUser = await getSupabaseUserFromToken(accessToken);
  if (!supabaseUser) {
    return { error: "AUTH_UNAUTHORIZED" as const };
  }

  const email = supabaseUser.email?.toLowerCase();
  if (!email) {
    return { error: "AUTH_UNAUTHORIZED" as const };
  }

  let localAuthUser = await getUserForAuthBySupabaseId(supabaseUser.id);
  if (!localAuthUser) {
    localAuthUser = await getUserForAuthByEmail(email);
    if (!localAuthUser) {
      const metadataNameCandidates = [
        supabaseUser.user_metadata?.full_name,
        supabaseUser.user_metadata?.name
      ];
      const metadataName = metadataNameCandidates.find(
        (candidate) => typeof candidate === "string" && candidate.trim().length > 0
      ) as string | undefined;
      const fallbackName = metadataName || email.split("@")[0];

      await createUser({
        name: fallbackName,
        email
      });
      localAuthUser = await getUserForAuthByEmail(email);
    }

    if (!localAuthUser) {
      return { error: "AUTH_ACCOUNT_NOT_PROVISIONED" as const };
    }

    if (localAuthUser.supabaseUserId && localAuthUser.supabaseUserId !== supabaseUser.id) {
      return { error: "AUTH_UNAUTHORIZED" as const };
    }

    if (!localAuthUser.supabaseUserId) {
      await linkSupabaseUser(localAuthUser.id, supabaseUser.id);
    }
  }

  if (options.markLogin) {
    await markAuthSuccess(localAuthUser.id);
  }

  const user = await getUserById(localAuthUser.id);
  if (!user) {
    return { error: "AUTH_UNAUTHORIZED" as const };
  }

  return {
    user,
    authUser: {
      id: localAuthUser.id,
      role: localAuthUser.role,
      email: localAuthUser.email
    }
  };
}

export async function sendInviteEmail(email: string, redirectTo = config.mobileCallbackUrl) {
  const client = requireAdminClient();
  const normalizedEmail = email.toLowerCase();
  const { error } = await client.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo
  });

  if (error) {
    throw new Error(error.message);
  }

  const authUser = await getUserForAuthByEmail(normalizedEmail);
  if (authUser) {
    await markInviteSent(authUser.id);
  }
}

export async function resendMagicLink(email: string, redirectTo = config.mobileCallbackUrl) {
  const client = requirePublicClient();
  const normalizedEmail = email.toLowerCase();
  const { error } = await client.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  const authUser = await getUserForAuthByEmail(normalizedEmail);
  if (authUser) {
    await markInviteSent(authUser.id);
  }
}

export async function setSupabasePasswordForLocalUser(localUserId: string, password: string) {
  const client = requireAdminClient();
  const authIdentity = await getUserAuthIdentityById(localUserId);
  if (!authIdentity?.supabaseUserId) {
    throw new Error("No Supabase identity linked to this account.");
  }

  const { error } = await client.auth.admin.updateUserById(authIdentity.supabaseUserId, {
    password
  });

  if (error) {
    throw new Error(error.message);
  }
}
