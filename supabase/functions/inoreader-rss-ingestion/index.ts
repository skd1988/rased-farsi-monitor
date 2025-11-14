/**
 * =====================================================
 * INOREADER RSS INGESTION - Edge Function
 * سیستم AFTAB Intelligence System
 * =====================================================
 * 
 * وظایف:
 * 1. دریافت لیست Folders از Inoreader
 * 2. Sync محتوا از هر folder (با pagination)
 * 3. تشخیص زبان و نوع منبع
 * 4. جلوگیری از تکراری
 * 5. لاگ کامل عملیات
 * 
 * استفاده:
 * - Cron Job: هر 30 دقیقه
 * - Manual: POST با body: { folderIds?: string[], forceAll?: boolean }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ⚙️ Configuration
const CONFIG = {
  INOREADER_API_BASE: "https://www.inoreader.com/reader/api/0",
  MAX_POSTS_PER_FOLDER: 500, // حداکثر تعداد در هر sync
  POSTS_PER_REQUEST: 100, // تعداد در هر request (max از Inoreader)
  MAX_PROCESSING_TIME_MS: 270000, // 4.5 دقیقه (کمتر از 5 دقیقه timeout)
  MAX_POST_AGE_HOURS: 24, // ✅ حداکثر سن پست به ساعت
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request body (optional for manual triggers)
    let folderIds: string[] | undefined;
    let forceAll = false;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        folderIds = body.folderIds;
        forceAll = body.forceAll || false;
      } catch {
        // No body or invalid JSON - use defaults
      }
    }

    console.log('🚀 Starting Inoreader RSS Ingestion');
    console.log('📂 Folder IDs:', folderIds || 'ALL');
    console.log('⚡ Force All:', forceAll);

    // STEP 1: Get active access token
    const accessToken = await getActiveToken(supabase);
    if (!accessToken) {
      throw new Error('No active Inoreader token found. Please connect your account first.');
    }

    // STEP 2: Get folders to sync
    const folders = await getFoldersToSync(supabase, folderIds, forceAll);
    console.log(`📊 Found ${folders.length} folders to sync`);

    if (folders.length === 0) {
      return createSuccessResponse({
        message: 'هیچ folderای برای sync یافت نشد',
        folders: [],
        totalPosts: 0,
        totalNew: 0
      });
    }

    // STEP 3: Sync each folder
    const results = [];
    let totalPostsFetched = 0;
    let totalNewPosts = 0;

    for (const folder of folders) {
      // Check timeout
      if (Date.now() - startTime > CONFIG.MAX_PROCESSING_TIME_MS) {
        console.warn('⏱️ Approaching timeout, stopping sync');
        break;
      }

      const result = await syncFolder(supabase, accessToken, folder, startTime);
      results.push(result);
      
      totalPostsFetched += result.postsFetched;
      totalNewPosts += result.postsNew;

      // Update folder's last sync time
      await supabase
        .from('inoreader_folders')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', folder.id);
    }

    const totalDuration = Date.now() - startTime;

    console.log('✅ Ingestion complete:', {
      folders: results.length,
      totalPostsFetched,
      totalNewPosts,
      duration_ms: totalDuration
    });

    return createSuccessResponse({
      message: `با موفقیت ${results.length} folder همگام‌سازی شد`,
      folders: results,
      totalPosts: totalPostsFetched,
      totalNew: totalNewPosts,
      duration_ms: totalDuration
    });

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    return createErrorResponse(error.message);
  }
});

/**
 * دریافت توکن فعال از دیتابیس
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
    console.error('❌ No active token found');
    return null;
  }

  // Check if expired
  const expiresAt = new Date(data.expires_at);
  if (expiresAt <= new Date()) {
    console.error('❌ Token expired');
    return null;
  }

  return data.access_token;
}

/**
 * دریافت لیست folders برای sync
 */
async function getFoldersToSync(
  supabase: any,
  folderIds?: string[],
  forceAll?: boolean
): Promise<any[]> {
  
  let query = supabase
    .from('inoreader_folders')
    .select('*')
    .eq('is_active', true);

  // اگر folderIds مشخص شده، فقط آن‌ها را بگیر
  if (folderIds && folderIds.length > 0) {
    query = query.in('id', folderIds);
  } else if (!forceAll) {
    // فقط folderهایی که زمانشان رسیده
    const now = new Date();
    query = query.or(
      `last_synced_at.is.null,last_synced_at.lt.${now.toISOString()}`
    );
  }

  query = query.order('priority', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error('❌ Error fetching folders:', error);
    return [];
  }

  return data || [];
}

