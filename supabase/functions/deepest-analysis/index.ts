import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const validEscalationLevels = ["Low", "Medium", "High", "Critical"] as const;
type EscalationLevel = (typeof validEscalationLevels)[number];

type DeepestAnalysisResult = {
  escalation_level?: EscalationLevel | string | null;
  strategic_summary?: string | null;
  key_risks?: string[] | null;
  audience_segments?: string[] | null;
  recommended_actions?: string[] | null;
  monitoring_indicators?: string[] | null;
  [key: string]: unknown;
};

type PostRecord = {
  id: string;
  title: string | null;
  source: string | null;
  language: string | null;
  contents: string | null;
  summary: string | null;
  is_psyop: boolean | null;
  psyop_risk_score: number | null;
  threat_level: string | null;
  stance_type: string | null;
  psyop_category: string | null;
  psyop_techniques: string[] | null;
  psyop_review_status: string | null;
  analysis_summary: string | null;
  narrative_theme: string | null;
  urgency_level: string | null;
  virality_potential: string | null;
};

type RelatedPost = {
  title: string | null;
  summary: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postId } = await req.json();

    if (!postId) {
      return new Response(JSON.stringify({ error: "postId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!deepseekApiKey) {
      throw new Error("DeepSeek API key not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select(
        "id, title, source, language, contents, summary, is_psyop, psyop_risk_score, threat_level, stance_type, psyop_category, psyop_techniques, psyop_review_status, analysis_summary, narrative_theme, urgency_level, virality_potential",
      )
      .eq("id", postId)
      .single();

    if (postError || !post) {
      console.error("Post fetch error", postError);
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let relatedPosts: RelatedPost[] | null = null;
    if (post.source) {
      const { data: relatedData, error: relatedError } = await supabase
        .from("posts")
        .select("title, summary")
        .eq("source", post.source)
        .eq("is_psyop", true)
        .neq("id", post.id)
        .order("published_at", { ascending: false })
        .limit(5);

      if (relatedError) {
        console.warn("Related posts fetch warning", relatedError);
      } else if (relatedData && relatedData.length > 0) {
        relatedPosts = relatedData as RelatedPost[];
      }
    }

    const prompt = buildDeepestPrompt(post as PostRecord, relatedPosts ?? []);

    const llmResult = await callDeepseekWithRetry(prompt, deepseekApiKey);
    const parsedResult = parseDeepestResult(llmResult);

    const normalizedEscalation = normalizeEscalationLevel(
      parsedResult.escalation_level,
    );

    const { error: updateError } = await supabase
      .from("posts")
      .update({
        deepest_escalation_level: normalizedEscalation,
        deepest_strategic_summary: parsedResult.strategic_summary ?? null,
        deepest_key_risks: Array.isArray(parsedResult.key_risks)
          ? parsedResult.key_risks
          : null,
        deepest_audience_segments: Array.isArray(parsedResult.audience_segments)
          ? parsedResult.audience_segments
          : null,
        deepest_recommended_actions: Array.isArray(
          parsedResult.recommended_actions,
        )
          ? parsedResult.recommended_actions
          : null,
        deepest_monitoring_indicators: Array.isArray(
          parsedResult.monitoring_indicators,
        )
          ? parsedResult.monitoring_indicators
          : null,
        deepest_analysis_completed_at: new Date().toISOString(),
        deepest_raw: parsedResult,
      })
      .eq("id", postId);

    if (updateError) {
      console.error("Failed to update post", updateError);
      return new Response(JSON.stringify({ error: "Failed to save analysis" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responsePayload = {
      post_id: postId,
      stage: "deepest_analysis",
      escalation_level: normalizedEscalation,
      strategic_summary: parsedResult.strategic_summary ?? null,
      key_risks: Array.isArray(parsedResult.key_risks)
        ? parsedResult.key_risks
        : null,
      audience_segments: Array.isArray(parsedResult.audience_segments)
        ? parsedResult.audience_segments
        : null,
      recommended_actions: Array.isArray(parsedResult.recommended_actions)
        ? parsedResult.recommended_actions
        : null,
      monitoring_indicators: Array.isArray(parsedResult.monitoring_indicators)
        ? parsedResult.monitoring_indicators
        : null,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildDeepestPrompt(post: PostRecord, relatedPosts: RelatedPost[]) {
  const postSnippet = (post.summary || post.contents || "").slice(0, 2000);
  const relatedSection = relatedPosts
    .slice(0, 5)
    .map((p, idx) =>
      `Related Post ${idx + 1}: ${p.title || "(untitled)"}\nSummary: ${p.summary || ""}`
    )
    .join("\n\n");

  const relatedBlock = relatedSection
    ? `\n\nRecent related psyop posts:\n${relatedSection}`
    : "";

  return `You are a senior strategic information warfare analyst tasked with a highest-level crisis assessment. Analyze the following content and its previous screening results to produce a strategic report.\n\n` +
    `Primary post details:\n` +
    `- Title: ${post.title || "(none)"}\n` +
    `- Source: ${post.source || "(unknown)"}\n` +
    `- Language: ${post.language || "(unknown)"}\n` +
    `- Raw/summary text: ${postSnippet}\n\n` +
    `Quick screening metadata:\n` +
    `- is_psyop: ${post.is_psyop}\n` +
    `- psyop_risk_score: ${post.psyop_risk_score}\n` +
    `- threat_level: ${post.threat_level}\n` +
    `- stance_type: ${post.stance_type}\n` +
    `- psyop_category: ${post.psyop_category}\n` +
    `- psyop_techniques: ${post.psyop_techniques?.join(", ") || ""}\n` +
    `- psyop_review_status: ${post.psyop_review_status}\n\n` +
    `Deep analysis metadata:\n` +
    `- analysis_summary: ${post.analysis_summary}\n` +
    `- narrative_theme: ${post.narrative_theme}\n` +
    `- urgency_level: ${post.urgency_level}\n` +
    `- virality_potential: ${post.virality_potential}\n` +
    relatedBlock +
    `\n\nInstructions: Provide a strategic-level crisis analysis for decision-makers. Consider quick screening results, deep analysis themes, and the raw content to justify the risk. Respond with a single JSON object using exactly this structure:\n` +
    `{"escalation_level":"High","strategic_summary":"Short paragraph explaining why this content matters strategically.","key_risks":["Risk that the narrative will spread to mainstream media.","Risk of demoralizing local supporters of the resistance."],"audience_segments":["local_population","regional_public","international_media"],"recommended_actions":["Prepare a clear factual rebuttal addressing the main claims.","Coordinate with allied media outlets to amplify counter-narratives."],"monitoring_indicators":["Spike in mentions of this narrative on major platforms.","Adoption of this framing by mainstream news channels."]}\n` +
    `Rules: escalation_level must be one of Low, Medium, High, Critical. strategic_summary should be 3-6 sentences. Arrays should contain concise, concrete items. Return ONLY valid JSON in exactly this structure and no extra text.`;
}

async function callDeepseekWithRetry(prompt: string, apiKey: string) {
  const maxRetries = 3;
  let responseContent = "";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const deepseekResponse = await fetch(
        "https://api.deepseek.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.15,
            max_tokens: 600,
          }),
        },
      );

      if (!deepseekResponse.ok) {
        if (
          (deepseekResponse.status === 429 || deepseekResponse.status === 503) &&
          attempt < maxRetries - 1
        ) {
          const backoffDelay = Math.pow(2, attempt) * 2000;
          console.log(
            `⏳ Rate limited, retrying after ${backoffDelay}ms (attempt ${attempt + 1}/${maxRetries})...`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue;
        }

        const errorText = await deepseekResponse.text();
        console.error("DeepSeek API error:", deepseekResponse.status, errorText);
        throw new Error(`DeepSeek API error: ${deepseekResponse.status}`);
      }

      const deepseekData = await deepseekResponse.json();
      responseContent = deepseekData.choices?.[0]?.message?.content || "";
      console.log("Raw DeepSeek response:", responseContent);
      return responseContent;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      const backoffDelay = Math.pow(2, attempt) * 2000;
      console.log(
        `⏳ Retrying after error (attempt ${attempt + 1}/${maxRetries})...`,
      );
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }

  return responseContent;
}

function parseDeepestResult(rawContent: string): DeepestAnalysisResult {
  let result: DeepestAnalysisResult = {};

  try {
    const cleanedContent = rawContent
      .replace(/```json\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();

    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("No JSON object found in response");
    }

    const jsonString = jsonMatch[0];

    try {
      result = JSON.parse(jsonString);
    } catch (parseError) {
      console.warn("JSON parse error, attempting fix", parseError);
      const fixedJson = jsonString
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/'/g, "\"")
        .replace(/(\w+)\s*:/g, '"$1":');

      result = JSON.parse(fixedJson);
    }
  } catch (error) {
    console.error("Failed to parse DeepSeek response", error);
    result = {
      escalation_level: "Medium",
      strategic_summary:
        "Insufficient data parsed from model response; using fallback strategic summary.",
      key_risks: null,
      audience_segments: null,
      recommended_actions: null,
      monitoring_indicators: null,
    };
  }

  return result;
}

function normalizeEscalationLevel(level: string | null | undefined): EscalationLevel {
  if (typeof level === "string") {
    const normalized = level.trim();
    const match = validEscalationLevels.find(
      (val) => val.toLowerCase() === normalized.toLowerCase(),
    );
    if (match) return match;
  }

  return "High";
}
