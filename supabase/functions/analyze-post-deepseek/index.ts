import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postId, title, contents, source, language, published_at } = await req.json();
    
    console.log(`Analyzing post ${postId}: ${title}`);

    if (!DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY not configured");
    }

    const startTime = Date.now();

    // DeepSeek API call
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
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
            content: `مطلب زیر را تحلیل کنید:

عنوان: ${title}
محتوا: ${contents}
منبع: ${source}
زبان: ${language}
تاریخ: ${published_at}

فقط JSON خروجی بدهید (بدون markdown):

{
  "is_psyop": "Yes" یا "No" یا "Uncertain",
  "psyop_confidence": عدد 0-100,
  "psyop_type": "Direct Attack" | "Indirect Accusation" | "Doubt Creation" | "False Flag" | "Demoralization" | "Division Creation" | "Information Warfare" | "Propaganda Campaign" | null,
  "primary_target": "نام دقیق نهاد از لیست محور مقاومت یا null",
  "secondary_targets": ["نهاد1", "نهاد2"] یا [],
  "targeted_persons": ["نام شخص1"] یا [],
  "target_category": "Leadership" | "Military Forces" | "Political Wing" | "Social Base" | "International Support" | null,
  "attack_vectors": ["Human Rights Violations", "Terrorism Labeling", "Sectarian Division", "Foreign Interference", "Corruption Allegations", "Weakness Portrayal", "Legitimacy Questioning", "Historical Revisionism"],
  "narrative_theme": "Delegitimization" | "Demonization" | "Isolation" | "Normalization of Enemy" | "Internal Conflict" | null,
  "threat_level": "Critical" | "High" | "Medium" | "Low",
  "virality_potential": عدد 0-10,
  "coordination_indicators": ["Similar Timing", "Same Keywords", "Multiple Sources", "Cross-Platform", "Synchronized Release"],
  "evidence_type": ["Fabricated", "Manipulated", "Out of Context", "Unverified", "Partial Truth", "Opinion as Fact"],
  "source_credibility": "Known Enemy Source" | "Suspicious Source" | "Neutral Source" | "Unclear Source",
  "urgency_level": "Immediate" | "High" | "Medium" | "Low" | "Monitor Only",
  "summary": "خلاصه فارسی در 2-3 جمله",
  "recommended_response": "استراتژی پاسخ در 3-5 جمله فارسی",
  "counter_narrative_points": ["نکته اول", "نکته دوم", "نکته سوم"],
  "suggested_spokespeople": ["Official Media", "Political Leadership", "Military Spokesperson", "Religious Authority", "Social Media Activists", "International Partners"],
  "response_channels": ["Official Statement", "Social Media Campaign", "Press Conference", "Documentary Evidence", "Expert Analysis", "Grassroots Mobilization"],
  "keywords": ["کلمه1", "کلمه2", "کلمه3", "کلمه4", "کلمه5"],
  "sentiment": "Positive" | "Negative" | "Neutral",
  "sentiment_score": عدد -1.0 تا +1.0,
  "main_topic": "سیاسی" | "نظامی" | "اقتصادی" | "اجتماعی" | "فرهنگی" | "مذهبی",
  "campaign_indicators": {
    "is_part_of_campaign": true | false,
    "campaign_name_suggestion": "نام پیشنهادی یا null",
    "similar_content_keywords": ["کلمه1", "کلمه2"]
  }
}

معیارهای تشخیص:
- is_psyop = "Yes": اتهامات بدون مدرک، تحریف واقعیات، برچسب‌زنی منفی، ایجاد شبهه، نمایش ضعف، ایجاد اختلاف
- threat_level = "Critical": رسانه قدرتمند، وایرال، اتهامات جدی، کمپین هماهنگ، هدف شخصیت برجسته
- urgency_level = "Immediate": در حال وایرال شدن، رسانه‌های متعدد همزمان، اتهام علیه رهبری، خطر آسیب به افکار عمومی`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek API error:", response.status, errorText);
      throw new Error(`DeepSeek API error: ${response.status}`);
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

    const processingTime = Date.now() - startTime;

    // Update post in Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { error } = await supabase
      .from("posts")
      .update({
        analysis_summary: analysisResult.summary,
        sentiment: analysisResult.sentiment,
        sentiment_score: analysisResult.sentiment_score,
        main_topic: analysisResult.main_topic,
        keywords: analysisResult.keywords,
        is_psyop: analysisResult.is_psyop === "Yes",
        psyop_confidence: analysisResult.psyop_confidence,
        target_entity: analysisResult.secondary_targets.length > 0 
          ? [analysisResult.primary_target, ...analysisResult.secondary_targets].filter(Boolean)
          : analysisResult.primary_target ? [analysisResult.primary_target] : [],
        target_persons: analysisResult.targeted_persons,
        psyop_technique: analysisResult.attack_vectors,
        threat_level: analysisResult.threat_level,
        confidence: analysisResult.psyop_confidence,
        key_points: analysisResult.counter_narrative_points,
        recommended_action: analysisResult.recommended_response,
        analyzed_at: new Date().toISOString(),
        analysis_model: "deepseek-chat",
        processing_time: processingTime / 1000,
        status: "analyzed"
      })
      .eq("id", postId);

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

    return new Response(
      JSON.stringify({ success: true, analysis: analysisResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-post-deepseek:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
