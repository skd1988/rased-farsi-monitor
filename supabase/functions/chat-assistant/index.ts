// Working version - Using exact same approach as analyze-post
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";
import { logDeepseekUsage } from "../_shared/deepseekUsage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

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
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's auth token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check user has required role (analyst, admin, or super_admin)
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['admin', 'super_admin', 'analyst'].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Authenticated user: ${user.email}, role: ${roleData.role}`);
    console.log("Chat request received");

    const { question, conversationHistory = [] }: ChatRequest = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");

    if (!deepseekApiKey) {
      throw new Error("DEEPSEEK_API_KEY not configured");
    }

    console.log(`Processing question: "${question}"`);

    // Fetch relevant data from Supabase
    const relevantData = await fetchRelevantData(supabaseAdmin, question);

    // Call DeepSeek API (using same method as analyze-post)
    const aiResponse = await callDeepSeekAPI(deepseekApiKey, question, relevantData, conversationHistory);

    const responseTime = Date.now() - startTime;

    // Log API usage
    await logDeepseekUsage(supabaseAdmin, {
      endpoint: "chat-assistant",
      functionName: "chat-assistant",
      usage: aiResponse.usage || {},
      responseTimeMs: responseTime,
      questionSnippet: question?.substring(0, 200) ?? null,
    });

    const processingTime = responseTime;
    console.log(`Response generated in ${processingTime}ms`);

    // Generate follow-up questions
    const followUpQuestions = generateFollowUpQuestions(
      relevantData.type,
      aiResponse,
      question,
      conversationHistory
    );

    return new Response(
      JSON.stringify({
        answer: aiResponse.answer,
        summary: aiResponse.summary,
        key_stats: aiResponse.key_stats,
        top_targets: aiResponse.top_targets,
        top_techniques: aiResponse.top_techniques,
        top_sources: aiResponse.top_sources,
        actionable_insights: aiResponse.actionable_insights,
        recommendations: aiResponse.recommendations,
        related_posts: aiResponse.related_posts,
        followUpQuestions: followUpQuestions,
        keyFindings: aiResponse.keyFindings,
        statistics: aiResponse.statistics,
        sources: aiResponse.sources,
        metadata: {
          processingTime,
          tokensUsed: aiResponse.usage.total_tokens,
          model: "deepseek-chat",
          queryType: relevantData.type,
          dataUsed: { 
            postsCount: relevantData.data?.length || 0,
            type: relevantData.type
          },
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

type QueryType = 
  | 'psyop_count'
  | 'target_analysis'
  | 'threat_assessment'
  | 'campaign_detection'
  | 'technique_analysis'
  | 'source_analysis'
  | 'temporal_analysis'
  | 'general';

function detectQueryType(question: string): QueryType {
  const q = question.toLowerCase();
  
  // PsyOp count queries
  if (q.match(/چند|تعداد|count|how many/i) && 
      q.match(/psyop|جنگ روانی|عملیات روانی/i)) {
    return 'psyop_count';
  }
  
  // Target analysis queries
  if (q.match(/هدف|target|نهاد|entity|کی|who/i) && 
      q.match(/حمله|attack|قرار گرفت/i)) {
    return 'target_analysis';
  }
  
  // Threat assessment queries
  if (q.match(/بحران|critical|تهدید|threat|خطرناک|urgent|فوری/i)) {
    return 'threat_assessment';
  }
  
  // Campaign detection queries
  if (q.match(/کمپین|campaign|هماهنگ|coordinated|الگو|pattern/i)) {
    return 'campaign_detection';
  }
  
  // Technique analysis queries
  if (q.match(/تاکتیک|technique|روش|method|چطور|how/i)) {
    return 'technique_analysis';
  }
  
  // Source analysis queries
  if (q.match(/منبع|source|رسانه|media|کدوم|which/i)) {
    return 'source_analysis';
  }
  
  // Temporal analysis queries
  if (q.match(/روند|trend|تغییر|change|زمان|time|تاریخچه/i)) {
    return 'temporal_analysis';
  }
  
  return 'general';
}

function extractTimeFilter(question: string): string {
  const now = new Date();
  const q = question.toLowerCase();
  
  if (q.match(/امروز|today/)) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
  }
  if (q.match(/دیروز|yesterday/)) {
    const yesterday = new Date(now.getTime() - 86400000);
    yesterday.setHours(0, 0, 0, 0);
    return yesterday.toISOString();
  }
  if (q.match(/این هفته|this week|هفته|۷/)) {
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    return weekAgo.toISOString();
  }
  if (q.match(/این ماه|this month|ماه/)) {
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    return monthAgo.toISOString();
  }
  
  // Default: last 7 days
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  return weekAgo.toISOString();
}

function groupBy(array: any[], key: string) {
  if (!array) return {};
  return array.reduce((acc, item) => {
    const value = item[key];
    if (value) {
      acc[value] = (acc[value] || 0) + 1;
    }
    return acc;
  }, {});
}

function flattenAndCount(array: any[], key: string) {
  if (!array) return {};
  const counts: Record<string, number> = {};
  array.forEach((item) => {
    const values = Array.isArray(item[key]) ? item[key] : [item[key]];
    values.forEach((val) => {
      if (val) {
        counts[val] = (counts[val] || 0) + 1;
      }
    });
  });
  return counts;
}

async function fetchRelevantData(supabase: any, question: string) {
  const queryType = detectQueryType(question);
  const timeFilter = extractTimeFilter(question);
  
  console.log(`Query type detected: ${queryType}`);
  console.log(`Time filter: ${timeFilter}`);
  
  try {
    switch(queryType) {
      case 'psyop_count': {
        // Count PsyOps with grouping
        const { data: countData, count } = await supabase
          .from('posts')
          .select('id, target_entity, threat_level, psyop_confidence', { count: 'exact' })
          .eq('is_psyop', true)
          .gte('published_at', timeFilter);
        
        const byThreatLevel = groupBy(countData, 'threat_level');
        const byTarget = flattenAndCount(countData, 'target_entity');
        
        return {
          type: 'psyop_count',
          total: count || 0,
          byThreatLevel,
          byTarget,
          data: countData || []
        };
      }
      
      case 'target_analysis': {
        // Analyze which entities are targeted
        const { data: targetData } = await supabase
          .from('posts')
          .select('target_entity, threat_level, psyop_type, published_at, title, source')
          .eq('is_psyop', true)
          .not('target_entity', 'is', null)
          .gte('published_at', timeFilter)
          .order('published_at', { ascending: false });
        
        const targets = flattenAndCount(targetData, 'target_entity');
        const topTargets = Object.entries(targets)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([entity, count]) => ({ entity, count }));
        
        return {
          type: 'target_analysis',
          topTargets,
          data: targetData || []
        };
      }
      
      case 'threat_assessment': {
        // Get critical and high threats
        const { data: threatData } = await supabase
          .from('posts')
          .select('*')
          .eq('is_psyop', true)
          .in('threat_level', ['Critical', 'High'])
          .gte('published_at', timeFilter)
          .order('published_at', { ascending: false })
          .limit(20);
        
        const critical = threatData?.filter((p: any) => p.threat_level === 'Critical') || [];
        const high = threatData?.filter((p: any) => p.threat_level === 'High') || [];
        
        return {
          type: 'threat_assessment',
          critical,
          high,
          data: threatData || []
        };
      }
      
      case 'campaign_detection': {
        // Check for active campaigns
        const { data: campaigns } = await supabase
          .from('psyop_campaigns')
          .select('*')
          .eq('status', 'Active')
          .order('start_date', { ascending: false });
        
        // Also check coordination indicators
        const { data: coordinated } = await supabase
          .from('posts')
          .select('*')
          .eq('is_psyop', true)
          .not('coordination_indicators', 'is', null)
          .gte('published_at', timeFilter)
          .limit(50);
        
        return {
          type: 'campaign_detection',
          activeCampaigns: campaigns || [],
          coordinatedPosts: coordinated || [],
          data: coordinated || []
        };
      }
      
      case 'technique_analysis': {
        // Analyze techniques used
        const { data: techData } = await supabase
          .from('posts')
          .select('psyop_technique, psyop_type, target_entity, threat_level')
          .eq('is_psyop', true)
          .not('psyop_technique', 'is', null)
          .gte('published_at', timeFilter);
        
        const techniques = flattenAndCount(techData, 'psyop_technique');
        const topTechniques = Object.entries(techniques)
          .sort((a, b) => b[1] - a[1])
          .map(([technique, count]) => ({ technique, count }));
        
        return {
          type: 'technique_analysis',
          topTechniques,
          data: techData || []
        };
      }
      
      case 'source_analysis': {
        // Analyze sources
        const { data: sourceData } = await supabase
          .from('posts')
          .select('source, source_credibility, threat_level')
          .eq('is_psyop', true)
          .gte('published_at', timeFilter);
        
        const sources: Record<string, any> = {};
        sourceData?.forEach((post: any) => {
          const src = post.source;
          if (!sources[src]) {
            sources[src] = { 
              count: 0, 
              credibility: post.source_credibility, 
              threats: {} 
            };
          }
          sources[src].count++;
          const threat = post.threat_level;
          if (threat) {
            sources[src].threats[threat] = (sources[src].threats[threat] || 0) + 1;
          }
        });
        
        const topSources = Object.entries(sources)
          .sort((a: any, b: any) => b[1].count - a[1].count)
          .slice(0, 10)
          .map(([source, data]) => ({ source, ...data as any }));
        
        return {
          type: 'source_analysis',
          topSources,
          data: sourceData || []
        };
      }
      
      case 'temporal_analysis': {
        // Trend analysis over time
        const { data: trendData } = await supabase
          .from('posts')
          .select('published_at, threat_level, target_entity, is_psyop')
          .eq('is_psyop', true)
          .gte('published_at', timeFilter)
          .order('published_at', { ascending: true });
        
        // Group by date
        const byDate: Record<string, number> = {};
        trendData?.forEach((post: any) => {
          const date = new Date(post.published_at).toISOString().split('T')[0];
          byDate[date] = (byDate[date] || 0) + 1;
        });
        
        return {
          type: 'temporal_analysis',
          timeline: byDate,
          data: trendData || []
        };
      }
      
      default: {
        // General query - get recent posts
        const { data: generalData } = await supabase
          .from('posts')
          .select('*')
          .gte('published_at', timeFilter)
          .order('published_at', { ascending: false })
          .limit(50);
        
        return {
          type: 'general',
          data: generalData || [],
          posts: generalData || []
        };
      }
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    // Fallback to general query
    const { data: fallbackData } = await supabase
      .from('posts')
      .select('*')
      .gte('published_at', timeFilter)
      .order('published_at', { ascending: false })
      .limit(50);
    
    return {
      type: 'general',
      data: fallbackData || [],
      posts: fallbackData || []
    };
  }
}

async function callDeepSeekAPI(apiKey: string, question: string, data: any, history: any[]) {
  const dataContext = buildDataContext(data);

  // Build conversation history
  const historyMessages = history.slice(-10).map((msg: any) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Detect if this is a general conversation (not analytical)
  const isGeneralConversation =
    question.toLowerCase().match(/^(سلام|hi|hello|چطوری|حالت|خوبی|ممنون|thanks|مرسی)/i) ||
    data.type === 'general' && (data.data?.length === 0 || !question.match(/چند|تعداد|تحلیل|بررسی|کمپین|حمله|psyop/i));

  // Create intelligent prompt based on query type
  const prompt = isGeneralConversation
    ? `شما یک دستیار هوشمند و دوستانه هستید که در تحلیل عملیات روانی تخصص دارید.

