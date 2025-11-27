// supabase/functions/deepest-analysis/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logDeepseekUsage } from "../_shared/deepseekUsage.ts";

// ──────────────────────────────
// ENV & GLOBALS
// ──────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const validEscalationLevels = ["Low", "Medium", "High", "Critical"] as const;

function resolveStageFromTimestamps(
  post: any,
): "quick" | "deep" | "deepest" | null {
  const hasQuick = !!post?.quick_analyzed_at;
  const hasDeep = !!post?.deep_analyzed_at;
  const hasDeepest = !!post?.deepest_analysis_completed_at;

  if (hasDeepest) return "deepest";
  if (hasDeep) return "deep";
  if (hasQuick) return "quick";
  return null;
}

async function callDeepseekWithRetry(
  prompt: string,
  maxRetries = 3,
): Promise<any> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DeepSeek API key not configured");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.15,
          max_tokens: 800,
        }),
      });

      if (!res.ok) {
        if (
          (res.status === 429 || res.status === 503) &&
          attempt < maxRetries - 1
        ) {
          const backoffDelay = Math.pow(2, attempt) * 2000;
          console.log(
            `⏳ Rate limited, retrying after ${backoffDelay}ms (attempt ${
              attempt + 1
            }/${maxRetries})...`,
          );
          await new Promise((r) => setTimeout(r, backoffDelay));
          continue;
        }
        const txt = await res.text();
        console.error("DeepSeek API error:", res.status, txt);
        throw new Error(`DeepSeek API error: ${res.status}`);
      }

      const data = await res.json();
      const content: string =
        data?.choices?.[0]?.message?.content ??
        '{"escalation_level":"High","strategic_summary":"خروجی مدل خالی بود.","key_risks":null,"audience_segments":null,"recommended_actions":null,"monitoring_indicators":null}';

      console.log("Raw DeepSeek response (deepest):", content);
      return data;
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries - 1) break;
      const backoffDelay = Math.pow(2, attempt) * 2000;
      console.log(
        `⏳ Retrying after error (attempt ${attempt + 1}/${maxRetries})...`,
      );
      await new Promise((r) => setTimeout(r, backoffDelay));
    }
  }

  throw lastError ?? new Error("DeepSeek call failed");
}

function parseDeepestResult(rawContent: string) {
  let result: any = {};

  try {
    const cleaned = rawContent
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in response");
    }

    const jsonString = jsonMatch[0];

    try {
      result = JSON.parse(jsonString);
    } catch (parseError) {
      console.warn("JSON parse error, attempting fix", parseError);
      const fixedJson = jsonString
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/'/g, "\"")
        .replace(/(\w+)\s*:/g, '"$1":');
      result = JSON.parse(fixedJson);
    }
  } catch (error) {
    console.error("Failed to parse DeepSeek response", error);
    result = {
      escalation_level: "High",
      strategic_summary:
        "خروجی مدل به‌درستی پارس نشد؛ این متن جایگزین موقت است.",
      key_risks: null,
      audience_segments: null,
      recommended_actions: null,
      monitoring_indicators: null,
    };
  }

  return result;
}

function normalizeEscalationLevel(level: unknown) {
  if (typeof level === "string") {
    const normalized = level.trim();
    const match = validEscalationLevels.find(
      (val) => val.toLowerCase() === normalized.toLowerCase(),
    );
    if (match) return match;
  }
  return "High";
}

function buildDeepestPrompt(post: any, relatedPosts: any[]) {
  const postSnippet = (post.analysis_summary || post.contents || "").slice(
    0,
    2000,
  );

  const relatedSection = relatedPosts
    .slice(0, 5)
    .map(
      (p: any, idx: number) =>
        `پست مرتبط ${idx + 1}: ${p.title || "(untitled)"}\nخلاصه: ${
          p.analysis_summary || ""
        }`,
    )
    .join("\n\n");

  const relatedBlock = relatedSection
    ? `\n\nنمونه‌هایی از پست‌های مشابه اخیر:\n${relatedSection}`
    : "";

  return `شما یک تحلیلگر ارشد جنگ شناختی و عملیات روانی هستید که باید عمیق‌ترین ارزیابی بحران را ارائه دهید. تمام متن‌های خروجی (به جز مقادیر انگلیسی در فیلدهای کلیدی) باید فارسی باشند و پاسخ فقط به صورت JSON بازگردد.

اطلاعات پست:
- عنوان: ${post.title || "(none)"}
- منبع: ${post.source || "(unknown)"}
- زبان: ${post.language || "(unknown)"}
- متن/خلاصه: ${postSnippet}

فراداده غربالگری سریع:
- is_psyop: ${post.is_psyop}
- psyop_risk_score: ${post.psyop_risk_score}
- threat_level: ${post.threat_level}
- stance_type: ${post.stance_type}
- psyop_category: ${post.psyop_category}
- psyop_techniques: ${
    Array.isArray(post.psyop_techniques)
      ? post.psyop_techniques.join(", ")
      : post.psyop_techniques || ""
  }
- psyop_review_status: ${post.psyop_review_status}

فراداده تحلیل عمیق:
- analysis_summary: ${post.analysis_summary}
- narrative_core: ${post.narrative_core}
- urgency_level: ${post.urgency_level}
- virality_potential: ${post.virality_potential}${relatedBlock}

دستورالعمل: فقط یک شیء JSON معتبر و بدون هیچ متن اضافی برگردان. همه متن‌ها باید فارسی باشند. ساختار دقیق خروجی:

{
  "escalation_level": "High",
  "strategic_summary": "چند جمله فارسی درباره اهمیت استراتژیک این محتوا.",
  "key_risks": ["ریسک ۱ به فارسی","ریسک ۲ به فارسی"],
  "audience_segments": ["عموم مردم","رسانه‌های منطقه‌ای"],
  "recommended_actions": ["اقدام ۱ به فارسی","اقدام ۲ به فارسی"],
  "monitoring_indicators": ["شاخص ۱ به فارسی","شاخص ۲ به فارسی"]
}

قواعد:
- escalation_level فقط یکی از Low، Medium، High، Critical باشد.
- strategic_summary باید ۳ تا ۶ جمله فارسی باشد.
- تمام آرایه‌ها باید آیتم‌های کوتاه و عملی فارسی داشته باشند.
- هیچ توضیح یا متن دیگری خارج از JSON برنگردان.`;
}

