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
  refreshInoreaderToken
} from "../_shared/inoreaderAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, code, refreshToken } = await req.json();

    console.log(`🔐 Inoreader OAuth: Action = ${action}`);

    switch (action) {
      case 'authorize':
        return handleAuthorize();

      case 'exchange':
        return await handleExchange(supabase, code);

      case 'refresh':
        return await handleRefresh(supabase, refreshToken);

      case 'validate':
        return await handleValidate(supabase);

      case 'ensure-valid':
        return await handleEnsureValid(supabase);

      case 'disconnect':
        return await handleDisconnect(supabase);

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error: any) {
    console.error('❌ OAuth Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

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

  // Calculate expiration time
  const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

  // Deactivate old tokens
  await supabase
    .from('inoreader_oauth_tokens')
    .update({ is_active: false })
    .eq('is_active', true);

  // Store new tokens
  const { data: tokenRecord, error: insertError } = await supabase
    .from('inoreader_oauth_tokens')
    .insert({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_at: expiresAt.toISOString(),
      scope: tokens.scope,
      is_active: true
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ Database error:', insertError);
    throw insertError;
  }

  console.log('✅ Tokens saved to database');

  return new Response(
    JSON.stringify({
      success: true,
      message: 'اتصال به Inoreader با موفقیت برقرار شد',
      expiresAt: expiresAt.toISOString(),
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
  const token = await ensureValidInoreaderToken(supabase);

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
async function handleDisconnect(supabase: any) {
  console.log('🔌 Disconnecting from Inoreader...');

  const { error } = await supabase
    .from('inoreader_oauth_tokens')
    .update({ is_active: false })
    .eq('is_active', true);

  if (error) {
    throw error;
  }

  console.log('✅ Disconnected successfully');

  return new Response(
    JSON.stringify({
      success: true,
      message: 'اتصال به Inoreader قطع شد'
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}
