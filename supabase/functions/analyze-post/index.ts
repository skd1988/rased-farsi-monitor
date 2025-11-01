import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

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
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // Log API usage
    const inputTokens = deepseekData.usage?.prompt_tokens || 0;
    const outputTokens = deepseekData.usage?.completion_tokens || 0;
    const totalTokens = deepseekData.usage?.total_tokens || 0;
    
    // DeepSeek pricing: $0.14 per 1M input tokens, $0.28 per 1M output tokens
    const costUsd = (inputTokens * 0.14 / 1000000) + (outputTokens * 0.28 / 1000000);

    try {
      await supabaseClient.from('api_usage_logs').insert({
        post_id: postId,
        model_used: 'deepseek-chat',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost_usd: costUsd,
        response_time_ms: Math.round(processingTime * 1000),
        status: 'success'
      });
    } catch (logError) {
      console.error('⚠️ Failed to log API usage:', logError);
      // Don't fail the request if logging fails
    }

    console.log("✅ Analysis completed successfully");
    console.log(`📊 Tokens: ${totalTokens} (in: ${inputTokens}, out: ${outputTokens}), Cost: $${costUsd.toFixed(6)}`);

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
          keywords: analysis.keywords || analysis.keywords_found || [],
          analyzed_at: new Date().toISOString(),
          analysis_model: "DeepSeek",
          processing_time: processingTime,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("💥 Error:", error);

    // Try to log the error (best effort)
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const errorData = await req.json().catch(() => ({}));
      if (errorData.postId) {
        await supabaseClient.from('api_usage_logs').insert({
          post_id: errorData.postId,
          model_used: 'deepseek-chat',
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          cost_usd: 0,
          response_time_ms: 0,
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } catch (logError) {
      console.error('⚠️ Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        code: "ANALYSIS_ERROR",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
