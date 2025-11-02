// Working version - Using exact same approach as analyze-post
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

  // Create intelligent prompt based on query type
  const prompt = `شما تحلیلگر ارشد عملیات روانی علیه محور مقاومت هستید.

سوال کاربر: ${question}

${historyMessages.length > 0 ? `تاریخچه گفتگو:\n${historyMessages.map((m) => `${m.role}: ${m.content}`).join("\n")}\n` : ""}

نوع تحلیل: ${data.type}

داده‌های تحلیل شده:
${dataContext}

قوانین پاسخ:
1. از داده‌های واقعی استفاده کن (نه تخمین)
2. آمار دقیق ارائه بده
3. نهادهای هدف را نام ببر
4. تاکتیک‌ها و تهدیدات را مشخص کن
5. سطح تهدید را ذکر کن
6. پیشنهادات عملیاتی بده

فرمت خروجی JSON:
{
  "answer": "خلاصه کامل (2-3 پاراگراف فارسی) + جزئیات کلیدی با bullet points",
  "keyFindings": ["یافته مهم 1", "یافته مهم 2", "یافته مهم 3"],
  "statistics": {"metric1": value, "metric2": value},
  "sources": {"posts": ["id1", "id2"]},
  "recommendations": ["توصیه عملیاتی 1", "توصیه عملیاتی 2"]
}

مهم: همیشه به فارسی پاسخ بده و از داده‌های واقعی استفاده کن.`;

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
