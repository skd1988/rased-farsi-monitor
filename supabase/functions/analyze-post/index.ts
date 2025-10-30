import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postId, postTitle, postContent } = await req.json();
    
    if (!postId || !postContent) {
      return new Response(
        JSON.stringify({ error: 'postId and postContent are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    const startTime = Date.now();

    const prompt = `تو یک تحلیلگر رسانه‌ای حرفه‌ای هستی. این مطلب خبری رو تحلیل کن:

عنوان: ${postTitle}
محتوا: ${postContent}

لطفاً خروجی رو دقیقاً به این فرمت JSON بده (بدون هیچ توضیح اضافی):

{
  "summary": "خلاصه محتوا در 2-3 جمله فارسی",
  "sentiment": "Positive یا Negative یا Neutral",
  "sentiment_score": عدد بین -1.0 تا +1.0,
  "main_topic": "جنگ روانی یا محور مقاومت یا اتهام یا شبهه یا کمپین یا تحلیل سیاسی یا اخبار عادی",
  "threat_level": "Critical یا High یا Medium یا Low",
  "confidence": عدد بین 0 تا 100,
  "key_points": ["نکته 1", "نکته 2", "نکته 3"],
  "recommended_action": "اقدام پیشنهادی در یک جمله فارسی",
  "keywords_found": ["کلمه1", "کلمه2"]
}

معیارهای ارزیابی:
- Threat Level Critical: محتوای وایرال، اتهامات جدی، کمپین هماهنگ شده
- Threat Level High: محتوای تأثیرگذار
- Threat Level Medium: محتوای معمولی با کلیدواژه‌های مرتبط
- Threat Level Low: اشاره غیرمستقیم`;

    console.log('Calling DeepSeek API...');
    
    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.7
      })
    });

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error('DeepSeek API error:', errorText);
      throw new Error(`DeepSeek API error: ${deepseekResponse.status}`);
    }

    const deepseekData = await deepseekResponse.json();
    const responseContent = deepseekData.choices[0].message.content;
    
    console.log('DeepSeek raw response:', responseContent);
    
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    const analysis = JSON.parse(jsonMatch ? jsonMatch[0] : responseContent);
    
    const processingTime = (Date.now() - startTime) / 1000;

    console.log('Analysis completed successfully in', processingTime, 'seconds');
    console.log('Threat level:', analysis.threat_level, '| Sentiment:', analysis.sentiment);

    // Return analysis only - frontend will handle database update
    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: {
          analysis_summary: analysis.summary,
          sentiment: analysis.sentiment,
          sentiment_score: analysis.sentiment_score,
          main_topic: analysis.main_topic,
          threat_level: analysis.threat_level,
          confidence: analysis.confidence,
          key_points: analysis.key_points,
          recommended_action: analysis.recommended_action,
          analyzed_at: new Date().toISOString(),
          analysis_model: 'DeepSeek',
          processing_time: processingTime
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-post function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});