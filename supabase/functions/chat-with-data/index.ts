import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log('Chat request received');
    
    const { question, conversationHistory = [] }: ChatRequest = await req.json();
    
    if (!question || typeof question !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Question is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
    
    if (!deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Processing: "${question}"`);

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
          model: 'deepseek-chat',
          dataUsed: { postsCount: relevantData.posts.length }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        answer: 'متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.',
        error: error instanceof Error ? error.message : 'Unknown error',
        isError: true
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchRelevantData(supabase: any, question: string) {
  const query = question.toLowerCase();
  
  // Determine time range
  let timeFilter: string;
  const now = new Date();
  
  if (query.includes('امروز') || query.includes('today')) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    timeFilter = today.toISOString();
  } else if (query.includes('دیروز') || query.includes('yesterday')) {
    const yesterday = new Date(now.getTime() - 86400000);
    yesterday.setHours(0, 0, 0, 0);
    timeFilter = yesterday.toISOString();
  } else if (query.includes('هفته') || query.includes('week') || query.includes('۷')) {
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    timeFilter = weekAgo.toISOString();
  } else {
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    timeFilter = monthAgo.toISOString();
  }

  // Fetch posts
  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .gte('published_at', timeFilter)
    .order('published_at', { ascending: false })
    .limit(100);

  return { posts: posts || [], timeRange: timeFilter };
}

async function callDeepSeekAPI(apiKey: string, question: string, data: any, history: any[]) {
  const dataContext = buildDataContext(data);
  
  const messages = [
    {
      role: 'system',
      content: `تو یک تحلیلگر رسانه‌ای خبره هستی که به کاربر در تحلیل داده‌های رسانه‌ای کمک می‌کنی.

وظایف تو:
1. به هر سوالی درباره داده‌های رسانه‌ای پاسخ دقیق بده
2. از داده‌های واقعی استفاده کن و آمار دقیق ارائه بده
3. پاسخ‌ها رو به فارسی، واضح و کامل بنویس
4. اگر داده کافی نداری، صادقانه بگو
5. insights و الگوهای مهم رو highlight کن

داده‌های در دسترس:
${dataContext}

فرمت پاسخ (JSON):
{
  "answer": "پاسخ کامل به فارسی با فرمت markdown",
  "keyFindings": ["یافته کلیدی 1", "یافته 2", "..."],
  "statistics": {
    "total_posts": عدد,
    "relevant_count": عدد
  },
  "sources": {
    "posts": ["post_id1", "post_id2"]
  },
  "recommendations": ["توصیه 1", "توصیه 2"]
}`
    },
    ...history.slice(-10).map((msg: any) => ({
      role: msg.role,
      content: msg.content
    })),
    {
      role: 'user',
      content: question
    }
  ];

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('DeepSeek API error:', response.status, errorText);
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const result = await response.json();
  const aiAnswer = JSON.parse(result.choices[0].message.content);

  return {
    answer: aiAnswer.answer || 'پاسخی دریافت نشد',
    keyFindings: aiAnswer.keyFindings || [],
    statistics: aiAnswer.statistics || {},
    sources: aiAnswer.sources || { posts: [] },
    recommendations: aiAnswer.recommendations || [],
    usage: result.usage
  };
}

function buildDataContext(data: any) {
  const { posts } = data;

  if (!posts || posts.length === 0) {
    return 'هیچ داده‌ای در بازه زمانی انتخابی موجود نیست.';
  }

  // Group by language
  const byLanguage: Record<string, number> = {};
  posts.forEach((p: any) => {
    byLanguage[p.language] = (byLanguage[p.language] || 0) + 1;
  });

  // Group by source
  const bySource: Record<string, number> = {};
  posts.forEach((p: any) => {
    bySource[p.source] = (bySource[p.source] || 0) + 1;
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
    dateRange: {
      from: posts[posts.length - 1]?.published_at,
      to: posts[0]?.published_at
    },
    samplePosts: posts.slice(0, 10).map((p: any) => ({
      id: p.id,
      title: p.title,
      source: p.source,
      date: p.published_at,
      sentiment: p.sentiment,
      threat: p.threat_level
    }))
  };

  return JSON.stringify(summary, null, 2);
}

async function logAPIUsage(supabase: any, question: string, usage: any) {
  const inputCost = (usage.prompt_tokens * 0.27) / 1000000;
  const outputCost = (usage.completion_tokens * 1.10) / 1000000;
  const totalCost = inputCost + outputCost;

  await supabase.from('api_usage_logs').insert({
    endpoint: 'chat',
    question: question.substring(0, 200),
    tokens_used: usage.total_tokens,
    input_tokens: usage.prompt_tokens,
    output_tokens: usage.completion_tokens,
    model_used: 'deepseek-chat',
    status: 'success',
    cost_usd: totalCost
  });
}