سوال کاربر: ${question}

${historyMessages.length > 0 ? `تاریخچه گفتگو:\n${historyMessages.map((m) => `${m.role}: ${m.content}`).join("\n")}\n` : ""}

⚠️ این یک سوال عمومی/احوالپرسی است - نه یک درخواست تحلیلی.

دستورالعمل:
- به صورت دوستانه و طبیعی پاسخ بده (به فارسی)
- از داده‌های رسانه‌ای استفاده **نکن**
- تحلیل PsyOp ارائه **نده**
- فقط یک پاسخ مودبانه و مختصر بده

مثال‌های پاسخ مناسب:
- سلام! → "سلام! چطور می‌تونم کمکتون کنم؟ 😊"
- چطوری؟ → "خوبم ممنون! شما چطور؟ در چه زمینه‌ای می‌تونم کمک کنم؟"
- ممنون → "خواهش می‌کنم! اگه سوال دیگه‌ای دارید در خدمتم."

خروجی را دقیقاً به این فرمت JSON بده:
{
  "answer": "پاسخ مختصر و دوستانه به فارسی",
  "summary": null,
  "key_stats": null,
  "top_targets": [],
  "top_techniques": [],
  "top_sources": [],
  "actionable_insights": [],
  "recommendations": [],
  "keyFindings": [],
  "statistics": {},
  "sources": {"posts": []},
  "related_posts": []
}`
    : `شما تحلیلگر ارشد عملیات روانی علیه محور مقاومت هستید.

