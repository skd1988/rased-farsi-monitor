/**
 * =====================================================
 * INOREADER OAUTH MANAGER - Edge Function
 * AFTAB Intelligence System
 * =====================================================
 * 
 * مدیریت کامل OAuth 2.0 برای Inoreader:
 * 1. Authorization Flow
 * 2. Token Exchange
 * 3. Token Refresh
 * 4. Token Validation
 * 5. Disconnect (Safe)
 * 
 * Endpoint:
 * POST /functions/v1/inoreader-oauth-manager
 * Body: { action: 'authorize' | 'status' | 'exchange' | 'refresh' | 'validate' | 'ensure-valid' | 'disconnect' }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ensureValidInoreaderToken,
  getActiveInoreaderToken,
  refreshInoreaderToken,
  saveTokenRecord
} from "../_shared/inoreaderAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const TOKENS_TABLE = "inoreader_oauth_tokens";

// ⚙️ Inoreader OAuth Configuration
const INOREADER_CONFIG = {
  CLIENT_ID: Deno.env.get("INOREADER_CLIENT_ID"),
  CLIENT_SECRET: Deno.env.get("INOREADER_CLIENT_SECRET"),
  REDIRECT_URI:
    Deno.env.get("INOREADER_REDIRECT_URI") ||
    "https://skd1988.github.io/rased-farsi-monitor/oauth-callback",
  AUTH_URL: "https://www.inoreader.com/oauth2/auth",
  TOKEN_URL: "https://www.inoreader.com/oauth2/token",
  SCOPE: "read write"
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const queryAction = url.searchParams.get("action");

  let body: any = {};
  if (req.method !== "GET") {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  const action = queryAction || body.action;
  const { code, refreshToken } = body;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`🔐 Inoreader OAuth: Action = ${action}`);

    switch (action) {
      case "authorize":
        return handleAuthorize();

      case "status":
        return await safeHandleStatus(supabase);

      case "exchange":
        return await handleExchange(supabase, code);

      case "refresh":
        return await handleRefresh(supabase, refreshToken);

      case "validate":
        return await handleValidate(supabase);

      case "ensure-valid":
        return await handleEnsureValid(supabase);

      case "disconnect":
        return await handleDisconnect(supabase);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    console.error("❌ OAuth Error:", error);

    return jsonResponse(
      {
        success: false,
        error: error?.message || String(error),
        action
      },
      400
    );
  }
});

/* ------------------------------------------------------
 * Helper for JSON responses
 ------------------------------------------------------ */
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

/* ------------------------------------------------------
 * STEP 1: Authorization URL
 ------------------------------------------------------ */
function handleAuthorize() {
  const state = crypto.randomUUID();
  const authUrl = new URL(INOREADER_CONFIG.AUTH_URL);

  authUrl.searchParams.set("client_id", INOREADER_CONFIG.CLIENT_ID!);
  authUrl.searchParams.set("redirect_uri", INOREADER_CONFIG.REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", INOREADER_CONFIG.SCOPE);
  authUrl.searchParams.set("state", state);

  console.log("✅ Authorization URL generated:", authUrl.toString());

  return jsonResponse({
    success: true,
    authUrl: authUrl.toString(),
    state
  });
}

/* ------------------------------------------------------
 * STEP 1.5: Status (Safe)
 ------------------------------------------------------ */
async function safeHandleStatus(supabase: any) {
  try {
    return await handleStatus(supabase);
  } catch (err: any) {
    console.error("❌ Status check error:", err);
    return jsonResponse(
      {
        ok: false,
        isConnected: false,
        needsReconnect: true,
        error: err?.message || String(err)
      },
      200
    );
  }
}

async function handleStatus(supabase: any) {
  const status = await ensureValidInoreaderToken(supabase, 10);

  if (status.status === "not_connected") {
    return jsonResponse({
      connected: false,
      reason: "no_tokens",
      ok: true,
      isConnected: false,
      isExpired: false,
      needsReconnect: true,
      hasRefreshToken: false,
      canAutoRefresh: false,
      expiresAt: null,
      secondsToExpiry: null
    });
  }

  if (status.status === "refresh_failed") {
    return jsonResponse({
      connected: false,
      reason: "refresh_failed",
      ok: false,
      isConnected: false,
      isExpired: true,
      needsReconnect: true,
      hasRefreshToken: false,
      canAutoRefresh: false,
      expiresAt: null,
      secondsToExpiry: null
    });
  }

  const token = status.token;
  const now = new Date();
  const expiresAt = token.expires_at ? new Date(token.expires_at) : null;

  return jsonResponse({
    connected: true,
    ok: true,
    isConnected: true,
    isExpired: expiresAt ? expiresAt <= now : false,
    hasRefreshToken: !!token.refresh_token,
    canAutoRefresh: !!token.refresh_token,
    expiresAt: token.expires_at,
    secondsToExpiry: expiresAt
      ? Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
      : null
  });
}

/* ------------------------------------------------------
 * STEP 2: Exchange Code → Tokens
 ------------------------------------------------------ */
async function handleExchange(supabase: any, code: string) {
  if (!code) throw new Error("Authorization code is required");

  console.log("🔄 Exchanging code...");

  const tokenResponse = await fetch(INOREADER_CONFIG.TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: INOREADER_CONFIG.CLIENT_ID!,
      client_secret: INOREADER_CONFIG.CLIENT_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: INOREADER_CONFIG.REDIRECT_URI
    }).toString()
  });

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text();
    throw new Error(`Inoreader token exchange failed: ${err}`);
  }

  const tokens = await tokenResponse.json();

  const tokenRecord = await saveTokenRecord(supabase, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
    token_type: tokens.token_type,
    scope: tokens.scope
  });

  console.log("✅ Tokens saved");

  return jsonResponse({
    success: true,
    message: "اتصال Inoreader با موفقیت برقرار شد",
    expiresAt: tokenRecord.expires_at,
    hasRefreshToken: !!tokens.refresh_token
  });
}

