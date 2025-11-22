import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postId, quickResult } = await req.json();

    if (!postId) {
      throw new Error("postId is required");
    }

    console.log(`🧠 [DeepestAnalysis] Starting for post ${postId}`);

    if (!DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { data: existingPost, error: fetchError } = await supabase
      .from("posts")
      .select(
        "id, title, contents, source, language, published_at, is_psyop, psyop_confidence, threat_level, primary_target, psyop_risk_score, stance_type, psyop_category, psyop_techniques, deepest_analysis_summary, deepest_analysis_notes, deepest_analyzed_at"
      )
      .eq("id", postId)
      .single();

    if (fetchError) {
      console.warn("Failed to load post context for deepest analysis:", fetchError);
    }

    const title = quickResult?.title ?? existingPost?.title ?? "Untitled";
    const contents = quickResult?.contents ?? existingPost?.contents ?? "";
    const source = quickResult?.source ?? existingPost?.source ?? "نامشخص";
    const language = quickResult?.language ?? existingPost?.language ?? "نامشخص";
    const publishedAt = quickResult?.published_at ?? existingPost?.published_at ?? "";

    const quickContextLines = [] as string[];
    const quickContext = quickResult ?? existingPost;
    if (quickContext) {
      quickContextLines.push(`- is_psyop: ${quickContext.is_psyop}`);
      quickContextLines.push(`- psyop_confidence: ${quickContext.psyop_confidence}`);
      quickContextLines.push(`- threat_level: ${quickContext.threat_level}`);
      quickContextLines.push(`- primary_target: ${quickContext.primary_target ?? "unknown"}`);
      quickContextLines.push(`- psyop_category: ${quickContext.psyop_category ?? "none"}`);
      quickContextLines.push(
        `- psyop_techniques: ${Array.isArray(quickContext.psyop_techniques) ? quickContext.psyop_techniques.join(", ") : quickContext.psyop_techniques || "none"}`
      );
    }

    const deepestPrompt = `You are a senior PsyOp crisis analyst. Provide the most thorough, evidence-based assessment of whether this content is part of a coordinated psychological operation against the Axis of Resistance.

If quick screening data is present, treat it as a hint but do an independent review:
${quickContextLines.length ? quickContextLines.join("\n") : "- no quick screening data provided"}

=====================
CONTENT CONTEXT
=====================
- Title: ${title}
- Source: ${source}
- Language: ${language}
- Published At: ${publishedAt}
- Body (may be truncated): ${contents?.slice(0, 4000) || "[empty]"}

=====================
DEEP CRISIS ANALYSIS (reason in your head, output only JSON)
=====================
1) Confirm or refine whether this is a coordinated PsyOp.
2) Extract key narratives, enemy objectives, and emotional levers.
3) Identify any signs of coordinated messaging or manipulation patterns.
4) Provide concise counter-messaging ideas.

=====================
OUTPUT JSON ONLY (no explanations)
=====================
{
  "is_psyop": true,
  "psyop_confidence": 86,
  "threat_level": "Critical",
  "psyop_risk_score": 90,
  "primary_target": "Hezbollah Lebanon",
  "stance_type": "hostile_propaganda",
  "psyop_category": "confirmed_psyop",
  "psyop_techniques": ["demonization", "fear_mongering"],
  "deepest_analysis_summary": "Short but rich explanation of why this is (or is not) a coordinated PsyOp.",
  "deepest_analysis_notes": "Bullet-style notes on coordination clues, objectives, and suggested counter-messaging."
}

Rules:
- threat_level must be one of "Low", "Medium", "High", "Critical".
- psyop_risk_score is an integer 0-100 reflecting crisis severity (higher = more severe).
- psyop_techniques must be an array; use the known set such as demonization, fear_mongering, division_creation, confusion, ridicule, character_assassination, agenda_shifting, disinformation.
- Provide JSON only with these fields; do not include markdown or extra text.`;

    let response;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        response = await fetch("https://api.deepseek.com/v1/chat/completions", {
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
                content: "You are an expert PsyOp and influence campaign analyst. Answer strictly in JSON.",
              },
              {
                role: "user",
                content: deepestPrompt,
              },
            ],
            temperature: 0.25,
            max_tokens: 2200,
          }),
        });

        if (!response.ok) {
          if ((response.status === 429 || response.status === 503 || response.status === 504) && attempt < maxRetries - 1) {
            const backoffDelay = Math.pow(2, attempt) * 3000;
            console.log(`⏳ Retrying deepest analysis after ${backoffDelay}ms (attempt ${attempt + 1}/${maxRetries})...`);
            await new Promise((resolve) => setTimeout(resolve, backoffDelay));
            continue;
          }

          const errorText = await response.text();
          throw new Error(`Deepest analysis API error: ${response.status} - ${errorText}`);
        }

        break;
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;

        const backoffDelay = Math.pow(2, attempt) * 3000;
        console.log(`⏳ Retrying deepest analysis after error (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }

    if (!response) {
      throw new Error("Failed to get response from DeepSeek API after retries");
    }

    const data = await response.json();
    let rawContent: string = data.choices?.[0]?.message?.content || "";
    rawContent = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsedResult: any;
    try {
      parsedResult = JSON.parse(rawContent);
    } catch (error) {
      console.error("Failed to parse deepest analysis JSON:", error, rawContent);
      throw new Error("Deepest analysis returned invalid JSON");
    }

    const allowedThreatLevels = ["Low", "Medium", "High", "Critical"];

    const normalized = {
      is_psyop: parsedResult.is_psyop === true || parsedResult.is_psyop === "true",
      psyop_confidence:
        typeof parsedResult.psyop_confidence === "number"
          ? parsedResult.psyop_confidence
          : typeof parsedResult.confidence === "number"
          ? parsedResult.confidence
          : 50,
      threat_level: allowedThreatLevels.includes(parsedResult.threat_level)
        ? parsedResult.threat_level
        : existingPost?.threat_level ?? "Low",
      psyop_risk_score:
        typeof parsedResult.psyop_risk_score === "number"
          ? parsedResult.psyop_risk_score
          : typeof parsedResult.risk_score === "number"
          ? parsedResult.risk_score
          : quickResult?.psyop_risk_score ?? existingPost?.psyop_risk_score ?? 70,
      primary_target: parsedResult.primary_target ?? parsedResult.target ?? existingPost?.primary_target ?? null,
      stance_type: parsedResult.stance_type ?? existingPost?.stance_type ?? null,
      psyop_category: parsedResult.psyop_category ?? existingPost?.psyop_category ?? null,
      psyop_techniques: Array.isArray(parsedResult.psyop_techniques)
        ? parsedResult.psyop_techniques
        : existingPost?.psyop_techniques ?? null,
      deepest_analysis_summary: parsedResult.deepest_analysis_summary ?? null,
      deepest_analysis_notes: parsedResult.deepest_analysis_notes ?? null,
    };

    const updateData: Record<string, any> = {
      is_psyop: normalized.is_psyop,
      psyop_confidence: normalized.psyop_confidence,
      threat_level: normalized.threat_level,
      primary_target: normalized.primary_target,
      psyop_risk_score: normalized.psyop_risk_score,
      stance_type: normalized.stance_type,
      psyop_category: normalized.psyop_category,
      psyop_techniques: normalized.psyop_techniques,
      analysis_stage: "deepest",
    };

    if (existingPost && "deepest_analysis_summary" in existingPost) {
      updateData.deepest_analysis_summary = normalized.deepest_analysis_summary;
    }

    if (existingPost && "deepest_analysis_notes" in existingPost) {
      updateData.deepest_analysis_notes = normalized.deepest_analysis_notes;
    }

    if (existingPost && "deepest_analyzed_at" in existingPost) {
      updateData.deepest_analyzed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("posts")
      .update(updateData)
      .eq("id", postId);

    if (updateError) {
      console.error("Failed to update post with deepest analysis:", updateError);
      throw updateError;
    }

    console.log(`✅ [DeepestAnalysis] Completed for post ${postId}`);

    return new Response(
      JSON.stringify({
        success: true,
        post_id: postId,
        stage: "deepest",
        updated_fields: updateData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-post-deepest:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