سوال کاربر: ${question}

${historyMessages.length > 0 ? `تاریخچه گفتگو:\n${historyMessages.map((m) => `${m.role}: ${m.content}`).join("\n")}\n` : ""}

نوع تحلیل: ${data.type}

داده‌های تحلیل شده:
${dataContext}

خروجی را دقیقاً به این فرمت JSON بده:

{
  "answer": "پاسخ اصلی با **markdown formatting** (bold, bullets, etc.) - 2-3 پاراگراف فارسی",
  "summary": "خلاصه یک‌خطی (حداکثر 100 کاراکتر)",
  "key_stats": {
    "total_psyops": عدد یا null,
    "critical_threats": عدد یا null,
    "high_threats": عدد یا null,
    "active_campaigns": عدد یا null,
    "urgent_responses_needed": عدد یا null
  },
  "top_targets": [
    {"entity": "نام نهاد", "count": عدد, "threat": "Critical|High|Medium"}
  ],
  "top_techniques": [
    {"technique": "نام تکنیک", "count": عدد}
  ],
  "top_sources": [
    {"source": "نام منبع", "count": عدد, "credibility": "Known Enemy Source|Suspicious Source|..."}
  ],
  "actionable_insights": [
    "بینش عملیاتی قابل اجرا اول",
    "بینش عملیاتی قابل اجرا دوم"
  ],
  "recommendations": [
    "توصیه فوری اول",
    "توصیه فوری دوم"
  ],
  "keyFindings": ["یافته 1", "یافته 2"],
  "statistics": {},
  "sources": {"posts": []},
  "related_posts": []
}

