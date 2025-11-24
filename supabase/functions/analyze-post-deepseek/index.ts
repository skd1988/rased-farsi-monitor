import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------- ENV ----------
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

// ✅ فقط یک‌بار کلاینت سوپابیس ساخته می‌شود
const supabaseClient =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!supabaseClient) {
      throw new Error("Supabase client not initialized");
    }
    if (!DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY not configured");
    }

    const {
      postId,
      title,
      contents,
      source,
      language,
      published_at,
      quickDetectionResult,
    } = await req.json();

    console.log(`🚀 Starting deep analysis for post ${postId}: ${title}`);

    // ---------- 1) خواندن پست برای کانتکست ----------
    const { data: existingPost, error: fetchError } = await supabaseClient
      .from("posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (fetchError) {
      console.error("Failed to fetch post for context:", fetchError);
    }

    const quickScreeningContext = existingPost
      ? `نتایج غربالگری سریع (در دسترس در پایگاه داده):
- is_psyop: ${existingPost.is_psyop}
- psyop_confidence: ${existingPost.psyop_confidence}
- stance_type: ${existingPost.stance_type}
- psyop_category: ${existingPost.psyop_category}
- psyop_techniques: ${
          Array.isArray(existingPost.psyop_technique)
            ? existingPost.psyop_technique.join(", ")
            : existingPost.psyop_technique
        }
`
      : "";

    const startTime = Date.now();

    // ---------- 2) فراخوانی DeepSeek با retry ----------
    let response: Response | undefined;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        response = await fetch(
          "https://api.deepseek.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [
                {
                  role: "system",
                  content: `شما یک تحلیلگر ارشد جنگ روانی و عملیات روانی هستید که تخصص در شناسایی و تحلیل حملات اطلاعاتی علیه جبهه مقاومت دارید.

محور مقاومت شامل: جمهوری اسلامی ایران، حزب‌الله لبنان، حشد الشعبی عراق، انصارالله یمن، حماس فلسطین، جهاد اسلامی فلسطین، سایر گروه‌های مقاومت.

دشمنان شناخته‌شده: رژیم صهیونیستی (اسرائیل)، ایالات متحده، رسانه‌های غربی وابسته، برخی کشورهای عربی همسو با غرب، گروه‌های تکفیری.`,
                },
                {
                  role: "user",
                  content: `${
                    quickDetectionResult
                      ? `نتیجه غربالگری سریع (ارسال‌شده در درخواست):
- is_psyop: ${
                          quickDetectionResult.is_psyop ??
                          (quickDetectionResult?.psyop_confidence
                            ? "Yes"
                            : "Uncertain")
                        }
- psyop_confidence: ${quickDetectionResult.psyop_confidence}
- threat_level: ${quickDetectionResult.threat_level}
- primary_target: ${
                          quickDetectionResult.primary_target || "نامشخص"
                        }
- psyop_category: ${
                          quickDetectionResult.psyop_category || "نامشخص"
                        }
- psyop_techniques: ${
                          Array.isArray(quickDetectionResult.psyop_technique)
                            ? quickDetectionResult.psyop_technique.join(", ")
                            : quickDetectionResult.psyop_technique || "نامشخص"
                        }

`
                      : ""
                  }${quickScreeningContext}تحلیل عمیق (سطح B) برای پست زیر را انجام بده. از داده‌های غربالگری سریع فقط به عنوان سرنخ استفاده کن و تحلیل مستقل و کامل ارائه بده.

عنوان: ${title}
محتوا: ${contents}
منبع: ${source}
زبان: ${language}
تاریخ: ${published_at}

الزام‌های حیاتی:
- خروجی باید فقط یک شیء JSON معتبر باشد و هیچ متن اضافی یا فرمت مارک‌داون نداشته باشد.
- همه فیلدهای متنی (به جز techniques و keywords) باید حتماً فارسی باشند و از زبان انگلیسی در آن‌ها استفاده نشود.
- techniques و keywords می‌توانند انگلیسی باشند.

ساختار JSON مورد انتظار:
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
- techniques باید آرایه‌ای از گزینه‌های محدود باشد: "demonization", "fear_mongering", "division_creation", "confusion", "ridicule", "character_assassination", "agenda_shifting", "disinformation".
- keywords باید آرایه‌ای از واژه‌ها/اسامی مهم (افراد، مکان‌ها، سازمان‌ها، مفاهیم) باشد.

در پایان: فقط و فقط JSON معتبر با همین فیلدها برگردان و هیچ متن دیگری اضافه نکن.`,
                },
              ],
              temperature: 0.3,
              max_tokens: 2000,
            }),
          },
        );

        if (!response.ok) {
          if (
            (response.status === 429 ||
              response.status === 503 ||
              response.status === 504) &&
            attempt < maxRetries - 1
          ) {
            const backoffDelay = Math.pow(2, attempt) * 3000;
            console.log(
              `⏳ Rate limited, retrying after ${backoffDelay}ms (attempt ${
                attempt + 1
              }/${maxRetries})...`,
            );
            await new Promise((r) => setTimeout(r, backoffDelay));
            continue;
          }
          const errorText = await response.text();
          console.error("DeepSeek API error:", response.status, errorText);
          throw new Error(`DeepSeek API error: ${response.status}`);
        }

        break; // success
      } catch (err) {
        if (attempt === maxRetries - 1) throw err;
        const backoffDelay = Math.pow(2, attempt) * 3000;
        console.log(
          `⏳ Retrying after error (attempt ${attempt + 1}/${maxRetries})...`,
        );
        await new Promise((r) => setTimeout(r, backoffDelay));
      }
    }

    if (!response) {
      throw new Error("Failed to get response from DeepSeek API after retries");
    }

    const data = await response.json();

    // ---------- 3) نرمال‌سازی خروجی ----------
    let analysisResult: any;
    try {
      const content = data.choices[0].message.content as string;
      const cleanContent = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      analysisResult = JSON.parse(cleanContent);
      console.log("✅ Parsed deep analysis JSON:", analysisResult);
    } catch (e) {
      console.error("Failed to parse DeepSeek response:", e);
      throw new Error("Failed to parse DeepSeek response as JSON");
    }

    const normalizeArray = (v: unknown) => (Array.isArray(v) ? v : null);

    const narrativeCore: string | null = analysisResult?.narrative_core ?? null;
    const extendedSummary: string | null =
      analysisResult?.extended_summary ?? narrativeCore ?? null;
    const psychologicalObjectives = normalizeArray(
      analysisResult?.psychological_objectives,
    );
    const techniques = normalizeArray(analysisResult?.techniques);
    const keywords = normalizeArray(analysisResult?.keywords);
    const recommendedActions = normalizeArray(
      analysisResult?.recommended_actions,
    );

    const allowedUrgencyValues = ["Low", "Medium", "High", "Critical"] as const;
    const allowedViralityValues = ["Low", "Medium", "High"] as const;
    const normalizeChoice = (
      value: unknown,
      allowed: readonly string[],
    ): string | null => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return allowed.includes(trimmed) ? trimmed : null;
    };

    const urgencyLevel = normalizeChoice(
      analysisResult?.urgency_level,
      allowedUrgencyValues,
    );
    const viralityPotential = normalizeChoice(
      analysisResult?.virality_potential,
      allowedViralityValues,
    );
    const sentimentValue =
      typeof analysisResult?.sentiment === "string"
        ? analysisResult.sentiment
        : null;
    const manipulationIntensity =
      typeof analysisResult?.manipulation_intensity === "string"
        ? analysisResult.manipulation_intensity
        : null;

    const processingTime = Date.now() - startTime;

    // ---------- 4) آپدیت پست در Supabase ----------
    const { error } = await supabaseClient
      .from("posts")
      .update({
        analysis_stage: "deep",
        status: "completed",
        deep_analyzed_at: new Date().toISOString(),

        analysis_summary: extendedSummary,
        narrative_theme: narrativeCore,
        recommended_action: recommendedActions
          ? recommendedActions.join("\n")
          : null,

        keywords,
        psyop_technique: techniques,

        urgency_level: urgencyLevel,
        virality_potential: viralityPotential,
        manipulation_intensity: manipulationIntensity,
        sentiment: sentimentValue,

        analysis_model: "deepseek-chat",
        processing_time: processingTime / 1000,
      })
      .eq("id", postId);

    if (error) {
      console.error("Supabase update error:", error);
      throw error;
    }

    console.log("✅ Deep analysis saved to database for post", postId);

    // ---------- 5) لاگ استفاده از API ----------
    await supabaseClient.from("api_usage_logs").insert({
      model_used: "deepseek-chat",
      input_tokens: data.usage?.prompt_tokens || 0,
      output_tokens: data.usage?.completion_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0,
      cost_usd: (data.usage?.total_tokens || 0) * 0.00000014,
      response_time_ms: processingTime,
      status: "success",
      post_id: postId,
    });

    console.log(`Successfully analyzed post ${postId}`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          post_id: postId,
          stage: "deep_analysis",
          narrative_core: narrativeCore,
          extended_summary: extendedSummary,
          psychological_objectives: psychologicalObjectives,
          urgency_level: urgencyLevel,
          virality_potential: viralityPotential,
          techniques,
          keywords,
          recommended_actions: recommendedActions,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
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
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
