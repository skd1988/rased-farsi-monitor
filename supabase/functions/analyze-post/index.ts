import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("🚀 analyze-post function started");

  try {
    const { postId, postTitle, postContent } = await req.json();

    // Validate input
    if (!postId || !postContent) {
      console.error("❌ Missing required fields");
      return new Response(JSON.stringify({ error: "postId and postContent are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check API key
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!deepseekApiKey) {
      console.error("❌ DEEPSEEK_API_KEY not configured");
      return new Response(
        JSON.stringify({
          error: "API key not configured",
          code: "MISSING_API_KEY",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const startTime = Date.now();

    // Prepare prompt for DeepSeek
    const prompt = `تو یک تحلیلگر رسانه‌ای حرفه‌ای هستی. این مطلب خبری رو تحلیل کن:

عنوان: ${postTitle}
محتوا: ${postContent}

لطفاً خروجی رو دقیقاً به این فرمت JSON بده (بدون هیچ توضیح اضافی):

{
  "summary": "خلاصه محتوا در 2-3 جمله فارسی",
  "sentiment": "Positive یا Negative یا Neutral",
  "sentiment_score": عدد بین -1.0 تا +1.0,
  "main_topic": "جنگ روانی یا محور مقاومت یا اتهام یا شبهه یا کمپین یا تحلیل سیاسی یا اخبار عادی",
  "threat_level": "Critical یا High یا Medium یا Low",
  "confidence": عدد بین 0 تا 100,
  "key_points": ["نکته 1", "نکته 2", "نکته 3"],
  "recommended_action": "اقدام پیشنهادی در یک جمله فارسی",
  "keywords": ["کلمه1", "کلمه2", "کلمه3"]
}

معیارهای ارزیابی:
- Threat Level Critical: محتوای وایرال، اتهامات جدی، کمپین هماهنگ شده
- Threat Level High: محتوای تأثیرگذار
- Threat Level Medium: محتوای معمولی با کلیدواژه‌های مرتبط
- Threat Level Low: اشاره غیرمستقیم`;

    console.log("📞 Calling DeepSeek API...");

    // Call DeepSeek API
    const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    // Handle API errors
    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error("❌ DeepSeek API error:", deepseekResponse.status, errorText);

      if (deepseekResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again later.",
            code: "RATE_LIMIT",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      throw new Error(`DeepSeek API error: ${deepseekResponse.status}`);
    }

    const deepseekData = await deepseekResponse.json();
    const responseContent = deepseekData.choices[0].message.content;

    // Extract JSON from response
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from response");
    }

    const analysis = JSON.parse(jsonMatch[0]);
    const processingTime = (Date.now() - startTime) / 1000;

    console.log("✅ Analysis completed successfully");

    // Return standardized response
    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          summary: analysis.summary,
          sentiment: analysis.sentiment,
          sentiment_score: parseFloat(analysis.sentiment_score),
          main_topic: analysis.main_topic,
          threat_level: analysis.threat_level,
          confidence: parseInt(analysis.confidence),
          key_points: analysis.key_points || [],
          recommended_action: analysis.recommended_action,
          keywords: analysis.keywords || [],
          analyzed_at: new Date().toISOString(),
          analysis_model: "DeepSeek",
          processing_time: processingTime,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("💥 Error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        code: "ANALYSIS_ERROR",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
