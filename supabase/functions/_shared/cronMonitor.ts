import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") || "";
const DISCORD_WEBHOOK_URL = Deno.env.get("DISCORD_WEBHOOK_URL") || "";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

export type JobRunStatus = "running" | "success" | "failed";

export async function startJobRun(jobName: string, triggerSource = "github_actions", payload?: any) {
  const { data, error } = await supabaseAdmin
    .from("scheduled_job_runs")
    .insert({
      job_name: jobName,
      trigger_source: triggerSource,
      status: "running",
      payload: payload ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[CronMonitor] Failed to insert job run for ${jobName}`, error);
    return null;
  }

  return data.id as string;
}

export async function finishJobRun(
  runId: string | null,
  status: JobRunStatus,
  httpStatus: number,
  errorMessage?: string,
  metadata?: any,
) {
  if (!runId) return;

  const { error } = await supabaseAdmin
    .from("scheduled_job_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      http_status: httpStatus,
      error_message: errorMessage || null,
      metadata: metadata ?? null,
    })
    .eq("id", runId);

  if (error) {
    console.error("[CronMonitor] Failed to update job run", error);
  }

  if (status === "failed") {
    await sendFailureAlerts(errorMessage, metadata);
  }
}

async function sendFailureAlerts(errorMessage?: string, metadata?: any) {
  const text = buildAlertText(errorMessage, metadata);

  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: "Markdown",
        }),
      });
    } catch (err) {
      console.error("[CronMonitor] Telegram alert failed", err);
    }
  }

  if (DISCORD_WEBHOOK_URL) {
    try {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
        }),
      });
    } catch (err) {
      console.error("[CronMonitor] Discord alert failed", err);
    }
  }
}

function buildAlertText(errorMessage?: string, metadata?: any): string {
  const metaText = metadata ? "\n```json\n" + JSON.stringify(metadata, null, 2) + "\n```" : "";
  return `🚨 *Cron job failed*\n\nError: ${errorMessage || "Unknown error"}${metaText}`;
}
