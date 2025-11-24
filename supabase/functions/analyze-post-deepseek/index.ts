import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { postId, title, contents, source, language, published_at, quickDetectionResult } = await req.json();
    console.log(`Analyzing post ${postId}: ${title}`);
    if (!DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY not configured");
    }
    const startTime = Date.now();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: existingPost, error: fetchError } = await supabase.from("posts").select("*").eq("id", postId).single();
    if (fetchError) {
      console.error("Failed to fetch post for context:", fetchError);
    }
    const quickScreeningContext = existingPost ? `نتایج غربالگری سریع (در دسترس در پایگاه داده):\n- is_psyop: ${existingPost.is_psyop}\n- psyop_confidence: ${existingPost.psyop_confidence}\n- stance_type: ${existingPost.stance_type}\n- psyop_category: ${existingPost.psyop_category}\n- psyop_techniques: ${Array.isArray(existingPost.psyop_technique) ? existingPost.psyop_technique.join(', ') : existingPost.psyop_technique}\n` : '';
    // DeepSeek API call with retry logic
    let response;
    const maxRetries = 3;
    for(let attempt = 0; attempt < maxRetries; attempt++){
      try {
        response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              {
                role: "system",
                content: `شما یک تحلیلگر ارشد جنگ روانی و عملیات روانی هستید که تخصص در شناسایی و تحلیل حملات اطلاعاتی علیه جبهه مقاومت دارید.

محور مقاومت شامل: جمهوری اسلامی ایران، حزب‌الله لبنان، حشد الشعبی عراق، انصارالله یمن، حماس فلسطین، جهاد اسلامی فلسطین، سایر گروه‌های مقاومت.

دشمنان شناخته‌شده: رژیم صهیونیستی (اسرائیل)، ایالات متحده، رسانه‌های غربی وابسته، برخی کشورهای عربی همسو با غرب، گروه‌های تکفیری.`
              },
              {
                role: "user",
                content: `${quickDetectionResult ? `نتیجه غربالگری سریع (ارسال‌شده در درخواست):
- is_psyop: ${quickDetectionResult.is_psyop ?? quickDetectionResult?.psyop_confidence ? 'Yes' : 'Uncertain'}
- psyop_confidence: ${quickDetectionResult.psyop_confidence}
- threat_level: ${quickDetectionResult.threat_level}
- primary_target: ${quickDetectionResult.primary_target || 'نامشخص'}
- psyop_category: ${quickDetectionResult.psyop_category || 'نامشخص'}
- psyop_techniques: ${Array.isArray(quickDetectionResult.psyop_technique) ? quickDetectionResult.psyop_technique.join(', ') : quickDetectionResult.psyop_technique || 'نامشخص'}

` : ''}${quickScreeningContext}تحلیل عمیق (سطح B) برای پست زیر را انجام بده. از داده‌های غربالگری سریع فقط به عنوان سرنخ استفاده کن و تحلیل مستقل و کامل ارائه بده:

عنوان: ${title}
محتوا: ${contents}
منبع: ${source}
زبان: ${language}
تاریخ: ${published_at}

خروجی باید فقط یک شیء JSON با ساختار زیر باشد (بدون هیچ متن اضافی یا مارک‌داون):
{
  "narrative_core": "A short 2–3 sentence description of the main narrative and framing.",
  "extended_summary": "A longer paragraph (or two) summarizing the content and its messaging.",
  "psychological_objectives": [
    "demoralize resistance supporters",
    "create fear among civilians"
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
    "Clarify factual inaccuracies in a separate statement.",
    "Publish counter-narratives highlighting civilian protection efforts."
  ]
}

قوانین مهم:
- manipulation_intensity باید فقط یکی از این مقادیر باشد: "Low" | "Medium" | "High".
- sentiment باید یکی از این مقادیر باشد: "positive" | "negative" | "neutral".
- urgency_level باید یکی از این مقادیر باشد: "Low" | "Medium" | "High" | "Critical".
- virality_potential باید یکی از این مقادیر باشد: "Low" | "Medium" | "High".
- psychological_objectives و recommended_actions باید آرایه‌ای از عبارات کوتاه و کاربردی باشند.
- techniques باید آرایه‌ای از گزینه‌های محدود باشد: "demonization", "fear_mongering", "division_creation", "confusion", "ridicule", "character_assassination", "agenda_shifting", "disinformation".
- keywords باید آرایه‌ای از واژه‌ها/اسامی مهم (افراد، مکان‌ها، سازمان‌ها، مفاهیم) باشد.

در انتهای پاسخ این دستور را رعایت کن: Return ONLY valid JSON with exactly these fields and no extra text.`
              }
            ],
            temperature: 0.3,
            max_tokens: 2000
          })
        });
        if (!response.ok) {
          // If rate limited, retry with exponential backoff
          if ((response.status === 429 || response.status === 503 || response.status === 504) && attempt < maxRetries - 1) {
            const backoffDelay = Math.pow(2, attempt) * 3000;
            console.log(`⏳ Rate limited, retrying after ${backoffDelay}ms (attempt ${attempt + 1}/${maxRetries})...`);
            await new Promise((resolve)=>setTimeout(resolve, backoffDelay));
            continue;
          }
          const errorText = await response.text();
          console.error("DeepSeek API error:", response.status, errorText);
          throw new Error(`DeepSeek API error: ${response.status}`);
        }
        break;
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;
        const backoffDelay = Math.pow(2, attempt) * 3000;
        console.log(`⏳ Retrying after error (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((resolve)=>setTimeout(resolve, backoffDelay));
      }
    }
    if (!response) {
      throw new Error('Failed to get response from DeepSeek API after retries');
    }
    const data = await response.json();
    let analysisResult;
    try {
      const content = data.choices[0].message.content;
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysisResult = JSON.parse(cleanContent);
    } catch (e) {
      console.error("Failed to parse DeepSeek response:", e);
      throw new Error("Failed to parse DeepSeek response as JSON");
    }
    const allowedManipulationValues = [
      "Low",
      "Medium",
      "High"
    ];
    const allowedSentimentValues = [
      "positive",
      "negative",
      "neutral"
    ];
    const allowedUrgencyValues = [
      "Low",
      "Medium",
      "High",
      "Critical"
    ];
    const allowedViralityValues = [
      "Low",
      "Medium",
      "High"
    ];
    const normalizeChoice = (value, allowed)=>{
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return allowed.includes(trimmed) ? trimmed : null;
    };
    const normalizeArray = (value)=>Array.isArray(value) ? value : null;
    const narrativeCore = analysisResult?.narrative_core ?? null;
    const extendedSummary = analysisResult?.extended_summary ?? narrativeCore ?? null;
    const psychologicalObjectives = normalizeArray(analysisResult?.psychological_objectives);
    const manipulationIntensity = normalizeChoice(analysisResult?.manipulation_intensity, allowedManipulationValues);
    const sentimentValue = normalizeChoice(analysisResult?.sentiment, allowedSentimentValues);
    const urgencyLevel = normalizeChoice(analysisResult?.urgency_level, allowedUrgencyValues);
    const viralityPotential = normalizeChoice(analysisResult?.virality_potential, allowedViralityValues);
    const techniques = normalizeArray(analysisResult?.techniques);
    const keywords = normalizeArray(analysisResult?.keywords);
    const recommendedActions = normalizeArray(analysisResult?.recommended_actions);
    const processingTime = Date.now() - startTime;
    // Update post in Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase.from("posts").update({
      analysis_summary: extendedSummary,
      sentiment: sentimentValue ?? existingPost?.sentiment ?? null,
      sentiment_score: existingPost?.sentiment_score ?? null,
      main_topic: existingPost?.main_topic ?? null,
      keywords: keywords ?? existingPost?.keywords ?? null,
      is_psyop: existingPost?.is_psyop ?? null,
      psyop_confidence: existingPost?.psyop_confidence ?? null,
      target_entity: existingPost?.target_entity ?? null,
      target_persons: existingPost?.target_persons ?? null,
      psyop_technique: techniques ?? existingPost?.psyop_technique ?? null,
      narrative_theme: narrativeCore ?? existingPost?.narrative_theme ?? null,
      psyop_type: existingPost?.psyop_type ?? null,
      threat_level: existingPost?.threat_level ?? null,
      confidence: existingPost?.psyop_confidence ?? null,
      key_points: existingPost?.key_points ?? null,
      recommended_action: recommendedActions ? recommendedActions.join("\n") : existingPost?.recommended_action ?? null,
      urgency_level: urgencyLevel ?? existingPost?.urgency_level ?? null,
      virality_potential: viralityPotential ?? existingPost?.virality_potential ?? null,
      manipulation_intensity: manipulationIntensity ?? existingPost?.manipulation_intensity ?? null,
      analyzed_at: new Date().toISOString(),
      analysis_model: "deepseek-chat",
      processing_time: processingTime / 1000,
      status: "analyzed",
      analysis_stage: "deep" // Mark as deep analysis complete
    }).eq("id", postId);
    if (error) {
      console.error("Supabase update error:", error);
      throw error;
    }
    // Log API usage
    await supabase.from("api_usage_logs").insert({
      model_used: "deepseek-chat",
      input_tokens: data.usage?.prompt_tokens || 0,
      output_tokens: data.usage?.completion_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0,
      cost_usd: (data.usage?.total_tokens || 0) * 0.00000014,
      response_time_ms: processingTime,
      status: "success",
      post_id: postId
    });
    console.log(`Successfully analyzed post ${postId}`);
    return new Response(JSON.stringify({
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
        recommended_actions: recommendedActions
      }
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error in analyze-post-deepseek:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