/**
 * همگام‌سازی یک folder از Inoreader
 */
async function syncFolder(
  supabase: any,
  accessToken: string,
  folder: any,
  startTime: number
): Promise<any> {
  
  const syncStartTime = Date.now();
  const logId = crypto.randomUUID();

  console.log(`\n📁 Syncing folder: ${folder.folder_name} (Priority: ${folder.priority})`);

  // Create sync log
  await supabase.from('inoreader_sync_log').insert({
    id: logId,
    folder_id: folder.id,
    sync_type: 'scheduled',
    status: 'running',
    started_at: new Date().toISOString()
  });

  try {
    let allPosts: any[] = [];
    let continuation: string | undefined;
    let requestCount = 0;

    // Get last sync timestamp for this folder
    // ✅ قانون 24 ساعت: فقط پست‌های 24 ساعت اخیر
    const now = Date.now();
    const oneDayAgo = now - (CONFIG.MAX_POST_AGE_HOURS * 60 * 60 * 1000);
    const lastSyncTime = folder.last_synced_at
      ? new Date(folder.last_synced_at).getTime()
      : oneDayAgo;

    // استفاده از جدیدترین: یا آخرین sync یا 24 ساعت پیش
    const sinceTime = Math.max(lastSyncTime, oneDayAgo);
    const lastTimestamp = sinceTime * 1000; // convert to microseconds

    console.log(`  📅 Fetching posts since: ${new Date(sinceTime).toISOString()}`);

    // Pagination loop
    do {
      // Check timeout
      if (Date.now() - startTime > CONFIG.MAX_PROCESSING_TIME_MS) {
        console.warn('⏱️ Timeout approaching, stopping folder sync');
        break;
      }

      requestCount++;
      console.log(`  📡 Request #${requestCount}...`);

      const posts = await fetchFromInoreader(
        accessToken,
        folder.folder_id,
        continuation,
        lastTimestamp
      );

      allPosts = [...allPosts, ...posts.items];
      continuation = posts.continuation;

      console.log(`  ✅ Fetched ${posts.items.length} posts (Total: ${allPosts.length})`);

      // Safety limit
      if (allPosts.length >= CONFIG.MAX_POSTS_PER_FOLDER) {
        console.warn('⚠️ Reached max posts limit for folder');
        break;
      }

    } while (continuation);

    // Process and insert posts
    const { newPosts, duplicates, filtered } = await processPosts(
      supabase,
      allPosts,
      folder
    );

    const duration = Date.now() - syncStartTime;

    // Update sync log
    await supabase
      .from('inoreader_sync_log')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        posts_fetched: allPosts.length,
        posts_new: newPosts,
        posts_duplicates: duplicates,
        posts_filtered: filtered
      })
      .eq('id', logId);

    console.log(`✅ Folder sync complete:`, {
      fetched: allPosts.length,
      new: newPosts,
      duplicates,
      duration_ms: duration
    });

    return {
      folderId: folder.id,
      folderName: folder.folder_name,
      postsFetched: allPosts.length,
      postsNew: newPosts,
      postsDuplicates: duplicates,
      postsFiltered: filtered,
      duration_ms: duration,
      status: 'success'
    };

  } catch (error: any) {
    console.error(`❌ Error syncing folder ${folder.folder_name}:`, error);

    // Update log with error
    await supabase
      .from('inoreader_sync_log')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message
      })
      .eq('id', logId);

    return {
      folderId: folder.id,
      folderName: folder.folder_name,
      postsFetched: 0,
      postsNew: 0,
      status: 'failed',
      error: error.message
    };
  }
}

/**
 * دریافت محتوا از Inoreader API
 */
