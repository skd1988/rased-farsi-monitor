import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startJobRun, finishJobRun } from "../_shared/cronMonitor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CHUNK_SIZE = 200;

/**
 * حذف پست‌ها در چند درخواست کوچک برای جلوگیری از خطای 400 (Bad Request)
 */
async function deletePostsInChunks(supabase: any, ids: string[]) {
  let totalDeleted = 0;

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);

    console.log(
      `🧩 Deleting chunk ${i / CHUNK_SIZE + 1} (size=${chunk.length})`,
    );

    const { data, error } = await supabase
      .from("posts")
      .delete()
      .in("id", chunk)
      .select("id");

    if (error) {
      console.error("❌ Chunk delete error:", error);
      throw error;
    }

    totalDeleted += data?.length || 0;
  }

  return totalDeleted;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jobName = "auto-cleanup";
  let runId: number | null = null;
  let httpStatus = 200;

  try {
    // ثبت شروع کرون در جدول مانیتورینگ
    runId = await startJobRun(
      jobName,
      req.headers.get("X-Job-Source") || "github_actions",
    );

    console.log("🧹 Auto Cleanup started...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 📌 خواندن مدت نگهداری از auto_analysis_config (بر حسب ساعت)
    const { data: retentionConfig } = await supabase
      .from("auto_analysis_config")
      .select("config_value")
      .eq("config_key", "posts_retention_hours")
      .single();

    const retentionHours = parseInt(retentionConfig?.config_value || "24", 10);
    const cutoffDate = new Date(
      Date.now() - retentionHours * 60 * 60 * 1000,
    );

    console.log(`⏰ Retention: ${retentionHours} hours`);
    console.log(`📅 Cutoff: ${cutoffDate.toISOString()}`);
    console.log(`📅 Now: ${new Date().toISOString()}`);

    // === DIAGNOSTIC PHASE ===
    console.log("\n=== DIAGNOSTIC PHASE ===");

    // تعداد کل پست‌ها
    const { count: totalPosts } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true });

    console.log(`📊 Total posts in database: ${totalPosts}`);

    // تعداد پست‌های قدیمی‌تر از cutoff
    const { count: oldPosts } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffDate.toISOString());

    console.log(`⏳ Posts older than ${retentionHours}h: ${oldPosts}`);

    // اگر هیچ پست قدیمی‌ای نیست، خلاصه برگردون و تمام
    if (!oldPosts || oldPosts === 0) {
      console.log("✅ No old posts found - nothing to cleanup");

      const summary = {
        success: true,
        posts_deleted: 0,
        posts_archived: 0,
        queue_cleaned: 0,
        retention_hours: retentionHours,
        cutoff_date: cutoffDate.toISOString(),
        message: "No posts older than retention period",
        diagnostic: {
          total_posts: totalPosts,
          old_posts: oldPosts,
        },
        timestamp: new Date().toISOString(),
      };

      const response = new Response(JSON.stringify(summary), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });

      httpStatus = response.status;
      if (runId) {
        await finishJobRun(runId, "success", httpStatus, undefined, {
          jobName,
        });
      }

      return response;
    }

    // === ARCHIVE PHASE ===
    console.log("\n=== ARCHIVE PHASE ===");
    console.log(
      "📦 Selecting important posts (High/Critical or PsyOp) to archive...",
    );

    const { data: eligibleForArchive, error: eligibleArchiveError } =
      await supabase
        .from("posts")
        .select("id, title, threat_level, is_psyop, status")
        .lt("created_at", cutoffDate.toISOString())
        .neq("status", "Archived");

    if (eligibleArchiveError) {
      throw eligibleArchiveError;
    }

    console.log(
      `📋 Found ${eligibleForArchive?.length || 0} old, non-archived posts`,
    );

    const postsToArchive = (eligibleForArchive || []).filter((post: any) => {
      const isHighThreat =
        post.threat_level === "High" || post.threat_level === "Critical";
      const isPsyOp = post.is_psyop === true;
      return isHighThreat || isPsyOp;
    });

    console.log(
      `📦 Posts to archive (High/Critical or PsyOp): ${postsToArchive.length}`,
    );

    let postsArchived = 0;

    if (postsToArchive.length > 0) {
      const idsToArchive = postsToArchive.map((p: any) => p.id);

      const { data: archivedPosts, error: archiveError } = await supabase
        .from("posts")
        .update({ status: "Archived" })
        .in("id", idsToArchive)
        .select("id");

      if (archiveError) {
        console.error("❌ Archive error:", archiveError);
        throw archiveError;
      }

      postsArchived = archivedPosts?.length || 0;
      console.log(`✅ Archived ${postsArchived} posts`);
    }

    // === DELETE PHASE ===
    console.log("\n=== DELETE PHASE ===");
    console.log(
      "🗑️ Selecting low-priority posts (Low/Medium & NOT PsyOp) for deletion...",
    );

    const { data: nonArchivedOldPosts, error: nonArchivedError } =
      await supabase
        .from("posts")
        .select("id, title, threat_level, is_psyop, status")
        .lt("created_at", cutoffDate.toISOString())
        .neq("status", "Archived"); // فقط غیر آرشیو شده‌ها

    if (nonArchivedError) {
      throw nonArchivedError;
    }

    console.log(
      `📋 Old non-archived posts: ${nonArchivedOldPosts?.length || 0}`,
    );

    const postsToDelete = (nonArchivedOldPosts || []).filter((post: any) => {
      const isLowThreat =
        post.threat_level === "Low" || post.threat_level === "Medium";
      const notPsyOp = post.is_psyop === false;
      return isLowThreat && notPsyOp;
    });

    console.log(
      `🗑️ Posts to delete (Low/Medium and NOT PsyOp): ${postsToDelete.length}`,
    );

    let postsDeleted = 0;

    if (postsToDelete.length > 0) {
      const idsToDelete = postsToDelete.map((p: any) => p.id);

      console.log("Sample posts to delete:");
      postsToDelete.slice(0, 3).forEach((p: any) => {
        console.log(
          `  - ${p.title?.substring(0, 50)} (${p.threat_level})`,
        );
      });

      // 🔥 اینجا به جای یک DELETE بزرگ، به شکل chunk حذف می‌کنیم
      postsDeleted = await deletePostsInChunks(supabase, idsToDelete);
      console.log(`✅ Successfully deleted ${postsDeleted} posts`);
    }

    // === COUNTER RESET PHASE ===
    console.log("\n=== COUNTER RESET PHASE ===");

    const today = new Date().toISOString().split("T")[0];

    const { data: lastReset } = await supabase
      .from("auto_analysis_config")
      .select("config_value")
      .eq("config_key", "last_counter_reset")
      .single();

    if (lastReset?.config_value !== today) {
      console.log("🔄 Resetting 30-day counters...");

      // Reset source_profiles
      const { error: resetSourcesError } = await supabase
        .from("source_profiles")
        .update({ last_30days_psyop_count: 0 });

      if (resetSourcesError) {
        console.error("❌ Error resetting source profiles:", resetSourcesError);
      } else {
        console.log("✅ Source profiles reset");
      }

      // Reset social_media_channels
      const { error: resetChannelsError } = await supabase
        .from("social_media_channels")
        .update({ last_30days_psyop_count: 0 });

      if (resetChannelsError) {
        console.error("❌ Error resetting channels:", resetChannelsError);
      } else {
        console.log("✅ Channels reset");
      }

      // Update last_counter_reset in auto_analysis_config
      const { error: upsertError } = await supabase
        .from("auto_analysis_config")
        .upsert(
          {
            config_key: "last_counter_reset",
            config_value: today,
          },
          { onConflict: "config_key" },
        );

      if (upsertError) {
        console.error("❌ Error updating last_counter_reset:", upsertError);
      } else {
        console.log("✅ Last reset date updated");
      }
    } else {
      console.log("⏭️ Counters already reset today");
    }

    // === QUEUE CLEANUP PHASE ===
    console.log("\n=== QUEUE CLEANUP PHASE ===");

    const { data: queueCleaned, error: queueError } = await supabase.rpc(
      "cleanup_analysis_queue",
    );

    if (queueError) {
      console.error("❌ Queue cleanup error:", queueError);
    } else {
      console.log(`✅ Cleaned ${queueCleaned || 0} queue items`);
    }

    // === SUMMARY ===
    const summary = {
      success: true,
      posts_deleted: postsDeleted,
      posts_archived: postsArchived,
      queue_cleaned: queueCleaned || 0,
      retention_hours: retentionHours,
      cutoff_date: cutoffDate.toISOString(),
      diagnostic: {
        total_posts: totalPosts,
        old_posts: oldPosts,
        eligible_for_archive: postsToArchive.length,
        eligible_for_delete: postsToDelete.length,
      },
      timestamp: new Date().toISOString(),
    };

    console.log("\n✅ Auto Cleanup completed:");
    console.log(JSON.stringify(summary, null, 2));

    // ذخیره در جدول cleanup_history
    try {
      await supabase.from("cleanup_history").insert({
        executed_at: new Date().toISOString(),
        posts_deleted: postsDeleted,
        posts_archived: postsArchived,
        queue_cleaned: queueCleaned || 0,
        retention_hours: retentionHours,
        success: true,
        cutoff_date: cutoffDate.toISOString(),
      });

      console.log("✅ Cleanup history saved");
    } catch (historyError) {
      console.error("⚠️ Failed to save cleanup history:", historyError);
      // اگر این قسمت خطا دهد، کل عملیات را fail نکن
    }

    const response = new Response(JSON.stringify(summary), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });

    httpStatus = response.status;

    if (runId) {
      await finishJobRun(runId, "success", httpStatus, undefined, {
        jobName,
      });
    }

    return response;
  } catch (error: any) {
    console.error("Auto Cleanup error:", error);

    const message = error?.message || "Unknown error";

    const response = new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );

    httpStatus = response.status;

    if (runId) {
      await finishJobRun(runId, "failed", httpStatus, message, {
        jobName,
      });
    }

    return response;
  }
});
