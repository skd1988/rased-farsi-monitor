// Fixed version - Using same approach as analyze-post
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
    // 1. Verify JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create authenticated Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // 3. Verify user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Check user role (analysts+ can use AI analysis)
    const { data: roleData } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['admin', 'super_admin', 'analyst'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions - analysts only' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Authenticated user ${user.id} (${roleData.role})`);
    console.log("Chat request received");

    const { question, conversationHistory = [] }: ChatRequest = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role key for database operations
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");

    if (!deepseekApiKey) {
      throw new Error("DEEPSEEK_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Processing question: "${question}"`);

    // Fetch relevant data from Supabase
    const relevantData = await fetchRelevantData(supabase, question);

    // Call DeepSeek API (using same method as analyze-post)
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

  // Build conversation history
  const historyMessages = history.slice(-10).map((msg: any) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Create the prompt (similar to analyze-post approach)
  const prompt = `تو یک دستیار هوشمند و تحلیلگر رسانه‌ای هستی.

مهم: به هر سوالی پاسخ بده. محدودیتی نداری!

سوال کاربر: ${question}

${historyMessages.length > 0 ? `تاریخچه گفتگو:\n${historyMessages.map((m) => `${m.role}: ${m.content}`).join("\n")}\n` : ""}

داده‌های رسانه‌ای (در صورت نیاز استفاده کن):
${dataContext}

لطفاً خروجی رو دقیقاً به این فرمت JSON بده:

{
  "answer": "پاسخ کامل به فارسی",
  "keyFindings": ["یافته 1", "یافته 2"] یا [],
  "statistics": {"total_posts": 10} یا {},
  "sources": {"posts": ["id1", "id2"]} یا {"posts": []},
  "recommendations": ["توصیه 1"] یا []
}

قوانین مهم:
- هیچوقت نگو "من فقط می‌تونم به سوالات زیر پاسخ بدم"
- اگر سوال عمومی بود (سلام، چطوری، ...) بدون استفاده از داده رسانه‌ای جواب بده
- همیشه answer رو پر کن`;

  console.log("Calling DeepSeek API...");
  console.log("Question:", question);

  // Call DeepSeek (same as analyze-post - NO response_format!)
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
      temperature: 0.7,
      max_tokens: 4000,
      // ✅ NO response_format - same as analyze-post!
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("DeepSeek API error:", response.status, errorText);
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const result = await response.json();
  console.log("DeepSeek API responded successfully");

  const responseContent = result.choices[0].message.content;
  console.log("Raw response preview:", responseContent.substring(0, 200));

  let aiAnswer;
  try {
    // Extract JSON from response (same as analyze-post)
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      aiAnswer = JSON.parse(jsonMatch[0]);
      console.log("Parsed answer preview:", aiAnswer.answer?.substring(0, 100));
    } else {
      console.warn("No JSON found in response, using raw content");
      aiAnswer = {
        answer: responseContent,
        keyFindings: [],
        statistics: {},
        sources: { posts: [] },
        recommendations: [],
      };
    }
  } catch (parseError) {
    console.error("Error parsing AI response:", parseError);
    console.error("Raw content:", responseContent);

    // Fallback
    aiAnswer = {
      answer: responseContent,
      keyFindings: [],
      statistics: {},
      sources: { posts: [] },
      recommendations: [],
    };
  }

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
    return `هیچ داده رسانه‌ای در بازه زمانی موجود نیست.

اگر سوال درباره داده رسانه‌ای است، به کاربر بگو داده‌ای موجود نیست.
اگر سوال عمومی است، آزادانه جواب بده.`;
  }

  // Group by language
  const byLanguage: Record<string, number> = {};
  posts.forEach((p: any) => {
    const lang = p.language || "نامشخص";
    byLanguage[lang] = (byLanguage[lang] || 0) + 1;
  });

  // Group by source
  const bySource: Record<string, number> = {};
  posts.forEach((p: any) => {
    const src = p.source || "نامشخص";
    bySource[src] = (bySource[src] || 0) + 1;
  });

  // Group by sentiment
  const bySentiment: Record<string, number> = {};
  posts.forEach((p: any) => {
    if (p.sentiment) {
      bySentiment[p.sentiment] = (bySentiment[p.sentiment] || 0) + 1;
    }
  });

  // Group by threat level
  const byThreat: Record<string, number> = {};
  posts.forEach((p: any) => {
    if (p.threat_level) {
      byThreat[p.threat_level] = (byThreat[p.threat_level] || 0) + 1;
    }
  });

  const summary = {
    total: posts.length,
    byLanguage,
    bySource,
    bySentiment,
    byThreat,
    samplePosts: posts.slice(0, 5).map((p: any) => ({
      id: p.id,
      title: p.title,
      source: p.source,
      date: p.published_at,
    })),
  };

  return `داده‌های موجود:

کل مطالب: ${summary.total}
توزیع زبان: ${JSON.stringify(summary.byLanguage)}
توزیع منابع: ${JSON.stringify(summary.bySource)}
${Object.keys(summary.bySentiment).length > 0 ? "احساسات: " + JSON.stringify(summary.bySentiment) : ""}
${Object.keys(summary.byThreat).length > 0 ? "سطح تهدید: " + JSON.stringify(summary.byThreat) : ""}

نمونه مطالب: ${JSON.stringify(summary.samplePosts)}`;
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
