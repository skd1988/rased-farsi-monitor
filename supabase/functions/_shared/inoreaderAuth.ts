import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface InoreaderTokenRecord {
  id: string;
  user_id?: string;
  access_token: string;
  refresh_token: string | null;
  token_type?: string | null;
  scope?: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  last_refresh_at?: string | null;
  [key: string]: any;
}

const INOREADER_CONFIG = {
  CLIENT_ID: Deno.env.get("INOREADER_CLIENT_ID"),
  CLIENT_SECRET: Deno.env.get("INOREADER_CLIENT_SECRET"),
  TOKEN_URL: "https://www.inoreader.com/oauth2/token",
};

if (!INOREADER_CONFIG.CLIENT_ID || !INOREADER_CONFIG.CLIENT_SECRET) {
  console.warn("[Inoreader] Missing CLIENT_ID or CLIENT_SECRET env variables");
}

export const getServiceSupabaseClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

export async function getActiveInoreaderToken(
  supabase: SupabaseClient<any, any, any>
): Promise<InoreaderTokenRecord> {
  const { data, error } = await supabase
    .from("inoreader_oauth_tokens")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    console.error("[Inoreader] No active token found", error);
    throw new Error("No active Inoreader token found");
  }

  return data as InoreaderTokenRecord;
}

export async function refreshInoreaderToken(
  supabase: SupabaseClient<any, any, any>,
  tokenRecord: InoreaderTokenRecord
): Promise<InoreaderTokenRecord> {
  console.log("[Inoreader] Refreshing access token...");

  const refreshToken = tokenRecord.refresh_token;

  if (!refreshToken) {
    throw new Error("No refresh token available for Inoreader");
  }

  const response = await fetch(INOREADER_CONFIG.TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: INOREADER_CONFIG.CLIENT_ID || "",
      client_secret: INOREADER_CONFIG.CLIENT_SECRET || "",
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const lowerError = errorText.toLowerCase();
    console.error("[Inoreader] Token refresh failed", errorText);

    if (
      response.status === 400 ||
      response.status === 401 ||
      lowerError.includes("invalid_grant")
    ) {
      const userId = tokenRecord.user_id;

      if (userId) {
        await supabase
          .from('inoreader_oauth_sessions')
          .update({ is_active: false })
          .eq('user_id', userId);

        await supabase
          .from('inoreader_oauth_tokens')
          .delete()
          .eq('user_id', userId);
      }

      throw new Error('inoreader_disconnected');
    }

    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const tokens = await response.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const now = new Date().toISOString();

  const updates = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || refreshToken,
    expires_at: expiresAt,
    last_refresh_at: now,
    updated_at: now,
    token_type: tokens.token_type ?? tokenRecord.token_type,
    scope: tokens.scope ?? tokenRecord.scope,
  };

  const { data, error } = await supabase
    .from("inoreader_oauth_tokens")
    .update(updates)
    .eq("id", tokenRecord.id)
    .select()
    .single();

  if (error || !data) {
    console.error("[Inoreader] Failed to update refreshed token", error);
    throw new Error("Failed to update refreshed token");
  }

  console.log("[Inoreader] Token refreshed successfully", {
    expires_at: expiresAt,
    has_new_refresh_token: !!tokens.refresh_token,
  });

  return data as InoreaderTokenRecord;
}

export async function ensureValidInoreaderToken(
  supabase: SupabaseClient<any, any, any>,
  safetyWindowMinutes = 5
): Promise<InoreaderTokenRecord> {
  console.log("[Inoreader] Ensuring token validity...");
  const token = await getActiveInoreaderToken(supabase);

  if (!token.expires_at) {
    console.log("[Inoreader] Token has no expiry, returning current token");
    return token;
  }

  const expiresAt = new Date(token.expires_at);
  const now = Date.now();
  const timeLeftMs = expiresAt.getTime() - now;
  const safetyWindowMs = safetyWindowMinutes * 60 * 1000;

  if (timeLeftMs > safetyWindowMs) {
    console.log(
      `[Inoreader] Token still valid, time left: ${Math.round(timeLeftMs / 1000)} seconds`
    );
    return token;
  }

  console.log("[Inoreader] Token near expiry or expired, refreshing...");
  return await refreshInoreaderToken(supabase, token);
}
