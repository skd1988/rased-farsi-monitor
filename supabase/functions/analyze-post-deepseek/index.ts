// supabase/functions/analyze-post-deepseek/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logDeepseekUsage } from "../_shared/deepseekUsage.ts";

// ──────────────────────────────
// ENV & GLOBALS
// ──────────────────────────────
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

// ──────────────────────────────
// Helper functions
// ──────────────────────────────

function normalizeChoice(
  value: string | null | undefined,
  allowed: string[],
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return allowed.includes(trimmed) ? trimmed : null;
}

function normalizeArray<T = unknown>(value: unknown): T[] | null {
  return Array.isArray(value) ? (value as T[]) : null;
}

// sentiment در دیتابیس باید یکی از Positive / Negative / Neutral باشد
function normalizeSentiment(
  value: string | null | undefined,
): "Positive" | "Negative" | "Neutral" | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "positive") return "Positive";
  if (v === "negative") return "Negative";
  if (v === "neutral") return "Neutral";
  return null;
}

function deriveCurrentStage(post: any): "quick" | "deep" | "deepest" | null {
  if (post?.deepest_analysis_completed_at || post?.deepest_analyzed_at) {
    return "deepest";
  }
  if (post?.deep_analyzed_at) return "deep";
  if (post?.quick_analyzed_at) return "quick";
  return post?.analysis_stage ?? null;
}

function cleanJsonFromModel(raw: string): any {
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  return JSON.parse(cleaned);
}

