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
    // 1. Verify JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Create authenticated Supabase client
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // 3. Verify user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 4. Check user role
    const { data: roleData } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['admin', 'super_admin', 'analyst'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: corsHeaders }
      );
    }

    console.log(`✅ Authenticated: ${user.id} (${roleData.role})`);

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
    
    // Call DeepSeek API with retry logic
    let deepseekData;
    let responseContent;
    const maxRetries = 3;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
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
            temperature: 0.2,
            max_tokens: 200,
          }),
        });
        
        if (!deepseekResponse.ok) {
          // If rate limited, retry with exponential backoff
          if ((deepseekResponse.status === 429 || deepseekResponse.status === 503) && attempt < maxRetries - 1) {
            const backoffDelay = Math.pow(2, attempt) * 2000;
            console.log(`⏳ Rate limited, retrying after ${backoffDelay}ms (attempt ${attempt + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            continue;
          }
          
          const errorText = await deepseekResponse.text();
          console.error("DeepSeek API error:", deepseekResponse.status, errorText);
          throw new Error(`DeepSeek API error: ${deepseekResponse.status}`);
        }
        
        deepseekData = await deepseekResponse.json();
        responseContent = deepseekData.choices[0].message.content;
        break; // Success, exit retry loop
        
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;
        
        const backoffDelay = Math.pow(2, attempt) * 2000;
        console.log(`⏳ Retrying after error (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
    
    console.log("Raw DeepSeek response:", responseContent);
    
    // ROBUST JSON PARSING WITH FALLBACKS
    let result;
    let parsingStatus = 'success';
    
    try {
      // Method 1: Strip markdown code blocks
      let cleanedContent = responseContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      console.log('After removing markdown:', cleanedContent);
      
      // Method 2: Find JSON object
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        console.error('No JSON object found in response');
        throw new Error('No JSON found in response');
      }
      
      const jsonString = jsonMatch[0];
      console.log('Extracted JSON string:', jsonString);
      
      // Method 3: Parse with error handling
      try {
        result = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Attempted to parse:', jsonString);
        
        // Fallback: Try to fix common issues
        const fixedJson = jsonString
          .replace(/,\s*}/g, '}')  // Remove trailing commas
          .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
          .replace(/'/g, '"')      // Replace single quotes with double
          .replace(/(\w+):/g, '"$1":'); // Quote unquoted keys
        
        console.log('Attempting to parse fixed JSON:', fixedJson);
        result = JSON.parse(fixedJson);
        parsingStatus = 'fixed';
      }
      
      console.log('Successfully parsed result:', result);
      
    } catch (error) {
      console.error('Complete parsing failure:', error);
      
      // ULTIMATE FALLBACK: Return safe defaults
      console.warn('Using fallback default result');
      result = {
        is_psyop: false,
        confidence: 50,
        threat_level: "Low",
        primary_target: null
      };
      parsingStatus = 'fallback';
    }
    
    // Validate required fields
    if (typeof result.is_psyop === 'undefined') {
      console.warn('Missing is_psyop field, defaulting to false');
      result.is_psyop = false;
    }
    
    if (typeof result.confidence === 'undefined') {
      console.warn('Missing confidence field, defaulting to 50');
      result.confidence = 50;
    }
    
    if (!result.threat_level) {
      console.warn('Missing threat_level field, defaulting to Low');
      result.threat_level = 'Low';
    }
    
    // Normalize threat level to standard values
    const validThreatLevels = ['Low', 'Medium', 'High', 'Critical'];
    if (!validThreatLevels.includes(result.threat_level)) {
      console.warn(`Invalid threat_level: ${result.threat_level}, defaulting to Low`);
      result.threat_level = 'Low';
    }
    
    // Validate and normalize result
    const normalizedResult = {
      is_psyop: result.is_psyop === true || result.is_psyop === "true" || result.is_psyop === "Yes",
      psyop_confidence: parseInt(result.confidence) || parseInt(result.psyop_confidence) || 50,
      threat_level: result.threat_level || "Low",
      primary_target: result.primary_target || result.target || null,
      needs_deep_analysis: shouldDoDeepAnalysis(result),
      stage: "quick_detection",
      parsing_status: parsingStatus
    };
    
    console.log('Final normalized result:', normalizedResult);
    
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

⚠️ CRITICAL INSTRUCTIONS FOR JSON OUTPUT:
1. Return ONLY valid JSON - no explanations before or after
2. NO markdown code blocks (no \`\`\`json)
3. NO comments inside JSON
4. NO extra text or explanations
5. Just the pure JSON object

Required format (copy exactly):
{
  "is_psyop": true,
  "confidence": 85,
  "threat_level": "High",
  "primary_target": "Hezbollah Lebanon"
}

Rules for values:
- is_psyop: must be boolean true or false (not string)
- confidence: must be integer number 0-100
- threat_level: must be exactly one of: "Low", "Medium", "High", "Critical"
- primary_target: must be English name from entity list above, or null

قوانین:
- اگر اتهام، تهمت، اتهام تروریسم، یا دروغ علیه محور مقاومت دیدی → is_psyop: true
- اگر خبر عادی یا خنثی بود → is_psyop: false
- threat_level را بر اساس شدت حمله تعیین کن

⚠️ فقط JSON برگردان - هیچ کلمه دیگه‌ای نه، حتی برای توضیح

حالا تحلیل کن و فقط JSON بده:`;
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
