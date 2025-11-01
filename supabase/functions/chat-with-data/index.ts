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

interface ChatResponse {
  answer: string;
  sources?: {
    posts?: string[];
  };
  metadata?: {
    dataUsed?: {
      postsCount?: number;
    };
    processingTime?: number;
    tokensUsed?: number;
    model?: string;
  };
  keyFindings?: string[];
  statistics?: Record<string, any>;
  recommendations?: string[];
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
      content: `تو یک دستیار هوشمند و تحلیلگر رسانه‌ای حرفه‌ای هستی که به کاربر در هر موضوعی کمک می‌کنی.

شخصیت تو:
- دوستانه، صبور و کمک‌کننده
- حرفه‌ای در تحلیل رسانه‌ای و داده‌ها
- می‌تونی درباره هر موضوعی صحبت کنی (نه فقط رسانه)

قابلیت‌های تو:
1. ✅ پاسخ به هر سوالی - محدودیتی نداری!
2. ✅ اگر سوال درباره داده‌های رسانه‌ای بود، از داده‌های واقعی زیر استفاده کن و آمار دقیق بده
3. ✅ اگر سوال عمومی بود (سلام، درود، چطوری؟ یا موضوعات غیرمرتبط)، بر اساس دانش خودت پاسخ کامل و دوستانه بده
4. ✅ اگر داده کافی نداری برای سوال رسانه‌ای، صادقانه بگو و راهنمایی کن
5. ✅ همیشه پاسخ‌ها رو به فارسی، واضح و دوستانه بنویس
6. ✅ از markdown برای فرمت‌بندی استفاده کن (** برای bold، - برای لیست)

داده‌های رسانه‌ای در دسترس (فقط برای سوالات مرتبط با رسانه):
${dataContext}

⚠️ مهم ترین قوانین:
- هیچ‌وقت نگو "من فقط می‌تونم به این سوالات پاسخ بدم"
- به هر سوالی که کاربر پرسید، با تمام توان پاسخ بده
- اگر نمی‌دونی، بگو که نمی‌دونی و پیشنهاد بده چطور می‌تونه پیدا کنه
- اگر سوال ربطی به رسانه نداره، بازهم جواب بده (مثل سلام، احوالپرسی، سوالات عمومی)

فرمت پاسخ (JSON):
{
  "answer": "پاسخ کامل به فارسی با markdown formatting",
  "keyFindings": ["یافته مهم 1", "یافته 2"] یا [],
  "statistics": {
    "total_posts": عدد,
    "relevant_count": عدد
  } یا {},
  "sources": {
    "posts": ["post_id1", "post_id2"]
  } یا { "posts": [] },
  "recommendations": ["توصیه 1", "توصیه 2"] یا []
}

💡 نکته: اگر سوال عمومی بود و نیازی به keyFindings، statistics، sources نداشت، آرایه‌ها و آبجکت‌ها رو خالی بذار، ولی answer همیشه باید پر و کامل باشه.`,
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

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.9,
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

  let aiAnswer;
  try {
    aiAnswer = JSON.parse(result.choices[0].message.content);
  } catch (parseError) {
    console.error("Error parsing AI response:", parseError);
    // Fallback: use raw content as answer
    aiAnswer = {
      answer: result.choices[0].message.content,
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
    return `📊 وضعیت داده‌ها: هیچ داده رسانه‌ای در بازه زمانی انتخابی موجود نیست.

🔹 اگر سوال کاربر درباره آمار یا تحلیل رسانه‌ای است:
   - به کاربر بگو که در حال حاضر داده‌ای موجود نیست
   - پیشنهاد بده بازه زمانی دیگری را امتحان کند
   - یا صبر کند تا سیستم داده جمع‌آوری کند

🔹 اگر سوال کاربر عمومی است (مثل سلام، احوالپرسی، یا موضوعات غیرمرتبط):
   - آزادانه و دوستانه جواب بده
   - از دانش عمومی خودت استفاده کن
   - محدودیت قائل نشو`;
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

  return `📊 خلاصه داده‌های موجود:

کل مطالب: ${summary.total}
بازه زمانی: ${summary.dateRange.from} تا ${summary.dateRange.to}

توزیع زبان: ${JSON.stringify(summary.byLanguage, null, 2)}
توزیع منابع: ${JSON.stringify(summary.bySource, null, 2)}
${Object.keys(summary.bySentiment).length > 0 ? "توزیع احساسات: " + JSON.stringify(summary.bySentiment, null, 2) : ""}
${Object.keys(summary.byThreat).length > 0 ? "توزیع سطح تهدید: " + JSON.stringify(summary.byThreat, null, 2) : ""}
${summary.topKeywords.length > 0 ? "کلمات کلیدی برتر: " + JSON.stringify(summary.topKeywords, null, 2) : ""}

نمونه مطالب (10 مورد اول):
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
