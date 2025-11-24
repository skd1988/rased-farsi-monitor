/**
 * =====================================================
 * INOREADER OAUTH MANAGER - Edge Function
 * سیستم AFTAB Intelligence System
 * =====================================================
 * 
 * مدیریت کامل OAuth 2.0 برای Inoreader:
 * 1. Authorization Flow
 * 2. Token Exchange
 * 3. Token Refresh
 * 4. Token Validation
 * 
 * استفاده:
 * POST /inoreader-oauth-manager
 * Body: { action: 'authorize' | 'exchange' | 'refresh' | 'validate' }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ensureValidInoreaderToken,
  getActiveInoreaderToken,
  refreshInoreaderToken,
  saveTokenRecord
} from "../_shared/inoreaderAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOKENS_TABLE = 'inoreader_oauth_tokens';

// ⚙️ Inoreader OAuth Configuration
const INOREADER_CONFIG = {
  CLIENT_ID: Deno.env.get("INOREADER_CLIENT_ID")!,
  CLIENT_SECRET: Deno.env.get("INOREADER_CLIENT_SECRET")!,
  REDIRECT_URI: Deno.env.get("INOREADER_REDIRECT_URI") || "https://skd1988.github.io/rased-farsi-monitor/settings",
  AUTH_URL: "https://www.inoreader.com/oauth2/auth",
  TOKEN_URL: "https://www.inoreader.com/oauth2/token",
  SCOPE: "read write"
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const queryAction = url.searchParams.get('action');
  let body: any = {};

  if (req.method !== 'GET') {
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
      case 'authorize':
        return handleAuthorize();

      case 'status': {
        try {
          return await handleStatus(supabase);
        } catch (err) {
          console.error('Inoreader status error', err);

          const payload = {
            ok: false,
            isConnected: false,
            isExpired: false,
            needsReconnect: true,
            hasRefreshToken: false,
            canAutoRefresh: false,
            expiresAt: null,
            secondsToExpiry: null,
            error: {
              message: err instanceof Error ? err.message : String(err),
              code: "INOREADER_STATUS_INTERNAL_ERROR",
            },
          };

          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          });
        }
      }

      case 'exchange': {
        return await handleExchange(supabase, code);
      }

      case 'refresh':
        return await handleRefresh(supabase, refreshToken);

      case 'validate':
        return await handleValidate(supabase);

      case 'ensure-valid':
        return await handleEnsureValid(supabase);

      case 'disconnect': {
        return await handleDisconnect(supabase);
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error: any) {
    console.error('❌ OAuth Error:', error);

    if (error?.message === 'unauthorized') {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    return jsonResponse({
      success: false,
      error: error.message
    }, 400);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

/**
 * STEP 1: Generate Authorization URL
 * کاربر را به صفحه تأیید Inoreader هدایت می‌کند
 */