async function fetchFromInoreader(
  accessToken: string,
  streamId: string,
  continuation?: string,
  since?: number
): Promise<any> {
  
  const params = new URLSearchParams({
    n: CONFIG.POSTS_PER_REQUEST.toString(),
    xt: 'user/-/state/com.google/read' // exclude read items
  });

  if (continuation) {
    params.set('c', continuation);
  }

  if (since) {
    params.set('ot', since.toString());
  }

  // URL encode the streamId
  const encodedStreamId = encodeURIComponent(streamId);
  
  const url = `${CONFIG.INOREADER_API_BASE}/stream/contents/${encodedStreamId}?${params}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Inoreader API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  return {
    items: data.items || [],
    continuation: data.continuation
  };
}

/**
 * پردازش و ذخیره مطالب
 */
async function processPosts(
  supabase: any,
  items: any[],
  folder: any
): Promise<{ newPosts: number; duplicates: number; filtered: number }> {
  
  let newPosts = 0;
  let duplicates = 0;
  let filtered = 0;

  for (const item of items) {
    try {
      // ✅ فیلتر 24 ساعت: رد کردن پست‌های قدیمی
      const publishedTime = item.published * 1000; // milliseconds
      const oneDayAgo = Date.now() - (CONFIG.MAX_POST_AGE_HOURS * 60 * 60 * 1000);

      if (publishedTime < oneDayAgo) {
        console.log(`⏭️ Skipping old post (${Math.round((Date.now() - publishedTime) / (1000 * 60 * 60))}h old): ${item.title?.substring(0, 50)}...`);
        filtered++;
        continue;
      }

      // Extract data from Inoreader response
      const post = extractPostData(item, folder);

      // Check if already exists
      const { data: existing } = await supabase
        .from('posts')
        .select('id')
        .eq('inoreader_item_id', post.inoreader_item_id)
        .single();

      if (existing) {
        duplicates++;
        continue;
      }

      // Insert new post
      const { error: insertError } = await supabase
        .from('posts')
        .insert(post);

      if (insertError) {
        console.error('❌ Insert error:', insertError);
        filtered++;
      } else {
        newPosts++;
      }

    } catch (error: any) {
      console.error('❌ Error processing post:', error);
      filtered++;
    }
  }

  return { newPosts, duplicates, filtered };
}

/**
 * استخراج داده از format Inoreader
 */
function extractPostData(item: any, folder: any): any {
  // Clean HTML
  const cleanContent = item.summary?.content 
    ? item.summary.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  // Detect language
  const language = detectLanguage(item.title, cleanContent);

  // Detect source type
  const sourceUrl = item.canonical?.[0]?.href || item.origin?.htmlUrl || '';
  const sourceType = detectSourceType(sourceUrl);

  return {
    // Required fields
    title: item.title || 'بدون عنوان',
    contents: cleanContent,
    source: item.origin?.title || 'نامشخص',
    source_url: sourceUrl,
    published_at: new Date(item.published * 1000).toISOString(),
    language,
    status: 'جدید',

    // Inoreader specific
    inoreader_item_id: item.id,
    inoreader_folder: folder.folder_name,
    inoreader_folder_id: folder.id,
    inoreader_categories: item.categories || [],
    inoreader_timestamp_usec: parseInt(item.timestampUsec || '0'),
    fetch_priority: folder.priority,
    fetched_from: 'inoreader',

    // Optional
    author: item.author || null,
    source_type: sourceType,
    article_url: sourceUrl
  };
}

/**
 * تشخیص زبان محتوا
 */
function detectLanguage(title: string, content: string): string {
  const text = (title + ' ' + content).toLowerCase();

  // Persian patterns
  if (/[\u0600-\u06FF]/.test(text)) {
    if (/[است|های|برای|این|که|از|با|به|در]/.test(text)) {
      return 'Persian';
    }
  }

  // Arabic patterns
  if (/[\u0600-\u06FF]/.test(text)) {
    if (/[هذا|هذه|الذي|التي|على|في|من|إلى]/.test(text)) {
      return 'Arabic';
    }
  }

  // English
  if (/[a-zA-Z]/.test(text)) {
    return 'English';
  }

  return 'Unknown';
}

/**
 * تشخیص نوع منبع
 */
function detectSourceType(url: string): string {
  if (!url) return 'website';

  const urlLower = url.toLowerCase();

  // Social media patterns
  const socialPatterns = [
    /twitter\.com|x\.com/,
    /facebook\.com/,
    /instagram\.com/,
    /t\.me|telegram/,
    /youtube\.com|youtu\.be/,
    /tiktok\.com/
  ];

  for (const pattern of socialPatterns) {
    if (pattern.test(urlLower)) {
      return 'social_media';
    }
  }

  return 'website';
}

/**
 * Helper functions
 */
function createSuccessResponse(data: any) {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

function createErrorResponse(message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}
