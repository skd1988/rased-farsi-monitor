import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface InoreaderTokenRecord {
  id: string;
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

export async function loadLatestTokenRecord(
  supabase: SupabaseClient<any, any, any>
): Promise<InoreaderTokenRecord | null> {
  const { data, error } = await supabase
    .from('inoreader_oauth_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if ((error as any).code === 'PGRST204') {
      console.error(
        '[Inoreader] Schema mismatch for inoreader_oauth_tokens (probably user_id does not exist)'
      );
    }
    console.error('[Inoreader] Failed to load latest token', {
      code: (error as any).code,
      message: error.message,
    });
    return null;
  }

  if (!data) {
    console.warn('[Inoreader] No token records found');
    return null;
  }

  return data as InoreaderTokenRecord;
}

export async function saveTokenRecord(
  supabase: SupabaseClient<any, any, any>,
  tokens: { access_token: string; refresh_token?: string | null; expires_in: number; token_type?: string; scope?: string }
): Promise<InoreaderTokenRecord> {
  const { access_token, refresh_token, expires_in, token_type, scope } = tokens;
  const now = new Date().toISOString();
  const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

  // Deactivate previous tokens (global scope)
  const { error: deactivateError } = await supabase
    .from('inoreader_oauth_tokens')
    .update({ is_active: false })
    .neq('is_active', false);

  if (deactivateError) {
    console.error('[Inoreader] Failed to deactivate previous tokens', {
      code: (deactivateError as any).code,
      message: deactivateError.message,
    });
  }

  const { data, error } = await supabase
    .from('inoreader_oauth_tokens')
    .insert({
      access_token,
      refresh_token: refresh_token ?? null,
      expires_at,
      is_active: true,
      last_refresh_at: now,
      token_type: token_type ?? null,
      scope: scope ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    if ((error as any)?.code === 'PGRST204') {
      console.error(
        '[Inoreader] Schema mismatch for inoreader_oauth_tokens (probably user_id does not exist)'
      );
    }
    console.error('[Inoreader] Failed to save token record', {
      code: (error as any)?.code,
      message: error?.message,
    });
    throw new Error('Failed to save Inoreader token record');
  }

  return data as InoreaderTokenRecord;
}

export async function markTokenError(
  supabase: SupabaseClient<any, any, any>,
  message: string
) {
  const latest = await loadLatestTokenRecord(supabase);
  if (!latest) return;

  const { error } = await supabase
    .from('inoreader_oauth_tokens')
    .update({ is_active: false, last_error: message })
    .eq('id', latest.id);

  if (error) {
    if ((error as any).code === 'PGRST204') {
      console.error(
        '[Inoreader] Schema mismatch for inoreader_oauth_tokens (probably user_id does not exist)'
      );
    }
    console.error('[Inoreader] Failed to mark token error', {
      code: (error as any).code,
      message: error.message,
    });
  }
}

export async function getActiveInoreaderToken(
  supabase: SupabaseClient<any, any, any>
): Promise<InoreaderTokenRecord> {
  const latest = await loadLatestTokenRecord(supabase);

  if (!latest) {
    throw new Error('No active Inoreader token found');
  }

  return latest;
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
      await markTokenError(supabase, 'invalid_grant');
      throw new Error('inoreader_disconnected');
    }

    await markTokenError(supabase, errorText);
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const tokens = await response.json();
  const newToken = await saveTokenRecord(supabase, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || refreshToken,
    expires_in: tokens.expires_in,
    token_type: tokens.token_type ?? tokenRecord.token_type,
    scope: tokens.scope ?? tokenRecord.scope,
  });

  console.log("[Inoreader] Token refreshed successfully", {
    expires_at: newToken.expires_at,
    has_new_refresh_token: !!tokens.refresh_token,
  });

  return newToken;
}

export async function ensureValidInoreaderToken(
  supabase: SupabaseClient<any, any, any>,
  safetyWindowMinutes = 5
): Promise<
  | { status: 'ok'; token: InoreaderTokenRecord; accessToken: string }
  | { status: 'not_connected' }
  | { status: 'refresh_failed'; error?: string }
> {
  console.log("[Inoreader] Ensuring token validity...");
  const token = await loadLatestTokenRecord(supabase);

  if (!token) {
    return { status: 'not_connected' };
  }

  if (!token.expires_at) {
    console.log("[Inoreader] Token has no expiry, returning current token");
    return { status: 'ok', token, accessToken: token.access_token };
  }

  const expiresAt = new Date(token.expires_at);
  const now = Date.now();
  const timeLeftMs = expiresAt.getTime() - now;
  const safetyWindowMs = safetyWindowMinutes * 60 * 1000;

  if (timeLeftMs > safetyWindowMs) {
    console.log(
      `[Inoreader] Token still valid, time left: ${Math.round(timeLeftMs / 1000)} seconds`
    );
    return { status: 'ok', token, accessToken: token.access_token };
  }

  console.log("[Inoreader] Token near expiry or expired, refreshing...");
  try {
    const refreshed = await refreshInoreaderToken(supabase, token);
    return { status: 'ok', token: refreshed, accessToken: refreshed.access_token };
  } catch (error: any) {
    console.error('[Inoreader] Failed to refresh token', error);
    return { status: 'refresh_failed', error: error?.message };
  }
}
