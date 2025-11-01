import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  question: string;
  context?: string;
}

interface ChatResponse {
  answer: string;
  sources?: {
    posts?: string[];
    analysis?: string[];
  };
  metadata?: {
    dataUsed?: {
      rawPostsCount?: number;
      analyzedPostsCount?: number;
    };
    processingTime?: number;
    threatLevel?: string;
    confidence?: number;
  };
  keyFindings?: string[];
  statistics?: Record<string, number>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log('Chat request received');
    
    const { question, context }: ChatRequest = await req.json();
    
    if (!question || typeof question !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Question is required and must be a string' }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Processing question: "${question}" with context: ${context || 'none'}`);

    // Get today's date for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const questionLower = question.toLowerCase();
    let response: ChatResponse;

    // Check for "today" keywords
    if (questionLower.includes('امروز') || questionLower.includes('today')) {
      console.log('Matched: today query');
      
      const { data: todayPosts, error } = await supabase
        .from('posts')
        .select('*')
        .gte('published_at', today.toISOString())
        .order('published_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (!todayPosts || todayPosts.length === 0) {
        response = {
          answer: "⚠️ هنوز داده‌ای برای امروز در دیتابیس وجود ندارد.\n\nبرای شروع:\n1. داده‌های نمونه را import کنید\n2. یا منتظر بمانید تا سیستم RSS داده جمع‌آوری کند\n\nآیا می‌خواهید داده‌های نمونه اضافه شوند؟",
          keyFindings: ["هیچ داده‌ای برای امروز یافت نشد"],
          statistics: { total_posts: 0 }
        };
      } else {
        // Calculate statistics
        const persianCount = todayPosts.filter((p: any) => p.language === 'فارسی').length;
        const arabicCount = todayPosts.filter((p: any) => p.language === 'عربی').length;
        const englishCount = todayPosts.filter((p: any) => p.language === 'انگلیسی').length;
        
        const analyzed = todayPosts.filter((p: any) => p.threat_level);
        const positiveCount = analyzed.filter((p: any) => p.sentiment === 'مثبت').length;
        const negativeCount = analyzed.filter((p: any) => p.sentiment === 'منفی').length;
        const neutralCount = analyzed.filter((p: any) => p.sentiment === 'خنثی').length;
        const highThreatCount = analyzed.filter((p: any) => p.threat_level === 'High' || p.threat_level === 'Critical').length;

        response = {
          answer: `امروز ${todayPosts.length} مطلب جمع‌آوری شده:\n• ${persianCount} مطلب فارسی\n• ${arabicCount} مطلب عربی\n• ${englishCount} مطلب انگلیسی\n\nتوزیع احساسات:\n• مثبت: ${positiveCount} مطلب (${Math.round(positiveCount/analyzed.length*100) || 0}٪)\n• خنثی: ${neutralCount} مطلب (${Math.round(neutralCount/analyzed.length*100) || 0}٪)\n• منفی: ${negativeCount} مطلب (${Math.round(negativeCount/analyzed.length*100) || 0}٪)\n\n${highThreatCount} مطلب با Threat Level بالا شناسایی شده.`,
          sources: {
            posts: todayPosts.slice(0, 5).map((p: any) => p.id),
          },
          statistics: {
            total_posts: todayPosts.length,
            positive: positiveCount,
            negative: negativeCount,
            neutral: neutralCount,
            high_threat: highThreatCount
          },
          keyFindings: [
            `${persianCount} مطلب فارسی جمع‌آوری شده`,
            `${highThreatCount} مطلب با سطح تهدید بالا شناسایی شد`,
            `احساسات غالب ${neutralCount > positiveCount && neutralCount > negativeCount ? 'خنثی' : negativeCount > positiveCount ? 'منفی' : 'مثبت'} است`
          ],
          metadata: {
            dataUsed: {
              rawPostsCount: todayPosts.length,
              analyzedPostsCount: analyzed.length
            }
          }
        };
      }
    }
    // Check for "trend" keywords
    else if (questionLower.includes('ترند') || questionLower.includes('trend') || questionLower.includes('کلمات')) {
      console.log('Matched: trend query');
      
      const { data: posts, error } = await supabase
        .from('posts')
        .select('keywords, main_topic')
        .gte('published_at', sevenDaysAgo.toISOString())
        .not('keywords', 'is', null);

      if (error) throw error;

      if (!posts || posts.length === 0) {
        response = {
          answer: "هنوز داده کافی برای تحلیل ترند کلمات کلیدی وجود ندارد.",
          keyFindings: ["داده ناکافی"],
        };
      } else {
        // Flatten and count keywords
        const keywordCounts: Record<string, number> = {};
        posts.forEach((post: any) => {
          if (post.keywords) {
            post.keywords.forEach((keyword: string) => {
              keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
            });
          }
        });

        const sortedKeywords = Object.entries(keywordCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        const keywordsText = sortedKeywords
          .map(([keyword, count], idx) => `${idx + 1}. ${keyword} (${count} بار)`)
          .join('\n');

        response = {
          answer: `ترند کلمات کلیدی در ۷ روز اخیر:\n\n${keywordsText}\n\nجمع کل: ${posts.length} مطلب تحلیل شده`,
          keyFindings: [
            `${sortedKeywords[0]?.[0] || 'نامشخص'} پرتکرارترین کلمه است`,
            `${sortedKeywords.length} کلمه برتر ${sortedKeywords.reduce((sum, [, count]) => sum + count, 0)} بار تکرار شده‌اند`
          ],
          statistics: {
            total_keywords: Object.keys(keywordCounts).length,
            total_mentions: Object.values(keywordCounts).reduce((a, b) => a + b, 0)
          }
        };
      }
    }
    // Check for "source" keywords
    else if (questionLower.includes('منبع') || questionLower.includes('source') || questionLower.includes('منفی')) {
      console.log('Matched: source query');
      
      const { data: posts, error } = await supabase
        .from('posts')
        .select('source, sentiment')
        .gte('published_at', sevenDaysAgo.toISOString())
        .eq('sentiment', 'منفی')
        .order('published_at', { ascending: false });

      if (error) throw error;

      if (!posts || posts.length === 0) {
        response = {
          answer: "هیچ محتوای منفی در بازه زمانی انتخابی یافت نشد.",
          keyFindings: []
        };
      } else {
        // Count by source
        const sourceCounts: Record<string, number> = {};
        posts.forEach((post: any) => {
          sourceCounts[post.source] = (sourceCounts[post.source] || 0) + 1;
        });

        const topSources = Object.entries(sourceCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3);

        const sourcesText = topSources
          .map(([source, count], idx) => `${idx + 1}. ${source}: ${count} مطلب منفی`)
          .join('\n');

        response = {
          answer: `منابعی که بیشترین محتوای منفی دارند:\n\n${sourcesText}\n\nجمع کل: ${posts.length} مطلب منفی`,
          sources: {
            analysis: topSources.map(([source]) => source)
          },
          keyFindings: [
            `${topSources[0]?.[0] || 'نامشخص'} بیشترین محتوای منفی را دارد`,
            `${posts.length} مطلب با احساسات منفی شناسایی شد`
          ]
        };
      }
    }
    // Check for "campaign" keywords
    else if (questionLower.includes('کمپین') || questionLower.includes('campaign') || questionLower.includes('هماهنگ')) {
      console.log('Matched: campaign query');
      
      const { data: posts, error } = await supabase
        .from('posts')
        .select('source, keywords, published_at, title')
        .gte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .not('keywords', 'is', null)
        .order('published_at', { ascending: false });

      if (error) throw error;

      if (!posts || posts.length === 0) {
        response = {
          answer: "داده کافی برای تشخیص الگوی کمپین هماهنگ‌شده وجود ندارد.",
          keyFindings: []
        };
      } else {
        // Look for coordinated patterns (same keywords from multiple sources in short time)
        const keywordsBySource: Record<string, Set<string>> = {};
        posts.forEach((post: any) => {
          if (!keywordsBySource[post.source]) {
            keywordsBySource[post.source] = new Set();
          }
          post.keywords?.forEach((kw: string) => keywordsBySource[post.source].add(kw));
        });

        // Find common keywords across multiple sources
        const allKeywords = new Set<string>();
        Object.values(keywordsBySource).forEach(keywords => {
          keywords.forEach(kw => allKeywords.add(kw));
        });

        const commonKeywords = Array.from(allKeywords).filter(kw => {
          const sourceCount = Object.values(keywordsBySource).filter(keywords => keywords.has(kw)).length;
          return sourceCount >= 3; // At least 3 sources use this keyword
        });

        if (commonKeywords.length > 0) {
          response = {
            answer: `⚠️ یک الگوی مشکوک شناسایی شد:\n\nدر ۲۴ ساعت گذشته، ${Object.keys(keywordsBySource).length} منبع مختلف مطالبی با کلمات مشترک منتشر کردند:\n\n${commonKeywords.slice(0, 5).map(kw => `• '${kw}'`).join('\n')}\n\nمنابع درگیر:\n${Object.keys(keywordsBySource).slice(0, 4).join('، ')}\n\n💡 توصیه: بررسی دقیق‌تر و ردیابی منشأ این روایت`,
            keyFindings: [
              `${Object.keys(keywordsBySource).length} منبع در بازه زمانی نزدیک محتوای مشابه منتشر کردند`,
              `${commonKeywords.length} کلمه کلیدی مشترک شناسایی شد`,
              "الگوی انتشار قابل بررسی است"
            ],
            metadata: {
              threatLevel: "medium",
              confidence: 0.65
            }
          };
        } else {
          response = {
            answer: "هیچ الگوی هماهنگ‌شده مشکوکی در ۲۴ ساعت گذشته شناسایی نشد.",
            keyFindings: ["الگوی عادی انتشار محتوا"]
          };
        }
      }
    }
    // Check for "summary" keywords
    else if (questionLower.includes('خلاصه') || questionLower.includes('summary') || questionLower.includes('وضعیت')) {
      console.log('Matched: summary query');
      
      const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .gte('published_at', today.toISOString());

      if (error) throw error;

      if (!posts || posts.length === 0) {
        response = {
          answer: "هنوز داده‌ای برای خلاصه امروز وجود ندارد.",
          statistics: { total_posts: 0 }
        };
      } else {
        const highThreatCount = posts.filter((p: any) => p.threat_level === 'High' || p.threat_level === 'Critical').length;
        const neutralSentiment = Math.round(posts.filter((p: any) => p.sentiment === 'خنثی').length / posts.length * 100) || 0;

        response = {
          answer: `📊 خلاصه وضعیت امروز:\n\n✅ فعالیت عادی: ${posts.length} مطلب جمع‌آوری شده\n${highThreatCount > 0 ? `⚠️ ${highThreatCount} مطلب با Threat بالا شناسایی شد\n` : ''}\n🔍 نکات کلیدی:\n• تعداد مطالب: ${posts.length}\n• میزان احساسات خنثی: ${neutralSentiment}٪\n\n📈 ترند: وضعیت ${highThreatCount > 2 ? 'نیاز به توجه دارد' : 'عادی است'}`,
          statistics: {
            total_posts: posts.length,
            high_threat: highThreatCount,
            sentiment_neutral: neutralSentiment
          }
        };
      }
    }
    // Default response
    else {
      console.log('Matched: default response');
      response = {
        answer: "متوجه سوال شما شدم. در حال حاضر من می‌توانم به سوالات زیر پاسخ دهم:\n\n• مطالب امروز\n• ترند کلمات کلیدی\n• تحلیل منابع\n• شناسایی کمپین\n• خلاصه وضعیت\n\nلطفاً یکی از این موارد را انتخاب کنید یا سوال خود را دقیق‌تر بیان کنید.",
        keyFindings: []
      };
    }

    // Add processing time to metadata
    const processingTime = Date.now() - startTime;
    response.metadata = {
      ...response.metadata,
      processingTime
    };

    console.log(`Response generated in ${processingTime}ms`);

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in chat-with-data function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