قوانین مهم:
1. از داده‌های واقعی استفاده کن (نه تخمین)
2. answer باید markdown داشته باشد (**bold**, bullets)
3. فقط top 5 را در هر لیست نشان بده
4. actionable_insights باید قابل اجرا باشند
5. key_stats را از داده‌های واقعی پر کن
6. همیشه به فارسی پاسخ بده`;

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
    summary: aiAnswer.summary,
    key_stats: aiAnswer.key_stats,
    top_targets: aiAnswer.top_targets,
    top_techniques: aiAnswer.top_techniques,
    top_sources: aiAnswer.top_sources,
    actionable_insights: aiAnswer.actionable_insights,
    recommendations: aiAnswer.recommendations || [],
    related_posts: aiAnswer.related_posts,
    keyFindings: aiAnswer.keyFindings || [],
    statistics: aiAnswer.statistics || {},
    sources: aiAnswer.sources || { posts: [] },
    usage: result.usage,
  };
}

function buildDataContext(data: any) {
  const dataArray = data.data || data.posts || [];
  
  if (!dataArray || dataArray.length === 0) {
    return `هیچ داده‌ای در بازه زمانی موجود نیست.`;
  }

  let context = '';
  
  switch(data.type) {
    case 'psyop_count':
      context = `
📊 تعداد PsyOp ها: ${data.total}

توزیع بر اساس سطح تهدید:
${JSON.stringify(data.byThreatLevel, null, 2)}

اهداف اصلی:
${JSON.stringify(data.byTarget, null, 2)}

