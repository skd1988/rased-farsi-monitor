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

    const { data: postContent, error: contentErr } = await supabase
      .from("posts")
      .select("contents, summary")
      .eq("id", postId)
      .single();

    const snippetRaw = postContent?.summary || postContent?.contents || "";
    const snippet = snippetRaw.slice(0, 500);

    // Build quick screening prompt
    const prompt = buildQuickPrompt(title, source, language, entityList, snippet);
    
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

    const stanceType = result.stance_type ?? null;
    const psyopCategory = result.psyop_category ?? null;
    const psyopTechniques = Array.isArray(result.psyop_techniques)
      ? result.psyop_techniques
      : null;

    // Validate and normalize result
    const normalizedResult = {
      is_psyop: result.is_psyop === true || result.is_psyop === "true" || result.is_psyop === "Yes",
      psyop_confidence: parseInt(result.confidence) || parseInt(result.psyop_confidence) || 50,
      threat_level: result.threat_level || "Low",
      primary_target: result.primary_target || result.target || null,
      stance_type: stanceType,
      psyop_category: psyopCategory,
      psyop_techniques: psyopTechniques,
      needs_deep_analysis: shouldDoDeepAnalysis(result),
      stage: "quick_detection",
      parsing_status: parsingStatus
    };

    console.log('Final normalized result:', normalizedResult);

    const riskScore = calculateRiskScore(result);

    const { error: updateError } = await supabase
      .from("posts")
      .update({
        is_psyop: normalizedResult.is_psyop,
        psyop_confidence: normalizedResult.psyop_confidence,
        threat_level: normalizedResult.threat_level,
        primary_target: normalizedResult.primary_target,
        psyop_risk_score: riskScore,
        stance_type: stanceType,
        psyop_category: psyopCategory,
        psyop_techniques: psyopTechniques,
      })
      .eq("id", postId);

    if (updateError) {
      console.error("Error updating post:", updateError);
    }

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

function buildQuickPrompt(
  title: string,
  source: string,
  language: string,
  entityList: string,
  snippet?: string
) {
  return `You are an expert media analyst whose job is to quickly assess whether a given piece of content is likely part of a **psychological operation (psyop)** against the "Axis of Resistance" or not.

Respond **only in valid JSON** as described below. Do not include any extra text.

=====================
INPUT CONTENT
=====================
- Title: ${title}
- Source / Outlet: ${source}
- Language: ${language}
- Axis of Resistance entities (possible targets): ${entityList}

Content excerpt (may be empty if not available):
${snippet || '[no excerpt available]'}

=====================
KEY DEFINITIONS
=====================

1) Legitimate criticism:
- Critical or negative views about the Axis of Resistance,
- But expressed in a professional, analytical, or fact-based way,
- Without obvious emotional manipulation, dehumanization, or clear falsehoods.

2) Neutral reporting:
- News-style reporting of facts and events,
- Even if the facts are negative for the Axis of Resistance,
- Without strong emotional language, labels, or clear propaganda techniques.

3) Hostile propaganda:
- Strongly negative, emotional, or demonizing language,
- Heavy use of labels like "terrorist", "barbaric", "evil" etc. without balance,
- Clear one-sided framing designed to create hatred, fear, or disgust.

4) Coordinated psyop (psychological operation):
- Hostile propaganda that appears designed to influence public perception or morale,
- Uses classic psyop techniques such as demonization, fear-mongering, division, confusion,
- Presents a highly simplified "good vs evil" narrative,
- Often ignores key facts or context in order to shape emotions and perceptions.

Important:
- **Not every negative or critical article is a psyop.**
- A text can be negative and still be "legitimate criticism" or "neutral reporting".

=====================
YOUR TASK
=====================

First, internally (in your reasoning), decide:
- Is this mainly: supportive / neutral / critical / hostile toward the Axis of Resistance?
- Is the tone: analytical/professional vs emotional/propagandistic?
- Are there clear psyop-style techniques (demonization, fear, division, confusion, ridicule, etc.)?

Then, based on that internal reasoning (which you do NOT output), answer these:

1) is_psyop (boolean):
- true  → only if the content is **hostile propaganda AND likely part of a psychological operation** against the Axis of Resistance.
- false → if it is neutral reporting or legitimate criticism, even if negative.

2) confidence (integer 0-100):
- How confident you are in your classification as psyop / not psyop.

3) threat_level (string):
- "Low"      → mild or limited-impact content, or unclear significance.
- "Medium"   → clearly hostile propaganda but limited likely impact.
- "High"     → strong hostile propaganda with significant potential impact.
- "Critical" → extremely aggressive psyop with very high potential impact.

4) primary_target (string or null):
- The **English name** of the main target entity from the provided entities list,
- Or null if there is no clear specific target.

=====================
OUTPUT FORMAT (JSON ONLY)
=====================

Return **only** a single JSON object, with this exact structure:

{
  "is_psyop": true,
  "confidence": 85,
  "threat_level": "High",
  "primary_target": "Hezbollah Lebanon",
  "stance_type": "hostile_propaganda",
  "psyop_category": "confirmed_psyop",
  "psyop_techniques": ["demonization", "fear_mongering"]
}

Rules:
- is_psyop: must be a boolean (true or false), NOT a string.
- confidence: must be an integer between 0 and 100.
- threat_level: exactly one of "Low", "Medium", "High", "Critical".
- primary_target: must be one of the English names from the entities list above, or null.
- stance_type:
  - "supportive"
  - "neutral"
  - "legitimate_criticism"
  - "hostile_propaganda"
- psyop_category:
  - "none" → neutral or legitimate criticism, not a psyop
  - "potential_psyop" → clearly hostile propaganda but uncertain if coordinated
  - "confirmed_psyop" → clearly part of a psychological operation
- psyop_techniques:
  - an array of zero or more of:
    - "demonization"
    - "fear_mongering"
    - "division_creation"
    - "confusion"
    - "ridicule"
    - "character_assassination"
    - "agenda_shifting"
    - "disinformation"

Do NOT include any explanation, commentary, or extra text. Return only valid JSON.`;
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

function calculateRiskScore(result: any): number {
  const isPsyop = result?.is_psyop === true;
  const confidence =
    typeof result?.confidence === "number" && !isNaN(result.confidence)
      ? result.confidence
      : 50;

  const level = (result?.threat_level || "Low") as string;

  const baseByLevel: Record<string, number> = {
    Low: 20,
    Medium: 50,
    High: 75,
    Critical: 90,
  };

  const base = baseByLevel[level] ?? 20;

  let score = (base * confidence) / 100;

  if (isPsyop) {
    score += 10;
  }

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  return Math.round(score);
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