/* ------------------------------------------------------
 * STEP 3: Refresh token
 ------------------------------------------------------ */
async function handleRefresh(supabase: any, providedRefreshToken: string) {
  console.log("🔄 Refreshing...");

  const activeToken = await getActiveInoreaderToken(supabase);

  const finalToken = {
    ...activeToken,
    refresh_token: providedRefreshToken || activeToken.refresh_token
  };

  const updatedToken = await refreshInoreaderToken(supabase, finalToken);

  return jsonResponse({
    success: true,
    message: "توکن تمدید شد",
    expiresAt: updatedToken.expires_at
  });
}

/* ------------------------------------------------------
 * STEP 4: Validate
 ------------------------------------------------------ */
async function handleValidate(supabase: any) {
  console.log("🔍 Validating...");

  try {
    const token = await getActiveInoreaderToken(supabase);

    const now = new Date();
    const expiresAt = token.expires_at ? new Date(token.expires_at) : null;

    return jsonResponse({
      success: true,
      isValid: expiresAt ? expiresAt > now : true,
      needsRefresh: expiresAt
        ? expiresAt <= new Date(now.getTime() + 3600000)
        : false,
      expiresAt: token.expires_at,
      hasRefresh: !!token.refresh_token
    });
  } catch (err: any) {
    return jsonResponse(
      {
        success: false,
        isValid: false,
        message: err?.message || "هیچ توکن فعالی یافت نشد"
      },
      200
    );
  }
}

/* ------------------------------------------------------
 * STEP 5: Ensure Valid
 ------------------------------------------------------ */
async function handleEnsureValid(supabase: any) {
  const status = await ensureValidInoreaderToken(supabase);

  if (status.status !== "ok") {
    return jsonResponse(
      { success: false, error: "No valid token" },
      400
    );
  }

  const token = status.token;

  return jsonResponse({
    success: true,
    expiresAt: token.expires_at
  });
}

/* ------------------------------------------------------
 * STEP 6: Disconnect (Safe)
 ------------------------------------------------------ */
async function handleDisconnect(supabase: any) {
  console.log("🔌 Disconnecting...");

  // 1) Session update (ignored safely)
  try {
    const { error: sessionError } = await supabase
      .from("inoreader_oauth_sessions")
      .update({ is_active: false })
      .neq("is_active", false);

    if (sessionError) {
      console.warn("⚠ session update warning:", sessionError);
    }
  } catch (err) {
    console.warn("⚠ session update failed:", err);
  }

  // 2) Token deletion (non fatal)
  let warning: any = null;

  try {
    const { error: tokenError } = await supabase
      .from(TOKENS_TABLE)
      .delete();

    if (tokenError) {
      console.warn("⚠ token delete warning:", tokenError);
      warning = tokenError;
    }
  } catch (err: any) {
    console.warn("⚠ token delete failed:", err);
    warning = err;
  }

  return jsonResponse({
    success: !warning,
    warning: warning
      ? {
          message: warning?.message || String(warning),
          code: warning?.code || null
        }
      : null,
    message: warning
      ? "اتصال قطع شد (با هشدار)"
      : "اتصال قطع شد"
  });
}
