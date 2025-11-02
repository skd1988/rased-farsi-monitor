import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { postId, title, source, language } = await req.json();
    
    console.log(`Quick screening post: ${postId}`);
    
    // Get DeepSeek API key
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!deepseekApiKey) {
      throw new Error("DeepSeek API key not configured");
    }
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    // Load entity list for reference
    const { data: entities } = await supabase
      .from('resistance_entities')
      .select('name_english, name_persian, name_arabic')
      .eq('active', true);
    
    const entityList = entities?.map(e => 
      `${e.name_persian} (${e.name_arabic} / ${e.name_english})`
    ).join(', ') || '';
    
    // Build quick screening prompt
    const prompt = buildQuickPrompt(title, source, language, entityList);
    
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
        temperature: 0.2, // Low for consistent screening
        max_tokens: 200,  // Very small for speed
      }),
    });
    
    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error("DeepSeek API error:", deepseekResponse.status, errorText);
      throw new Error(`DeepSeek API error: ${deepseekResponse.status}`);
    }
    
    const deepseekData = await deepseekResponse.json();
    const responseContent = deepseekData.choices[0].message.content;
    
    console.log("DeepSeek response:", responseContent);
    
    // Parse JSON response
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    let result;
    
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Failed to parse JSON from response");
    }
    
    // Validate and normalize result
    const normalizedResult = {
      is_psyop: result.is_psyop === true || result.is_psyop === "true" || result.is_psyop === "Yes",
      psyop_confidence: parseInt(result.confidence) || 0,
      threat_level: result.threat_level || "Low",
      primary_target: result.primary_target || null,
      needs_deep_analysis: shouldDoDeepAnalysis(result),
      stage: "quick_detection"
    };
    
    const responseTime = Date.now() - startTime;
    
    // Log API usage
    await logAPIUsage(supabase, {
      endpoint: 'quick-psyop-detection',
      tokens_used: deepseekData.usage.total_tokens,
      input_tokens: deepseekData.usage.prompt_tokens,
      output_tokens: deepseekData.usage.completion_tokens,
      model: 'deepseek-chat',
      post_id: postId,
      response_time: responseTime
    });
    
    console.log(`Quick detection completed in ${responseTime}ms:`, normalizedResult);
    
    return new Response(
      JSON.stringify(normalizedResult),
      {
        status: 200,
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
    
  } catch (error) {
    console.error("Quick detection error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        stage: "quick_detection"
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        },
      }
    );
  }
});

function buildQuickPrompt(title: string, source: string, language: string, entityList: string): string {
  return `تو یک فیلتر سریع و دقیق برای شناسایی عملیات روانی علیه محور مقاومت هستی.

وظیفه: فقط تشخیص بده که این مطلب جنگ روانی هست یا خیر. جزئیات نمی‌خوام.

مطلب:
عنوان: ${title}
منبع: ${source}
زبان: ${language}

نهادهای محور مقاومت:
${entityList}

سوالات:
1. آیا این مطلب علیه محور مقاومت است؟
2. اگر بله، چقدر مطمئنی؟ (0-100)
3. سطح تهدید چقدره؟
4. کدوم نهاد هدف اصلی است؟

فقط این JSON را برگردان (هیچ توضیح اضافه‌ای نمی‌خوام):

{
  "is_psyop": true/false,
  "confidence": 85,
  "threat_level": "Low" یا "Medium" یا "High" یا "Critical",
  "primary_target": "نام انگلیسی نهاد" یا null
}

قوانین:
- اگر اتهام، تهمت، اتهام تروریسم، یا دروغ علیه محور مقاومت دیدی → is_psyop: true
- اگر خبر عادی یا خنثی بود → is_psyop: false
- threat_level را بر اساس شدت حمله تعیین کن
- فقط JSON برگردان، هیچ متن اضافه‌ای نه

حالا تحلیل کن:`;
}

function shouldDoDeepAnalysis(result: any): boolean {
  // Criteria for deep analysis
  return (
    result.is_psyop === true ||
    result.threat_level === "Critical" ||
    result.threat_level === "High" ||
    (result.confidence >= 70 && result.threat_level === "Medium")
  );
}

async function logAPIUsage(supabase: any, data: any) {
  const cost = calculateCost(data.input_tokens, data.output_tokens);
  
  try {
    await supabase.from('api_usage_logs').insert({
      model_used: data.model,
      input_tokens: data.input_tokens,
      output_tokens: data.output_tokens,
      total_tokens: data.tokens_used,
      cost_usd: cost,
      response_time_ms: data.response_time,
      post_id: data.post_id,
      status: 'success'
    });
  } catch (error) {
    console.error("Failed to log API usage:", error);
  }
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  // DeepSeek pricing: $0.27/M input, $1.10/M output
  const inputCost = (inputTokens / 1_000_000) * 0.27;
  const outputCost = (outputTokens / 1_000_000) * 1.10;
  return inputCost + outputCost;
}