// ──────────────────────────────
// HTTP handler
// ──────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    if (!DEEPSEEK_API_KEY) {
      throw new Error("DeepSeek API key not configured");
    }

    const body = await req.json();
    const { postId } = body as { postId?: string };

    if (!postId) {
      return new Response(
        JSON.stringify({ error: "postId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`🚀 Starting deepest analysis for post ${postId}`);

    const { data: existingPost, error: postError } = await supabase
      .from("posts")
      .select(
        "id, title, source, language, contents, is_psyop, psyop_risk_score, threat_level, stance_type, psyop_category, psyop_techniques, psyop_review_status, analysis_summary, narrative_core, urgency_level, virality_potential, analysis_stage, quick_analyzed_at, deep_analyzed_at, deepest_analyzed_at, deepest_analysis_completed_at",
      )
      .eq("id", postId)
      .single();

    if (postError || !existingPost) {
      console.error("Post fetch error", postError);
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const rawStage = existingPost.analysis_stage ?? null;
    const resolvedStage = resolveStageFromTimestamps(existingPost);

    console.log(
      `🔎 Deepest-analysis stage check for post ${postId}: resolved=${resolvedStage}, raw=${rawStage}`,
    );

    if (resolvedStage !== "deep" && resolvedStage !== "deepest") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Post not ready for deepest analysis",
          stage: resolvedStage,
          raw_stage: rawStage,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // پست‌های مرتبط با همان منبع
    let relatedPosts: any[] = [];
    if (existingPost.source) {
      const { data: relatedData, error: relatedError } = await supabase
        .from("posts")
        .select("title, analysis_summary")
        .eq("source", existingPost.source)
        .eq("is_psyop", true)
        .neq("id", existingPost.id)
        .order("published_at", { ascending: false })
        .limit(5);

      if (relatedError) {
        console.warn("Related posts fetch warning", relatedError);
      } else if (relatedData && relatedData.length > 0) {
        relatedPosts = relatedData;
      }
    }

    const prompt = buildDeepestPrompt(existingPost, relatedPosts);
    const deepseekData = await callDeepseekWithRetry(prompt);
    const fallbackContent =
      '{"escalation_level":"High","strategic_summary":"خروجی مدل خالی بود.","key_risks":null,"audience_segments":null,"recommended_actions":null,"monitoring_indicators":null}';
    const llmRaw =
      deepseekData?.choices?.[0]?.message?.content ?? fallbackContent;
    const parsedResult = parseDeepestResult(llmRaw);
    const normalizedEscalation = normalizeEscalationLevel(
      parsedResult.escalation_level,
    );

    console.log("✅ Parsed deepest analysis JSON:", parsedResult);

    const now = new Date().toISOString();
    const deepestAnalyzedAt =
      existingPost.deepest_analyzed_at ?? now;
    const deepestAnalysisCompletedAt =
      existingPost.deepest_analysis_completed_at ?? now;

    const updatePayload = {
      analysis_stage: "deepest",
      status: "completed",
      deepest_analyzed_at: deepestAnalyzedAt,
      deepest_analysis_completed_at: deepestAnalysisCompletedAt,
      deepest_escalation_level: normalizedEscalation,
      deepest_strategic_summary: parsedResult.strategic_summary ?? null,
      deepest_key_risks: Array.isArray(parsedResult.key_risks)
        ? parsedResult.key_risks
        : null,
      deepest_audience_segments: Array.isArray(
        parsedResult.audience_segments,
      )
        ? parsedResult.audience_segments
        : null,
      deepest_recommended_actions: Array.isArray(
        parsedResult.recommended_actions,
      )
        ? parsedResult.recommended_actions
        : null,
      deepest_monitoring_indicators: Array.isArray(
        parsedResult.monitoring_indicators,
      )
        ? parsedResult.monitoring_indicators
        : null,
      deepest_raw: parsedResult,
    };

    const { error: updateError } = await supabase
      .from("posts")
      .update(updatePayload)
      .eq("id", postId);

    if (updateError) {
      console.error("Failed to update post", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save analysis" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const processingTime = Date.now() - startTime;
    const usage = deepseekData?.usage || {};

    await logDeepseekUsage(supabase, {
      endpoint: "deepest-analysis",
      functionName: "deepest-analysis",
      usage,
      responseTimeMs: processingTime,
      postId: postId,
    });

    const responsePayload = {
      post_id: postId,
      stage: "deepest_analysis",
      escalation_level: normalizedEscalation,
      strategic_summary: parsedResult.strategic_summary ?? null,
      key_risks: Array.isArray(parsedResult.key_risks)
        ? parsedResult.key_risks
        : null,
      audience_segments: Array.isArray(parsedResult.audience_segments)
        ? parsedResult.audience_segments
        : null,
      recommended_actions: Array.isArray(parsedResult.recommended_actions)
        ? parsedResult.recommended_actions
        : null,
      monitoring_indicators: Array.isArray(
        parsedResult.monitoring_indicators,
      )
        ? parsedResult.monitoring_indicators
        : null,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error in deepest-analysis", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
