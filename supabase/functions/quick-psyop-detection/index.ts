import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function deriveCurrentStage(post: any): "quick" | "deep" | "deepest" | null {
  if (post?.deepest_analysis_completed_at || post?.deepest_analyzed_at) return "deepest";
  if (post?.deep_analyzed_at) return "deep";
  if (post?.quick_analyzed_at) return "quick";
  return post?.analysis_stage ?? null;
}

// NOTE: This function expects a post ID.
// We accept { postId }, { id } or { post_id } in the request body
// and normalize them to "effectivePostId", then load from "posts" by id.
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const { postId, id, post_id } = body;
    const effectivePostId = postId ?? id ?? post_id;

    if (!effectivePostId) {
      return new Response(
        JSON.stringify({ error: "postId is required" }),
        { status: 400, headers: corsHeaders },
      );
    }

    console.log(`Quick screening post: ${effectivePostId}`);
    
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
    
    const thresholds = await loadPsyopThresholds(supabase);
    console.log("Quick detection thresholds:", thresholds);

    // NOTE:
    // We ALWAYS load the post from "posts" table by its primary key only.
    // Do not add extra filters (status, timestamps, etc.) here,
    // otherwise auto-analyzer will see false "Post not found" errors.
    const { data: post, error: fetchError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", effectivePostId)
      .maybeSingle();

    if (fetchError) {
      console.error("❌ quick-psyop-detection: DB fetch error", {
        postId: String(effectivePostId),
        error: fetchError,
      });
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: corsHeaders },
      );
    }

    if (!post) {
      console.warn("⚠️ quick-psyop-detection: Post not found in DB", {
        postId: String(effectivePostId),
      });
      return new Response(
        JSON.stringify({ error: "Post not found", postId: String(effectivePostId) }),
        { status: 404, headers: corsHeaders },
      );
    }

    // Load entity list for reference
    const { data: entities } = await supabase
      .from('resistance_entities')
      .select('name_english, name_persian, name_arabic')
      .eq('active', true);

    const entityList = entities?.map(e =>
      `${e.name_persian} (${e.name_arabic} / ${e.name_english})`
    ).join(', ') || '';

    const rawSummary = (post?.summary || "").trim();
    const rawContents = (post?.contents || "").trim();

    // Build a richer composite snippet to give the LLM more representative context
    const MAX_CHARS = 4000;
    let combined = "";

    if (rawSummary.length > 0) {
      combined += `Summary:\n${rawSummary}\n\n`;
    }

    if (rawContents.length <= MAX_CHARS) {
      combined += `Full content:\n${rawContents}`;
    } else {
      const len = rawContents.length;
      const segmentSize = Math.floor((MAX_CHARS - combined.length) / 3);

      const start = rawContents.slice(0, segmentSize);
      const middleStart = Math.max(Math.floor(len / 2) - Math.floor(segmentSize / 2), 0);
      const middle = rawContents.slice(middleStart, middleStart + segmentSize);
      const end = rawContents.slice(-segmentSize);

      combined += `Content (start):\n${start}\n\n`;
      combined += `Content (middle):\n${middle}\n\n`;
      combined += `Content (end):\n${end}`;
    }

    const snippet = combined.slice(0, MAX_CHARS);

    // Build quick screening prompt
    const prompt = buildQuickPrompt(
      post.title,
      post.source,
      post.language,
      entityList,
      snippet,
    );
    
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
    const riskScore = calculateRiskScore(result);
    const needsDeep = shouldDoDeepAnalysis(result, thresholds, riskScore);
    const needsDeepest = shouldDoDeepestAnalysis(result, thresholds, riskScore);

    const normalizedResult = {
      is_psyop: result.is_psyop === true || result.is_psyop === "true" || result.is_psyop === "Yes",
      psyop_confidence: parseInt(result.confidence) || parseInt(result.psyop_confidence) || 50,
      threat_level: result.threat_level || "Low",
      primary_target: result.primary_target || result.target || null,
      stance_type: stanceType,
      psyop_category: psyopCategory,
      psyop_techniques: psyopTechniques,
      psyop_risk_score: riskScore,
      needs_deep_analysis: needsDeep,
      needs_deepest_analysis: needsDeepest,
      stage: "quick_detection",
      parsing_status: parsingStatus
    };

    console.log('Final normalized result:', normalizedResult);

    const completionTimestamp = new Date().toISOString();
    const currentStage = deriveCurrentStage(post);

    const updateData: Record<string, any> = {
      is_psyop: normalizedResult.is_psyop,
      psyop_confidence: normalizedResult.psyop_confidence,
      threat_level: normalizedResult.threat_level,
      primary_target: normalizedResult.primary_target,
      psyop_risk_score: riskScore,
      stance_type: stanceType,
      psyop_category: psyopCategory,
      psyop_techniques: psyopTechniques,
      quick_analyzed_at: post.quick_analyzed_at ?? completionTimestamp,
    };

    if (!post.deep_analyzed_at && !post.deepest_analysis_completed_at && !post.deepest_analyzed_at) {
      updateData.analysis_stage = currentStage === "deep" || currentStage === "deepest" ? currentStage : "quick";
    }

    const { error: updateError } = await supabase
      .from("posts")
      .update(updateData)
      .eq("id", effectivePostId);

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
      post_id: effectivePostId,
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