function handleAuthorize() {
  const state = crypto.randomUUID(); // CSRF protection
  
  const authUrl = new URL(INOREADER_CONFIG.AUTH_URL);
  authUrl.searchParams.set('client_id', INOREADER_CONFIG.CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', INOREADER_CONFIG.REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', INOREADER_CONFIG.SCOPE);
  authUrl.searchParams.set('state', state);

  console.log('✅ Authorization URL generated');

  return new Response(
    JSON.stringify({
      success: true,
      authUrl: authUrl.toString(),
      state
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

async function handleStatus(supabase: SupabaseClient) {
  const status = await ensureValidInoreaderToken(supabase, 10);

  if (status.status === 'not_connected') {
    return jsonResponse({
      connected: false,
      reason: 'no_tokens',
      ok: true,
      isConnected: false,
      isExpired: false,
      needsReconnect: true,
      hasRefreshToken: false,
      canAutoRefresh: false,
      expiresAt: null,
      secondsToExpiry: null,
    });
  }

  if (status.status === 'refresh_failed') {
    return jsonResponse({
      connected: false,
      reason: 'refresh_failed',
      ok: false,
      isConnected: false,
      isExpired: true,
      needsReconnect: true,
      hasRefreshToken: false,
      canAutoRefresh: false,
      expiresAt: null,
      secondsToExpiry: null,
      error: { message: status.error || 'Token refresh failed' },
    });
  }

  const token = status.token;
  const now = new Date();
  const expiresAt = token.expires_at ? new Date(token.expires_at) : null;
  const isExpired = expiresAt ? expiresAt <= now : false;
  const secondsToExpiry = expiresAt
    ? Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
    : null;

  return jsonResponse({
    connected: true,
    ok: true,
    isConnected: true,
    isExpired,
    needsReconnect: false,
    hasRefreshToken: !!token.refresh_token,
    canAutoRefresh: !!token.refresh_token,
    expiresAt: token.expires_at,
    secondsToExpiry,
    needsRefresh: false,
  });
}

/**
 * STEP 2: Exchange authorization code for tokens
 * کد موقت را به Access Token تبدیل می‌کند
 */
async function handleExchange(supabase: SupabaseClient, code: string) {
  if (!code) {
    throw new Error('Authorization code is required');
  }

  console.log('🔄 Exchanging code for tokens...');

  // Request tokens from Inoreader
  const tokenResponse = await fetch(INOREADER_CONFIG.TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: INOREADER_CONFIG.CLIENT_ID,
      client_secret: INOREADER_CONFIG.CLIENT_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: INOREADER_CONFIG.REDIRECT_URI
    }).toString()
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('❌ Token exchange failed:', errorText);
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  const tokens = await tokenResponse.json();
  
  console.log('✅ Tokens received:', {
    access_token: tokens.access_token?.substring(0, 20) + '...',
    expires_in: tokens.expires_in
  });

  const tokenRecord = await saveTokenRecord(supabase, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
    token_type: tokens.token_type,
    scope: tokens.scope,
  });

  console.log('✅ Tokens saved to database');

  return new Response(
    JSON.stringify({
      success: true,
      message: 'اتصال به Inoreader با موفقیت برقرار شد',
      expiresAt: tokenRecord.expires_at,
      hasRefreshToken: !!tokens.refresh_token
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

/**
 * STEP 3: Refresh expired token
 * توکن منقضی شده را تمدید می‌کند
 */
async function handleRefresh(supabase: SupabaseClient, providedRefreshToken?: string) {
  console.log('🔄 Refreshing token...');

  const activeToken = await getActiveInoreaderToken(supabase);

  const tokenWithOverride = {
    ...activeToken,
    refresh_token: providedRefreshToken || activeToken.refresh_token
  };

  const updatedToken = await refreshInoreaderToken(supabase, tokenWithOverride);

  return new Response(
    JSON.stringify({
      success: true,
      message: 'توکن با موفقیت تمدید شد',
      expiresAt: updatedToken.expires_at
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

/**
 * STEP 4: Validate current token
 * بررسی اعتبار توکن فعلی
 */
async function handleValidate(supabase: SupabaseClient) {
  console.log('🔍 Validating token...');

  try {
    const token = await getActiveInoreaderToken(supabase);
    const now = new Date();
    const expiresAt = token.expires_at ? new Date(token.expires_at) : null;
    const isExpired = expiresAt ? expiresAt <= now : false;
    const needsRefresh = expiresAt
      ? expiresAt <= new Date(now.getTime() + 3600000)
      : false;

    console.log('✅ Token validation complete:', {
      isExpired,
      needsRefresh,
      expiresAt: token.expires_at
    });

    return new Response(
      JSON.stringify({
        success: true,
        isValid: !isExpired,
        needsRefresh,
        expiresAt: token.expires_at,
        hasRefreshToken: !!token.refresh_token,
        lastRefreshAt: token.last_refresh_at,
        createdAt: token.created_at
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        isValid: false,
        message: error.message || 'هیچ توکن فعالی یافت نشد'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}

async function handleEnsureValid(supabase: SupabaseClient) {
  console.log('🛡️ Ensuring token validity on demand...');
  const status = await ensureValidInoreaderToken(supabase);

  if (status.status !== 'ok') {
    return jsonResponse({ success: false, error: 'No valid token available' }, 400);
  }

  const token = status.token;

  return new Response(
    JSON.stringify({
      success: true,
      expiresAt: token.expires_at,
      lastRefreshAt: token.last_refresh_at,
      createdAt: token.created_at
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

/**
 * STEP 5: Disconnect/Remove token
 * حذف اتصال به Inoreader
 */
async function handleDisconnect(supabase: SupabaseClient) {
  console.log('🔌 Disconnecting from Inoreader...');

  try {
    const { error: sessionError } = await supabase
      .from('inoreader_oauth_sessions')
      .update({ is_active: false })
      .neq('is_active', false);

    if (sessionError) {
      // Non-fatal: table missing or not cached
      if (sessionError.code === 'PGRST204' || sessionError.code === '42P01') {
        console.warn('[Inoreader] inoreader_oauth_sessions table missing, skipping session update');
      } else {
        console.warn('[Inoreader] Failed to update inoreader_oauth_sessions', sessionError);
      }
    }
  } catch (err) {
    console.warn('[Inoreader] Error while updating sessions (ignored):', err);
  }

  const { error: tokenError } = await supabase
    .from(TOKENS_TABLE)
    .delete();

  if (tokenError) {
    throw tokenError;
  }

  console.log('✅ Disconnected successfully');

  return jsonResponse({
    success: true,
    message: 'اتصال به Inoreader قطع شد'
  });
}