داده‌های کامل: ${dataArray.length} مورد
      `;
      break;
      
    case 'target_analysis':
      context = `
🎯 تحلیل اهداف حملات

بیشترین اهداف:
${data.topTargets.map((t: any) => `- ${t.entity}: ${t.count} حمله`).join('\n')}

تعداد کل مطالب: ${dataArray.length}
نمونه مطالب:
${dataArray.slice(0, 5).map((p: any) => `- ${p.title} (${p.source})`).join('\n')}
      `;
      break;
      
    case 'threat_assessment':
      context = `
⚠️ ارزیابی تهدیدات

تهدیدات بحرانی: ${data.critical.length}
تهدیدات سطح بالا: ${data.high.length}

مهم‌ترین تهدیدات:
${data.critical.slice(0, 3).map((p: any) => 
  `- ${p.title}\n  هدف: ${p.target_entity?.join(', ') || 'نامشخص'}\n  منبع: ${p.source}`
).join('\n\n')}
      `;
      break;
      
    case 'campaign_detection':
      context = `
🕸️ شناسایی کمپین‌های هماهنگ

کمپین‌های فعال: ${data.activeCampaigns.length}
${data.activeCampaigns.map((c: any) => 
  `- ${c.campaign_name} (${c.campaign_type})\n  هدف: ${c.main_target}\n  وضعیت: ${c.status}`
).join('\n\n')}

مطالب با نشانه هماهنگی: ${data.coordinatedPosts.length}
      `;
      break;
      
    case 'technique_analysis':
      context = `
🔧 تحلیل تاکتیک‌های جنگ روانی

بیشترین تاکتیک‌ها:
${data.topTechniques.slice(0, 10).map((t: any) => `- ${t.technique}: ${t.count} مورد`).join('\n')}

تعداد کل مطالب تحلیل شده: ${dataArray.length}
      `;
      break;
      
    case 'source_analysis':
      context = `
📰 تحلیل منابع

بیشترین منابع حمله:
${data.topSources.map((s: any) => 
  `- ${s.source} (${s.count} مورد)\n  اعتبار: ${s.credibility}\n  توزیع تهدید: ${JSON.stringify(s.threats)}`
).join('\n\n')}
      `;
      break;
      
    case 'temporal_analysis':
      context = `
📈 تحلیل روند زمانی

روند روزانه:
${Object.entries(data.timeline).map(([date, count]) => `- ${date}: ${count} مورد`).join('\n')}

تعداد کل: ${dataArray.length}
      `;
      break;
      
    default:
      // General query
      const byThreat = groupBy(dataArray, 'threat_level');
      const bySentiment = groupBy(dataArray, 'sentiment');
      const bySource = groupBy(dataArray, 'source');
      
      context = `
📊 خلاصه داده‌ها

کل مطالب: ${dataArray.length}

${Object.keys(byThreat).length > 0 ? `سطح تهدید:\n${Object.entries(byThreat).map(([k, v]) => `- ${k}: ${v}`).join('\n')}` : ''}

${Object.keys(bySentiment).length > 0 ? `\nاحساسات:\n${Object.entries(bySentiment).map(([k, v]) => `- ${k}: ${v}`).join('\n')}` : ''}