// DeepSeek call با retry و backoff
async function callDeepseekWithRetry(
  body: unknown,
  maxRetries = 3,
): Promise<any> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY not configured");
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
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        // اگر rate limit / 5xx و هنوز فرصت retry داریم
        if (
          (res.status === 429 || res.status === 503 || res.status === 504) &&
          attempt < maxRetries - 1
        ) {
          const delay = Math.pow(2, attempt) * 3000;
          console.log(
            `⏳ DeepSeek rate limited (${res.status}), retry in ${delay}ms...`,
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        const txt = await res.text();
        console.error("DeepSeek API error:", res.status, txt);
        throw new Error(`DeepSeek API error: ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries - 1) break;
      const delay = Math.pow(2, attempt) * 3000;
      console.log(
        `⏳ Retrying after error (attempt ${attempt + 1}/${maxRetries})...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError ?? new Error("DeepSeek call failed");
}

// ──────────────────────────────
// HTTP handler
// ──────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    if (!DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY not configured");
    }

    const startTime = Date.now();

    const body = await req.json();
    const { postId } = body as { postId?: string };

    if (!postId) {
      return new Response(
        JSON.stringify({ success: false, error: "postId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`🚀 Starting deep analysis for post ${postId}`);

    // 1) خواندن پست برای داشتن context کامل
    const { data: existingPost, error: fetchError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (fetchError || !existingPost) {
      console.error("Failed to fetch post for context:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Post not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const quickScreeningContext = `نتایج غربالگری سریع (در پایگاه داده):
- is_psyop: ${existingPost.is_psyop}
- psyop_confidence: ${existingPost.psyop_confidence}
- threat_level: ${existingPost.threat_level}
- psyop_risk_score: ${existingPost.psyop_risk_score}
- stance_type: ${existingPost.stance_type}
- psyop_category: ${existingPost.psyop_category}
- psyop_techniques: ${
      Array.isArray(existingPost.psyop_techniques)
        ? existingPost.psyop_techniques.join(", ")
        : existingPost.psyop_techniques
    }

`;

    // 2) ساخت پرامپت فارسی برای DeepSeek
    const userPrompt = `${quickScreeningContext}تحلیل عمیق (سطح B) برای پست زیر را انجام بده. از داده‌های غربالگری سریع فقط به عنوان سرنخ استفاده کن و تحلیل مستقل و کامل ارائه بده:

عنوان: ${existingPost?.title ?? "(none)"}
محتوا: ${existingPost?.contents ?? existingPost?.summary ?? ""}
منبع: ${existingPost?.source ?? "نامشخص"}
زبان: ${existingPost?.language ?? "نامشخص"}
تاریخ: ${existingPost?.published_at ?? "نامشخص"}

خروجی باید فقط یک شیء JSON با ساختار زیر باشد (بدون هیچ متن اضافی یا مارک‌داون). توجه کن که تمام فیلدهای متنی (به‌جز techniques و keywords) باید حتماً به زبان فارسی باشند:

{
  "narrative_core": "یک خلاصه ۲ تا ۳ جمله‌ای فارسی از هسته اصلی روایت و چارچوب ذهنی محتوا.",
  "extended_summary": "یک خلاصه بلندتر فارسی (یک یا دو پاراگراف) که پیام‌ها و جهت‌گیری کلی محتوا را توضیح می‌دهد.",
  "psychological_objectives": [
    "تضعیف روحیه حامیان مقاومت",
    "ایجاد ترس و بی‌اعتمادی در میان افکار عمومی"
  ],
  "manipulation_intensity": "High",
  "sentiment": "negative",
  "urgency_level": "High",
  "virality_potential": "Medium",
  "techniques": [
    "demonization",
    "fear_mongering",
    "division_creation"
  ],
  "keywords": [
    "Hezbollah",
    "missiles",
    "civilians"
  ],
  "recommended_actions": [
    "توضیح شفاف واقعیت‌ها و رفع ابهام‌ها در یک بیانیه رسمی.",
    "انتشار روایات جایگزین که اقدامات دفاعی و مشروعیت مقاومت را برجسته می‌کند."
  ]
}

قوانین مهم:
- تمام متن‌ها (narrative_core، extended_summary، psychological_objectives، recommended_actions) باید فارسی باشند.
- فقط مقادیر techniques و keywords می‌توانند انگلیسی باشند.
- manipulation_intensity باید فقط یکی از این مقادیر باشد: "Low" | "Medium" | "High".
- sentiment باید یکی از این مقادیر باشد: "positive" | "negative" | "neutral".
- urgency_level باید یکی از این مقادیر باشد: "Low" | "Medium" | "High" | "Critical".
- virality_potential باید یکی از این مقادیر باشد: "Low" | "Medium" | "High".
- psychological_objectives و recommended_actions باید آرایه‌ای از عبارات کوتاه و کاربردی فارسی باشند.
- techniques باید آرایه‌ای از این گزینه‌ها باشد: "demonization", "fear_mongering", "division_creation", "confusion", "ridicule", "character_assassination", "agenda_shifting", "disinformation".
- keywords باید آرایه‌ای از واژه‌ها/اسامی مهم (افراد، مکان‌ها، سازمان‌ها، مفاهیم) باشد.

در انتهای پاسخ این دستور را رعایت کن: فقط و فقط JSON معتبر با همین فیلدها برگردان و هیچ متن دیگری اضافه نکن.`;

    const deepseekBody = {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            `شما یک تحلیلگر ارشد جنگ روانی و عملیات روانی هستید که تخصص در شناسایی و تحلیل حملات اطلاعاتی علیه جبهه مقاومت دارید.

محور مقاومت شامل: جمهوری اسلامی ایران، حزب‌الله لبنان، حشد الشعبی عراق، انصارالله یمن، حماس فلسطین، جهاد اسلامی فلسطین، سایر گروه‌های مقاومت.

دشمنان شناخته‌شده: رژیم صهیونیستی (اسرائیل)، ایالات متحده، رسانه‌های غربی وابسته، برخی کشورهای عربی همسو با غرب، گروه‌های تکفیری.`,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    };

    // 3) فراخوانی DeepSeek
    const data = await callDeepseekWithRetry(deepseekBody);

    // 4) نرمال‌سازی خروجی
    let analysisResult: any;
    try {
      const content =
        data?.choices?.[0]?.message?.content ??
        JSON.stringify(
          {
            error: "Empty content from DeepSeek",
          },
        );
      analysisResult = cleanJsonFromModel(content);
      console.log("✅ Parsed deep analysis JSON:", analysisResult);
    } catch (e) {
      console.error("Failed to parse DeepSeek response:", e);
      throw new Error("Failed to parse DeepSeek response as JSON");
    }

    const allowedManipulationValues = ["Low", "Medium", "High"];
    const allowedSentimentValues = ["positive", "negative", "neutral"];
    const allowedUrgencyValues = ["Low", "Medium", "High", "Critical"];
    const allowedViralityValues = ["Low", "Medium", "High"];

    const narrativeCore: string | null = analysisResult?.narrative_core ?? null;
    const extendedSummary: string | null =
      analysisResult?.extended_summary ?? narrativeCore ?? null;
    const psychologicalObjectives = normalizeArray<string>(
      analysisResult?.psychological_objectives,
    );
    const manipulationIntensity = normalizeChoice(
      analysisResult?.manipulation_intensity,
      allowedManipulationValues,
    );
    const sentimentRaw = normalizeChoice(
      analysisResult?.sentiment,
      allowedSentimentValues,
    );

    const sentimentValue =
      normalizeSentiment(sentimentRaw ?? existingPost?.sentiment ?? null);

    const urgencyLevel = normalizeChoice(
      analysisResult?.urgency_level,
      allowedUrgencyValues,
    );
    const viralityPotential = normalizeChoice(
      analysisResult?.virality_potential,
      allowedViralityValues,
    );
    const techniques = normalizeArray<string>(analysisResult?.techniques);
    const keywords = normalizeArray<string>(analysisResult?.keywords);
    const recommendedActions = normalizeArray<string>(
      analysisResult?.recommended_actions,
    );

    const processingTime = Date.now() - startTime;

    // 5) آپدیت ردیف posts
    const completionTimestamp = new Date().toISOString();
    const currentStage = deriveCurrentStage(existingPost);
    const nextStage = currentStage === "deepest" ? "deepest" : "deep";

    const updateData: Record<string, any> = {
      // Summary fields
      analysis_summary:
        extendedSummary ?? existingPost?.analysis_summary ?? null,
      main_topic: existingPost?.main_topic ?? null,
      keywords: keywords ?? existingPost?.keywords ?? null,

      // Deep Analysis fields
      narrative_core: narrativeCore ?? existingPost?.narrative_core ?? null,
      extended_summary:
        extendedSummary ?? existingPost?.extended_summary ?? null,
      psychological_objectives:
        psychologicalObjectives ??
        existingPost?.psychological_objectives ??
        null,
      manipulation_intensity:
        manipulationIntensity ??
        existingPost?.manipulation_intensity ??
        null,
      techniques:
        techniques ??
        existingPost?.techniques ??
        existingPost?.psyop_techniques ??
        null,
      recommended_actions:
        recommendedActions ?? existingPost?.recommended_actions ?? null,
      recommended_action: recommendedActions
        ? recommendedActions.join("\n")
        : existingPost?.recommended_action ?? null,

      // Deep mirrors
      deep_main_topic: narrativeCore ?? existingPost?.deep_main_topic ?? null,
      deep_smart_summary:
        extendedSummary ??
        narrativeCore ??
        existingPost?.deep_smart_summary ??
        null,
      deep_extended_summary:
        extendedSummary ?? existingPost?.deep_extended_summary ?? null,
      deep_psychological_objectives:
        psychologicalObjectives ??
        existingPost?.deep_psychological_objectives ??
        null,
      deep_manipulation_intensity:
        manipulationIntensity ??
        existingPost?.deep_manipulation_intensity ??
        null,
      deep_techniques:
        techniques ??
        existingPost?.deep_techniques ??
        existingPost?.psyop_techniques ??
        null,
      deep_keywords:
        keywords ??
        existingPost?.deep_keywords ??
        existingPost?.keywords ??
        null,
      deep_recommended_actions:
        recommendedActions ??
        existingPost?.deep_recommended_actions ??
        null,
      deep_recommended_action: recommendedActions
        ? recommendedActions.join("\n")
        : existingPost?.deep_recommended_action ?? null,

      // Quick-screen preserved / optional overrides
      is_psyop:
        typeof analysisResult?.is_psyop === "boolean"
          ? analysisResult.is_psyop
          : existingPost?.is_psyop ?? null,
      psyop_confidence: existingPost?.psyop_confidence ?? null,
      psyop_risk_score: existingPost?.psyop_risk_score ?? null,
      psyop_category:
        analysisResult?.psyop_category ??
        existingPost?.psyop_category ??
        null,
      narrative_theme:
        analysisResult?.narrative_theme ??
        existingPost?.narrative_theme ??
        null,

      sentiment: sentimentValue ?? existingPost?.sentiment ?? null,
      urgency_level: urgencyLevel ?? existingPost?.urgency_level ?? null,
      virality_potential:
        viralityPotential ?? existingPost?.virality_potential ?? null,

      deep_sentiment: sentimentValue ?? existingPost?.deep_sentiment ?? null,
      deep_urgency_level:
        urgencyLevel ?? existingPost?.deep_urgency_level ?? null,
      deep_virality_potential:
        viralityPotential ??
        existingPost?.deep_virality_potential ??
        null,

      threat_level: existingPost?.threat_level ?? null,
      confidence: existingPost?.psyop_confidence ?? null,
      key_points: existingPost?.key_points ?? null,

      // Required system fields
      analyzed_at: completionTimestamp,
      analysis_model: "deepseek-chat",
      processing_time: processingTime / 1000,

      status: "completed",
      analysis_stage: nextStage,
      deep_analyzed_at:
        existingPost?.deep_analyzed_at ?? completionTimestamp,
    };

    const { error: updateError } = await supabase
      .from("posts")
      .update(updateData)
      .eq("id", postId);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      throw updateError;
    }

    console.log(
      `📌 Deep analysis update => status: completed | stage: ${nextStage} | deep_analyzed_at: ${updateData.deep_analyzed_at}`,
    );

    // 6) ثبت لاگ مصرف API
    const usage = data?.usage || {};

    await logDeepseekUsage(supabase, {
      endpoint: "deep-analysis",
      functionName: "analyze-post-deepseek",
      usage,
      responseTimeMs: processingTime,
      postId: postId,
    });

    console.log(`✅ Successfully analyzed post ${postId}`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          post_id: postId,
          stage: "deep_analysis",
          narrative_core: narrativeCore,
          extended_summary: extendedSummary,
          psychological_objectives: psychologicalObjectives,
          manipulation_intensity: manipulationIntensity,
          sentiment: sentimentValue,
          urgency_level: urgencyLevel,
          virality_potential: viralityPotential,
          techniques,
          keywords,
          recommended_actions: recommendedActions,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in analyze-post-deepseek:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
