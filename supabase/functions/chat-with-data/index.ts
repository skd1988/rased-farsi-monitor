import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    console.log(`Processing question: "${question}" with context: ${context || 'none'}`);

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const questionLower = question.toLowerCase();
    let response: ChatResponse;

    // Check for "today" keywords
    if (questionLower.includes('امروز') || questionLower.includes('today')) {
      console.log('Matched: today query');
      response = {
        answer: "امروز ۴۳ مطلب جمع‌آوری شده:\n• ۱۸ مطلب فارسی\n• ۲۰ مطلب عربی\n• ۵ مطلب انگلیسی\n\nتوزیع احساسات:\n• مثبت: ۱۲ مطلب (۲۸٪)\n• خنثی: ۲۰ مطلب (۴۶٪)\n• منفی: ۱۱ مطلب (۲۶٪)\n\n۳ مطلب با Threat Level بالا شناسایی شده.",
        sources: {
          posts: ["RSS-101", "RSS-102", "RSS-103"],
          analysis: ["ANALYSIS-201"]
        },
        statistics: {
          total_posts: 43,
          positive: 12,
          negative: 11,
          neutral: 20,
          high_threat: 3
        },
        keyFindings: [
          "۱۸ مطلب فارسی جمع‌آوری شده",
          "۳ مطلب با سطح تهدید بالا شناسایی شد",
          "احساسات غالب خنثی است (۴۶٪)"
        ]
      };
    }
    // Check for "trend" keywords
    else if (questionLower.includes('ترند') || questionLower.includes('trend') || questionLower.includes('کلمات')) {
      console.log('Matched: trend query');
      response = {
        answer: "ترند کلمات کلیدی در ۷ روز اخیر:\n\n۱. جنگ روانی (۲۳ بار)\n۲. محور مقاومت (۱۸ بار)\n۳. اتهام (۱۵ بار)\n۴. کمپین (۱۲ بار)\n۵. شبهه (۱۰ بار)\n\nرشد قابل توجه:\n• 'جنگ روانی' +۴۵٪ نسبت به هفته قبل\n• 'اتهام' +۳۲٪ نسبت به هفته قبل",
        keyFindings: [
          "جنگ روانی پرتکرارترین کلمه است",
          "رشد ۴۵٪ در استفاده از 'جنگ روانی'",
          "۵ کلمه برتر ۷۸ بار تکرار شده‌اند"
        ],
        statistics: {
          total_keywords: 5,
          total_mentions: 78
        }
      };
    }
    // Check for "source" keywords
    else if (questionLower.includes('منبع') || questionLower.includes('source') || questionLower.includes('منفی')) {
      console.log('Matched: source query');
      response = {
        answer: "منابعی که بیشترین محتوای منفی دارند:\n\n۱. الجزیره: ۴۵ مطلب منفی (۶۳٪ از کل)\n۲. Sky News Arabia: ۳۲ مطلب منفی (۵۵٪)\n۳. BBC Arabic: ۲۱ مطلب منفی (۴۲٪)\n\nکلمات کلیدی مشترک:\n• اتهام (۲۳ بار)\n• تنش (۱۸ بار)\n• درگیری (۱۵ بار)",
        sources: {
          analysis: ["ANALYSIS-301", "ANALYSIS-302", "ANALYSIS-303"]
        },
        keyFindings: [
          "الجزیره بیشترین محتوای منفی را دارد",
          "۶۳٪ مطالب الجزیره احساسات منفی دارند",
          "کلمه 'اتهام' در ۲۳ مطلب تکرار شده"
        ]
      };
    }
    // Check for "campaign" keywords
    else if (questionLower.includes('کمپین') || questionLower.includes('campaign') || questionLower.includes('هماهنگ')) {
      console.log('Matched: campaign query');
      response = {
        answer: "⚠️ یک الگوی مشکوک شناسایی شد:\n\nدر ۲۴ ساعت گذشته، ۷ منبع مختلف با فاصله کمتر از ۴ ساعت، مطالبی با این کلمات منتشر کردند:\n\n• 'اتهام به ایران' (۷ بار)\n• 'دخالت' (۶ بار)\n• 'محور مقاومت' (۵ بار)\n\nمنابع درگیر:\nالجزیره، Sky News، Middle East Eye، Al-Monitor\n\n💡 توصیه: بررسی دقیق‌تر و ردیابی منشأ این روایت",
        keyFindings: [
          "۷ منبع در بازه زمانی نزدیک محتوای مشابه منتشر کردند",
          "کلمه 'اتهام به ایران' در همه مطالب مشترک است",
          "الگوی انتشار غیرطبیعی است"
        ],
        metadata: {
          threatLevel: "high",
          confidence: 0.78
        }
      };
    }
    // Check for "summary" keywords
    else if (questionLower.includes('خلاصه') || questionLower.includes('summary') || questionLower.includes('وضعیت')) {
      console.log('Matched: summary query');
      response = {
        answer: "📊 خلاصه وضعیت امروز:\n\n✅ فعالیت عادی: ۴۳ مطلب جمع‌آوری شده\n⚠️ ۳ مطلب با Threat بالا شناسایی شد\n\n🔍 نکات کلیدی:\n• افزایش استفاده از کلمه 'جنگ روانی'\n• الجزیره بیشترین محتوای منفی را دارد\n• هیچ کمپین هماهنگ‌شده جدی شناسایی نشد\n\n📈 ترند: احساسات عمدتاً خنثی است",
        statistics: {
          total_posts: 43,
          high_threat: 3,
          sentiment_neutral: 46
        }
      };
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