منابع اصلی:
${Object.entries(bySource).slice(0, 5).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

نمونه مطالب:
${dataArray.slice(0, 5).map((p: any) => `- ${p.title} (${p.source || 'نامشخص'})`).join('\n')}
      `;
  }
  
  return context.trim();
}

function generateFollowUpQuestions(
  queryType: string,
  responseData: any,
  originalQuestion: string,
  conversationHistory: any[]
): string[] {
  const followUps: string[] = [];
  
  // Check what user already asked
  const previousTopics = conversationHistory
    .filter((m: any) => m.role === 'user')
    .map((m: any) => m.content.toLowerCase());
  
  const isAlreadyAsked = (keywords: string[]) => 
    previousTopics.some((q: string) => keywords.some(k => q.includes(k)));
  
  switch(queryType) {
    case 'psyop_count':
      if (responseData.key_stats?.critical_threats > 0) {
        followUps.push("جزئیات موارد Critical رو بیشتر توضیح بده");
      }
      if (responseData.top_targets?.length > 0) {
        const topTarget = responseData.top_targets[0].entity;
        followUps.push(`چرا ${topTarget} بیشترین هدف حملات بوده؟`);
      }
      if (!isAlreadyAsked(['منبع', 'source'])) {
        followUps.push("کدوم منابع بیشترین حمله رو داشتن؟");
      }
      break;
    
    case 'target_analysis':
      if (responseData.top_targets?.length > 0) {
        const entity = responseData.top_targets[0].entity;
        if (!isAlreadyAsked(['تاکتیک', 'technique'])) {
          followUps.push(`چه تاکتیک‌هایی علیه ${entity} استفاده شده؟`);
        }
        if (!isAlreadyAsked(['روند', 'trend'])) {
          followUps.push(`روند حملات به ${entity} در این هفته چطور بوده؟`);
        }
      }
      if (!isAlreadyAsked(['پاسخ', 'response', 'استراتژی'])) {
        followUps.push("بهترین استراتژی پاسخ‌دهی چیه؟");
      }
      break;
    
    case 'threat_assessment':
      if (responseData.critical?.length > 0) {
        followUps.push("موارد Critical چه اتهاماتی دارن؟");
      }
      followUps.push("کدوم یک فوری‌ترین نیاز به پاسخ دارن؟");
      if (!isAlreadyAsked(['کمپین', 'campaign'])) {
        followUps.push("آیا این تهدیدات بخشی از کمپین هماهنگ هستند؟");
      }
      break;
    
    case 'campaign_detection':
      if (responseData.activeCampaigns?.length > 0) {
        followUps.push("جزئیات کمپین فعال رو بیشتر بگو");
        followUps.push("چطور می‌تونیم این کمپین رو خنثی کنیم؟");
      }
      if (!isAlreadyAsked(['الگو', 'pattern', 'زمان'])) {
        followUps.push("الگوهای زمانی این کمپین چیه؟");
      }
      break;
    
    case 'technique_analysis':
      if (responseData.top_techniques?.length > 0) {
        const topTech = responseData.top_techniques[0].technique;
        followUps.push(`چطور باید به تاکتیک "${topTech}" پاسخ بدیم؟`);
      }
      if (!isAlreadyAsked(['افزایش', 'increase'])) {
        followUps.push("کدوم تاکتیک‌ها در حال افزایش هستند؟");
      }
      if (!isAlreadyAsked(['گذشته', 'تاریخ'])) {
        followUps.push("تاکتیک‌های مشابه در گذشته چطور بودن؟");
      }
      break;
    
    case 'source_analysis':
      if (responseData.top_sources?.length > 0) {
        const topSource = responseData.top_sources[0].source;
        followUps.push(`${topSource} معمولاً چه روایتی داره؟`);
      }
      if (!isAlreadyAsked(['هماهنگ', 'coordinated'])) {
        followUps.push("کدوم منابع با هم هماهنگ کار می‌کنن؟");
      }
      if (!isAlreadyAsked(['اعتبار', 'credibility'])) {
        followUps.push("اعتبار این منابع چقدره؟");
      }
      break;
    
    case 'temporal_analysis':
      followUps.push("نقاط اوج حملات در کدوم روزها بوده؟");
      if (!isAlreadyAsked(['مقایسه', 'compare'])) {
        followUps.push("مقایسه با هفته گذشته چطوره؟");
      }
      followUps.push("پیش‌بینی روند برای روزهای آینده");
      break;
    
    default:
      if (!isAlreadyAsked(['آمار', 'statistics'])) {
        followUps.push("آمار دقیق‌تر نشون بده");
      }
      if (!isAlreadyAsked(['مقایسه', 'compare'])) {
        followUps.push("مقایسه با دیروز/هفته گذشته");
      }
      if (!isAlreadyAsked(['پیشنهاد', 'recommend'])) {
        followUps.push("پیشنهاد برای پاسخ‌دهی");
      }
  }
  
  // Return max 3 follow-ups
  return followUps.slice(0, 3);
}