Content excerpts (summary + key segments of the post):
${snippet || '[no content available]'}

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

function shouldDoDeepAnalysis(
  result: any,
  thresholds: PsyopThresholds,
  riskScore: number
): boolean {
  const level = (result.threat_level || "Low") as string;
  const confidence =
    typeof result.confidence === "number" ? result.confidence : 50;

  const highRisk = riskScore >= thresholds.deepThreshold;
  const highThreat = level === "High" || level === "Critical";

  return (
    result.is_psyop === true ||
    (highRisk && highThreat) ||
    (highRisk && confidence >= 60) ||
    (confidence >= 70 && level === "Medium")
  );
}

function shouldDoDeepestAnalysis(
  result: any,
  thresholds: PsyopThresholds,
  riskScore: number
): boolean {
  const level = (result.threat_level || "Low") as string;
  const confidence =
    typeof result.confidence === "number" ? result.confidence : 50;

  const category = result.psyop_category || "none";
  const techniques: string[] = Array.isArray(result.psyop_techniques)
    ? result.psyop_techniques
    : [];

  const crisisRisk = riskScore >= thresholds.deepestThreshold;

  const hasSevereTechniques = techniques.some((t) =>
    ["disinformation", "fear_mongering", "division_creation"].includes(t)
  );

  return (
    crisisRisk ||
    (result.is_psyop === true &&
      (level === "Critical" ||
        (level === "High" && confidence >= 80) ||
        category === "confirmed_psyop" ||
        (category === "potential_psyop" && hasSevereTechniques)))
  );
}

function calculateRiskScore(result: any): number {
  const isPsyop = result?.is_psyop === true || result?.is_psyop === "true";

  const categoryRaw = (result?.psyop_category || "none") as string;
  const category = categoryRaw.toLowerCase();

  const stanceRaw = (result?.stance_type || "neutral") as string;
  const stance = stanceRaw.toLowerCase();

  const levelRaw = (result?.threat_level || "Low") as string;
  const level = levelRaw as string;

  // Normalize confidence to 0–100
  let confidence = 50;
  if (typeof result?.confidence === "number") {
    confidence = result.confidence;
  } else if (typeof result?.confidence === "string") {
    const parsed = parseInt(result.confidence, 10);
    if (!isNaN(parsed)) confidence = parsed;
  }
  confidence = Math.min(100, Math.max(0, confidence));

  let score = 0;

  // 1) is_psyop
  if (isPsyop) score += 20;

  // 2) psyop_category
  if (category === "confirmed_psyop") score += 35;
  else if (category === "potential_psyop") score += 20;

  // 3) stance_type
  if (stance === "hostile_propaganda") score += 15;
  else if (stance === "legitimate_criticism") score += 5;

  // 4) threat_level
  const threatWeights: Record<string, number> = {
    Low: 10,
    Medium: 25,
    High: 40,
    Critical: 55,
  };
  score += threatWeights[level] ?? 10;

  // 5) confidence (0–33)
  score += Math.round(confidence / 3);

  // 6) techniques bonus (max +20)
  const techniques = Array.isArray(result?.psyop_techniques)
    ? (result.psyop_techniques as string[])
    : [];

  const severe = new Set([
    "demonization",
    "fear_mongering",
    "disinformation",
    "character_assassination",
  ]);

  let techBonus = 0;
  for (const t of techniques) {
    techBonus += severe.has(t) ? 5 : 3;
  }
  score += Math.min(techBonus, 20);

  return Math.min(100, Math.max(0, Math.round(score)));
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

type PsyopThresholds = {
  riskThreshold: number;
  deepThreshold: number;
  deepestThreshold: number;
};

async function loadPsyopThresholds(supabase: any): Promise<PsyopThresholds> {
  let thresholds: PsyopThresholds = {
    riskThreshold: 60,
    deepThreshold: 65,
    deepestThreshold: 80,
  };

  try {
    const { data, error } = await supabase
      .from("psyop_calibration_metrics")
      .select(
        "recommended_risk_threshold, recommended_deep_threshold, recommended_deepest_threshold"
      )
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.warn("Failed to load psyop thresholds, using defaults:", error);
      return thresholds;
    }

    const row = data?.[0];
    if (!row) return thresholds;

    const risk = row.recommended_risk_threshold ?? thresholds.riskThreshold;
    const deep = row.recommended_deep_threshold ?? thresholds.deepThreshold;
    const deepest = row.recommended_deepest_threshold ?? thresholds.deepestThreshold;

    thresholds = {
      riskThreshold: Number.isFinite(risk) ? risk : thresholds.riskThreshold,
      deepThreshold: Number.isFinite(deep) ? deep : thresholds.deepThreshold,
      deepestThreshold: Number.isFinite(deepest) ? deepest : thresholds.deepestThreshold,
    };

    return thresholds;
  } catch (err) {
    console.warn("Unexpected error loading thresholds, using defaults:", err);
    return thresholds;
  }
}
