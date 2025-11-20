import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PostRecord = {
  id: string;
  language: string | null;
  title: string | null;
  source: string | null;
  contents: string | null;
  summary: string | null;
};

function buildSummarizePrompt(post: PostRecord) {
  const { title, source, language, contents } = post;
  return `You are an expert media analyst.

Your task is to produce a concise, high-quality summary of the following content.

Requirements:
- Write the summary in the SAME LANGUAGE as the original content (language: ${language}).
- Length: about 3–6 sentences.
- Capture the main topic, key claims, and overall tone.
- If the content references the Axis of Resistance or related entities, briefly mention how they are framed (positive, neutral, negative).
- Do NOT add information that is not in the text.
- Do NOT include any meta commentary about yourself.

Content metadata:
- Title: ${title}
- Source: ${source ?? "Unknown"}

Content:
${contents}

Return ONLY the summary text, no extra formatting.`;
}

async function callDeepseek(prompt: string, apiKey: string) {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
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
          temperature: 0.2,
          max_tokens: 300,
        }),
      });

      if (!response.ok) {
        if ((response.status === 429 || response.status === 503) && attempt < maxRetries - 1) {
          const backoffDelay = Math.pow(2, attempt) * 2000;
          console.log(`⏳ Rate limited, retrying after ${backoffDelay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue;
        }

        const errorText = await response.text();
        console.error("DeepSeek API error:", response.status, errorText);
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content as string;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      const backoffDelay = Math.pow(2, attempt) * 2000;
      console.log(`⏳ Retrying after error (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }

  throw new Error("DeepSeek API call failed after retries");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postId } = await req.json();

    if (!postId) {
      return new Response(
        JSON.stringify({ error: "postId is required", stage: "summarize" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!deepseekApiKey) {
      throw new Error("DeepSeek API key not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Supabase environment variables are not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id, language, title, source, contents, summary")
      .eq("id", postId)
      .single();

    if (postError) {
      console.error("Error fetching post:", postError);
      return new Response(
        JSON.stringify({ error: "Post not found", stage: "summarize" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contentsToSummarize = post.contents || post.summary || "";

    if (!contentsToSummarize.trim()) {
      return new Response(
        JSON.stringify({ error: "Post has no contents to summarize", stage: "summarize" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const prompt = buildSummarizePrompt({ ...post, contents: contentsToSummarize });

    const responseContent = await callDeepseek(prompt, deepseekApiKey);

    let summaryText = responseContent.trim();
    if (summaryText.length > 2000) {
      summaryText = summaryText.slice(0, 2000);
    }

    const { error: updateError } = await supabase
      .from("posts")
      .update({ summary: summaryText })
      .eq("id", postId);

    if (updateError) {
      console.error("Error updating summary:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update summary", stage: "summarize" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ post_id: postId, stage: "summarize", summary: summaryText }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Summarize post error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", stage: "summarize" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
