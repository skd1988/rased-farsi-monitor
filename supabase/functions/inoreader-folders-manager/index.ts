/**
 * =====================================================
 * INOREADER FOLDERS MANAGER - Edge Function
 * سیستم AFTAB Intelligence System
 * =====================================================
 * 
 * وظایف:
 * 1. دریافت لیست Folders/Tags از Inoreader
 * 2. همگام‌سازی با دیتابیس محلی
 * 3. مدیریت تنظیمات هر folder
 * 4. آمار و گزارش
 * 
 * Actions:
 * - list: دریافت لیست folders از Inoreader
 * - sync: همگام‌سازی با database
 * - update: بروزرسانی تنظیمات folder
 * - stats: آمار folders
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INOREADER_API_BASE = "https://www.inoreader.com/reader/api/0";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, folderId, config } = await req.json();

    console.log(`📂 Folders Manager: Action = ${action}`);

    switch (action) {
      case 'list':
        return await handleList(supabase);

      case 'sync':
        return await handleSync(supabase);

      case 'update':
        return await handleUpdate(supabase, folderId, config);

      case 'stats':
        return await handleStats(supabase);

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

/**
 * دریافت لیست folders از Inoreader
 */
async function handleList(supabase: any) {
  console.log('📋 Fetching folders from Inoreader...');

  // Get access token
  const token = await getActiveToken(supabase);
  if (!token) {
    throw new Error('No active token. Please connect to Inoreader first.');
  }

  // Fetch tags/folders from Inoreader
  const response = await fetch(`${INOREADER_API_BASE}/tag/list`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Inoreader API error: ${errorText}`);
  }

  const data = await response.json();

  // Filter only folders (not system tags)
  const folders = (data.tags || [])
    .filter((tag: any) => tag.id.includes('/label/'))
    .map((tag: any) => ({
      folder_id: tag.id,
      folder_name: tag.id.split('/label/')[1],
      folder_type: tag.type || 'folder',
      sort_id: tag.sortid
    }));

  console.log(`✅ Found ${folders.length} folders`);

  return new Response(
    JSON.stringify({
      success: true,
      folders,
      total: folders.length
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

/**
 * همگام‌سازی folders با database
 */
async function handleSync(supabase: any) {
  console.log('🔄 Syncing folders with database...');

  // Get folders from Inoreader
  const token = await getActiveToken(supabase);
  if (!token) {
    throw new Error('No active token');
  }

  const response = await fetch(`${INOREADER_API_BASE}/tag/list`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch folders from Inoreader');
  }

  const data = await response.json();
  const inoreaderFolders = (data.tags || [])
    .filter((tag: any) => tag.id.includes('/label/'));

  // Get existing folders from database
  const { data: existingFolders } = await supabase
    .from('inoreader_folders')
    .select('folder_id, id');

  const existingIds = new Set(
    (existingFolders || []).map((f: any) => f.folder_id)
  );

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  // Process each folder
  for (const folder of inoreaderFolders) {
    const folderData = {
      folder_id: folder.id,
      folder_name: folder.id.split('/label/')[1],
      folder_type: folder.type || 'folder',
      sort_id: folder.sortid
    };

    if (existingIds.has(folder.id)) {
      // Update existing
      const { error } = await supabase
        .from('inoreader_folders')
        .update(folderData)
        .eq('folder_id', folder.id);

      if (error) {
        console.error('❌ Update error:', error);
      } else {
        updated++;
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('inoreader_folders')
        .insert({
          ...folderData,
          is_active: true,
          priority: 2,
          fetch_interval_minutes: 30
        });

      if (error) {
        console.error('❌ Insert error:', error);
      } else {
        added++;
      }
    }
  }

  unchanged = existingFolders?.length || 0 - updated;

  console.log('✅ Sync complete:', { added, updated, unchanged });

  return new Response(
    JSON.stringify({
      success: true,
      message: `همگام‌سازی انجام شد: ${added} جدید، ${updated} بروز شد`,
      stats: { added, updated, unchanged, total: inoreaderFolders.length }
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

/**
 * بروزرسانی تنظیمات folder
 */
async function handleUpdate(supabase: any, folderId: string, config: any) {
  console.log(`⚙️ Updating folder: ${folderId}`);

  if (!folderId) {
    throw new Error('folderId is required');
  }

  const updates: any = {};

  if (config.is_active !== undefined) updates.is_active = config.is_active;
  if (config.priority !== undefined) updates.priority = config.priority;
  if (config.fetch_interval_minutes !== undefined) {
    updates.fetch_interval_minutes = config.fetch_interval_minutes;
  }
  if (config.enable_ai_analysis !== undefined) {
    updates.enable_ai_analysis = config.enable_ai_analysis;
  }
  if (config.notes !== undefined) updates.notes = config.notes;

  const { data, error } = await supabase
    .from('inoreader_folders')
    .update(updates)
    .eq('id', folderId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  console.log('✅ Folder updated');

  return new Response(
    JSON.stringify({
      success: true,
      message: 'تنظیمات folder بروز شد',
      folder: data
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

/**
 * آمار folders
 */
async function handleStats(supabase: any) {
  console.log('📊 Generating folders stats...');

  // Get all folders with post counts
  const { data: folders, error: foldersError } = await supabase
    .from('inoreader_folders')
    .select('*');

  if (foldersError) {
    throw foldersError;
  }

  // Get post counts for each folder
  const stats = [];
  for (const folder of folders || []) {
    const { count } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('inoreader_folder_id', folder.id);

    stats.push({
      ...folder,
      post_count: count || 0
    });
  }

  // Get recent sync logs
  const { data: recentLogs } = await supabase
    .from('inoreader_sync_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  // Summary
  const summary = {
    total_folders: folders?.length || 0,
    active_folders: folders?.filter(f => f.is_active).length || 0,
    total_posts: stats.reduce((sum, f) => sum + f.post_count, 0),
    priority_distribution: {
      high: folders?.filter(f => f.priority === 1).length || 0,
      medium: folders?.filter(f => f.priority === 2).length || 0,
      low: folders?.filter(f => f.priority === 3).length || 0
    }
  };

  console.log('✅ Stats generated');

  return new Response(
    JSON.stringify({
      success: true,
      summary,
      folders: stats,
      recentLogs: recentLogs || []
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

/**
 * Helper: Get active token
 */
async function getActiveToken(supabase: any): Promise<string | null> {
  const { data, error } = await supabase
    .from('inoreader_oauth_tokens')
    .select('access_token, expires_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  // Check expiration
  if (new Date(data.expires_at) <= new Date()) {
    return null;
  }

  return data.access_token;
}
