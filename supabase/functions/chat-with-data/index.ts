// Force redeploy - v2
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatRequest {
  question: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log("Chat request received");

    const { question, conversationHistory = [] }: ChatRequest = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");

    if (!deepseekApiKey) {
      throw new Error("DEEPSEEK_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Processing question: "${question}"`);

    // Fetch relevant data from Supabase
    const relevantData = await fetchRelevantData(supabase, question);

    // Call DeepSeek API
    const aiResponse = await callDeepSeekAPI(deepseekApiKey, question, relevantData, conversationHistory);

    // Log API usage
    await logAPIUsage(supabase, question, aiResponse.usage);

    const processingTime = Date.now() - startTime;
    console.log(`Response generated in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        answer: aiResponse.answer,
        keyFindings: aiResponse.keyFindings,
        statistics: aiResponse.statistics,
        sources: aiResponse.sources,
        recommendations: aiResponse.recommendations,
        metadata: {
          processingTime,
          tokensUsed: aiResponse.usage.total_tokens,
          model: "deepseek-chat",
          dataUsed: { postsCount: relevantData.posts.length },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        answer:
          "متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.\n\nجزئیات: " +
          (error instanceof Error ? error.message : "خطای نامشخص"),
        isError: true,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function fetchRelevantData(supabase: any, question: string) {
  const query = question.toLowerCase();

  // Determine time range based on question
  let timeFilter: string;
  const now = new Date();

  if (query.includes("امروز") || query.includes("today")) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    timeFilter = today.toISOString();
  } else if (query.includes("دیروز") || query.includes("yesterday")) {
    const yesterday = new Date(now.getTime() - 86400000);
    yesterday.setHours(0, 0, 0, 0);
    timeFilter = yesterday.toISOString();
  } else if (query.includes("هفته") || query.includes("week") || query.includes("۷")) {
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    timeFilter = weekAgo.toISOString();
  } else {
    // Default: last 30 days
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    timeFilter = monthAgo.toISOString();
  }

  // Fetch posts from database
  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("*")
    .gte("published_at", timeFilter)
    .order("published_at", { ascending: false })
    .limit(100);

  if (postsError) {
    console.error("Error fetching posts:", postsError);
  }

  console.log(`Fetched ${posts?.length || 0} posts for analysis`);

  return { posts: posts || [], timeRange: timeFilter };
}

async function callDeepSeekAPI(apiKey: string, question: string, data: any, history: any[]) {
  const dataContext = buildDataContext(data);

  const messages = [
    {
      role: "system",
      content: `You are an intelligent AI assistant and media analyst who helps users with ANY topic they ask about.

🚨 CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THESE:

1. ✅ Answer EVERY question the user asks - NO EXCEPTIONS
2. ✅ There are NO topic restrictions - you can discuss anything
3. ✅ NEVER say "I can only answer these questions: X, Y, Z"
4. ✅ NEVER list specific topics and ask user to choose from them
5. ✅ Be conversational, friendly, and helpful
6. ✅ Always respond in Persian (فارسی)

Your capabilities:
- General conversation: greetings, how are you, small talk
- Knowledge questions: science, history, technology, culture, etc.
- Media analysis: use the data below when relevant
- Creative tasks: writing, brainstorming, explanations
- Technical help: programming, math, problem-solving

Media data available (use ONLY if question is about media analysis):
${dataContext}

EXAMPLES - Learn from these:

❌ WRONG (NEVER do this):
User: "سلام"
You: "متوجه سوال شما شدم. در حال حاضر من می‌توانم به سوالات زیر پاسخ دهم: • مطالب امروز..."

✅ CORRECT:
User: "سلام"
You: {"answer": "سلام! خوش اومدید. چطور می‌تونم کمکتون کنم؟ 😊", "keyFindings": [], "statistics": {}, "sources": {"posts": []}, "recommendations": []}

✅ CORRECT:
User: "حالت چطوره؟"
You: {"answer": "ممنون که پرسیدید! من آماده‌ام تا در هر موضوعی بهتون کمک کنم. چه سوالی دارید؟", "keyFindings": [], "statistics": {}, "sources": {"posts": []}, "recommendations": []}

✅ CORRECT:
User: "درباره هوش مصنوعی چیزی بگو"
You: {"answer": "هوش مصنوعی (AI) یکی از هیجان‌انگیزترین حوزه‌های فناوری مدرن است...", "keyFindings": [], "statistics": {}, "sources": {"posts": []}, "recommendations": []}

✅ CORRECT:
User: "چند مطلب امروز داریم؟"
You: {"answer": "بر اساس داده‌های موجود، امروز X مطلب جمع‌آوری شده است...", "keyFindings": ["..."], "statistics": {...}, "sources": {"posts": [...]}, "recommendations": ["..."]}

Response Format (ALWAYS valid JSON):
{
  "answer": "Your complete answer in Persian with markdown formatting if needed",
  "keyFindings": [] or ["finding 1", "finding 2"],
  "statistics": {} or {"total_posts": 10, ...},
  "sources": {"posts": []} or {"posts": ["id1", "id2"]},
  "recommendations": [] or ["recommendation 1", "recommendation 2"]
}

Important notes:
- If question is general (not about media data), leave keyFindings, statistics, sources, recommendations empty
- But ALWAYS provide a complete, helpful answer
- Use markdown in answer for formatting: **bold**, *italic*, - lists
- Be natural and conversational
- NEVER refuse to answer or limit yourself to specific topics

Remember: You are a general-purpose AI assistant. Answer EVERYTHING!`,
    },
    ...history.slice(-10).map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    })),
    {
      role: "user",
      content: question,
    },
  ];

  console.log("Calling DeepSeek API...");
  console.log("Question:", question);

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 1.0,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("DeepSeek API error:", response.status, errorText);
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const result = await response.json();
  console.log("DeepSeek API responded successfully");
  console.log("Raw response:", result.choices[0].message.content.substring(0, 200));

  let aiAnswer;
  try {
    aiAnswer = JSON.parse(result.choices[0].message.content);
  } catch (parseError) {
    console.error("Error parsing AI response:", parseError);
    console.error("Raw content:", result.choices[0].message.content);

    // Fallback: use raw content as answer
    aiAnswer = {
      answer: result.choices[0].message.content,
      keyFindings: [],
      statistics: {},
      sources: { posts: [] },
      recommendations: [],
    };
  }

  console.log("Parsed answer:", aiAnswer.answer.substring(0, 100));

  return {
    answer: aiAnswer.answer || "پاسخی دریافت نشد",
    keyFindings: aiAnswer.keyFindings || [],
    statistics: aiAnswer.statistics || {},
    sources: aiAnswer.sources || { posts: [] },
    recommendations: aiAnswer.recommendations || [],
    usage: result.usage,
  };
}

function buildDataContext(data: any) {
  const { posts } = data;

  if (!posts || posts.length === 0) {
    return `📊 Data Status: No media data available in the selected time range.

Important: If the user's question is NOT about media data (e.g., "hello", "how are you", general knowledge questions), you should answer freely using your knowledge. Only mention the lack of data if they specifically ask about media statistics or posts.`;
  }

  // Group by language
  const byLanguage: Record<string, number> = {};
  posts.forEach((p: any) => {
    const lang = p.language || "Unknown";
    byLanguage[lang] = (byLanguage[lang] || 0) + 1;
  });

  // Group by source
  const bySource: Record<string, number> = {};
  posts.forEach((p: any) => {
    const src = p.source || "Unknown";
    bySource[src] = (bySource[src] || 0) + 1;
  });

  // Group by sentiment (if available)
  const bySentiment: Record<string, number> = {};
  posts.forEach((p: any) => {
    if (p.sentiment) {
      bySentiment[p.sentiment] = (bySentiment[p.sentiment] || 0) + 1;
    }
  });

  // Group by threat level (if available)
  const byThreat: Record<string, number> = {};
  posts.forEach((p: any) => {
    if (p.threat_level) {
      byThreat[p.threat_level] = (byThreat[p.threat_level] || 0) + 1;
    }
  });

  // Collect all keywords
  const allKeywords: string[] = [];
  posts.forEach((p: any) => {
    if (p.keywords && Array.isArray(p.keywords)) {
      allKeywords.push(...p.keywords);
    }
  });

  // Count keyword frequencies
  const keywordCounts: Record<string, number> = {};
  allKeywords.forEach((kw) => {
    keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
  });

  // Get top keywords
  const topKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([kw, count]) => ({ keyword: kw, count }));

  const summary = {
    total: posts.length,
    byLanguage,
    bySource,
    bySentiment,
    byThreat,
    topKeywords,
    dateRange: {
      from: posts[posts.length - 1]?.published_at,
      to: posts[0]?.published_at,
    },
    samplePosts: posts.slice(0, 10).map((p: any) => ({
      id: p.id,
      title: p.title,
      source: p.source,
      date: p.published_at,
      language: p.language,
      sentiment: p.sentiment,
      threat: p.threat_level,
    })),
  };

  return `📊 Media Data Summary:

Total posts: ${summary.total}
Time range: ${summary.dateRange.from} to ${summary.dateRange.to}

By Language: ${JSON.stringify(summary.byLanguage, null, 2)}
By Source: ${JSON.stringify(summary.bySource, null, 2)}
${Object.keys(summary.bySentiment).length > 0 ? "By Sentiment: " + JSON.stringify(summary.bySentiment, null, 2) : ""}
${Object.keys(summary.byThreat).length > 0 ? "By Threat Level: " + JSON.stringify(summary.byThreat, null, 2) : ""}
${summary.topKeywords.length > 0 ? "Top Keywords: " + JSON.stringify(summary.topKeywords, null, 2) : ""}

Sample Posts (first 10):
${JSON.stringify(summary.samplePosts, null, 2)}`;
}

async function logAPIUsage(supabase: any, question: string, usage: any) {
  try {
    const inputCost = (usage.prompt_tokens * 0.27) / 1000000;
    const outputCost = (usage.completion_tokens * 1.1) / 1000000;
    const totalCost = inputCost + outputCost;

    await supabase.from("api_usage_logs").insert({
      endpoint: "chat",
      question: question.substring(0, 200),
      tokens_used: usage.total_tokens,
      input_tokens: usage.prompt_tokens,
      output_tokens: usage.completion_tokens,
      model_used: "deepseek-chat",
      status: "success",
      cost_usd: totalCost,
    });

    console.log(`API usage logged: ${usage.total_tokens} tokens, $${totalCost.toFixed(6)}`);
  } catch (error) {
    console.error("Error logging API usage:", error);
    // Don't throw - logging failure shouldn't break the chat
  }
}
