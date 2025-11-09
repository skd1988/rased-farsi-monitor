import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postId, title, contents, source, language, published_at, quickDetectionResult } = await req.json();
    
    console.log(`Analyzing post ${postId}: ${title}`);

    if (!DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY not configured");
    }

    const startTime = Date.now();

    // DeepSeek API call with retry logic
    let response;
    const maxRetries = 3;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              {
                role: "system",
                content: `شما یک تحلیلگر ارشد جنگ روانی و عملیات روانی هستید که تخصص در شناسایی و تحلیل حملات اطلاعاتی علیه جبهه مقاومت دارید.

محور مقاومت شامل: جمهوری اسلامی ایران، حزب‌الله لبنان، حشد الشعبی عراق، انصارالله یمن، حماس فلسطین، جهاد اسلامی فلسطین، سایر گروه‌های مقاومت.

دشمنان شناخته‌شده: رژیم صهیونیستی (اسرائیل)، ایالات متحده، رسانه‌های غربی وابسته، برخی کشورهای عربی همسو با غرب، گروه‌های تکفیری.`
          },
          {
            role: "user",
            content: `${quickDetectionResult ? `مرحله اول (غربالگری سریع) این مطلب را به عنوان PsyOp شناسایی کرد:
- اطمینان: ${quickDetectionResult.psyop_confidence}%
- سطح تهدید: ${quickDetectionResult.threat_level}
- هدف اصلی: ${quickDetectionResult.primary_target || 'نامشخص'}

حالا تحلیل کامل و عمیق انجام بده:

` : ''}مطلب زیر را تحلیل کنید:

عنوان: ${title}
محتوا: ${contents}
منبع: ${source}
زبان: ${language}
تاریخ: ${published_at}

⚠️ نکات مهم و اجباری:
1. فیلد narrative_theme اجباری است و باید حتماً یکی از این مقادیر دقیق باشد (نه null):
   - "Demonization" (شیطان‌سازی)
   - "Delegitimization" (بی‌اعتبارسازی)
   - "Victimization" (قربانی‌سازی)
   - "Fear-Mongering" (ترس‌افکنی)
   - "Divide & Conquer" (تفرقه‌اندازی)
   - "False Flag" (پرچم دروغین)
   - "Whitewashing" (سفیدشویی)
   - "Heroization" (قهرمان‌سازی)

2. فیلد narrative_type اجباری است و باید یکی از این باشد:
   - "Attack" (حمله)
   - "Defense" (دفاع)
   - "Supportive" (حمایتی)
   - "Neutral" (خنثی)

فقط JSON خروجی بدهید (بدون markdown):

{
  "is_psyop": "Yes" یا "No" یا "Uncertain",
  "psyop_confidence": عدد 0-100,
  "psyop_type": "Direct Attack" | "Indirect Accusation" | "Doubt Creation" | "False Flag" | "Demoralization" | "Division Creation" | "Information Warfare" | "Propaganda Campaign" | null,
  
  "primary_target": "نام دقیق نهاد از لیست محور مقاومت یا null",
  "secondary_targets": ["نهاد1", "نهاد2"] یا [],
  
  "targeted_persons": [
    {
      "name_persian": "سیدحسن نصرالله",
      "name_english": "Hassan Nasrallah",
      "name_arabic": "حسن نصر الله",
      "entity_type": "Individual",
      "position": "دبیرکل",
      "organization": "حزب‌الله لبنان",
      "category": "رهبر سیاسی",
      "country": "Lebanon",
      "side": "Resistance",
      "attack_nature": "Personal"
    }
  ],
  
  "target_category": "Leadership" | "Military Forces" | "Political Wing" | "Social Base" | "International Support" | null,
  "attack_vectors": ["Human Rights Violations", "Terrorism Labeling", "Sectarian Division", "Foreign Interference", "Corruption Allegations", "Weakness Portrayal", "Legitimacy Questioning", "Historical Revisionism"],
  
  "narrative_theme": "Demonization",  ⬅️ ⚠️ MANDATORY - یکی از 8 مقدار بالا
  "narrative_type": "Attack",  ⬅️ ⚠️ MANDATORY - یکی از 4 مقدار بالا
  
  ⚠️ CRITICAL: برای targeted_persons، باید اطلاعات کامل و دقیق بدهید:

📋 لیست کامل دسته‌بندی‌های مجاز (category) - ⚠️ MANDATORY:

**افراد تحت حمله:**
1. "رهبر سیاسی" - Political Leader
   مثال: سیدحسن نصرالله، اسماعیل هنیه، عبدالملک الحوثی
   شامل: رهبران سیاسی جنبش‌های مقاومت

2. "فرمانده نظامی" - Military Commander  
   مثال: قاسم سلیمانی، عماد مغنیه، ابومهدی المهندس
   شامل: فرماندهان نظامی سپاه، حزب‌الله، حشدالشعبی

3. "مرجع دینی" - Religious Authority
   مثال: آیت‌الله خامنه‌ای، آیت‌الله سیستانی
   شامل: مراجع تقلید و علمای برجسته

4. "سخنگو" - Spokesperson
   مثال: محمد عفیف (سخنگوی حزب‌الله)
   شامل: سخنگویان رسمی سازمان‌ها

5. "فعال" - Activist
   مثال: فعالان رسانه‌ای، نویسندگان طرفدار مقاومت
   شامل: روزنامه‌نگاران، بلاگرها، فعالان مدنی

**سازمان‌ها تحت حمله:**
6. "سازمان" - Organization
   مثال: حزب‌الله لبنان، انصارالله یمن، حشدالشعبی عراق
   استفاده: وقتی هدف یک سازمان است نه فرد مشخص

⚠️ راهنمای تشخیص category:
- اگر عنوان دارد مثل "Secretary-General", "Leader" → رهبر سیاسی
- اگر رتبه نظامی دارد مثل "Commander", "General" → فرمانده نظامی  
- اگر عنوان مذهبی دارد مثل "Ayatollah", "Sheikh" → مرجع دینی
- اگر "Spokesperson", "Media" در توضیحات → سخنگو
- اگر "Journalist", "Activist", "Blogger" → فعال
- اگر نام سازمان است مثل "Hezbollah", "Hamas" → سازمان

⚠️ فیلد side را حتماً مشخص کن:
- "Resistance" - اگر هدف عضو محور مقاومت است
- "Anti-Resistance" - اگر هدف مخالف محور مقاومت است

⚠️ position باید دقیق باشد: "دبیرکل"، "فرمانده کل"، "سخنگو رسمی"، "مرجع تقلید"، etc.

⚠️ اگر هدف سازمان است:
  * entity_type: "Organization"
  * position: null
  * category: "سازمان"

مثال کامل برای فرد:
{
  "name_persian": "سیدحسن نصرالله",
  "name_english": "Hassan Nasrallah",
  "name_arabic": "حسن نصر الله",
  "entity_type": "Individual",
  "position": "دبیرکل",
  "organization": "حزب‌الله لبنان",
  "category": "رهبر سیاسی",
  "country": "Lebanon",
  "side": "Resistance",
  "attack_nature": "Personal"
}

مثال کامل برای سازمان:
{
  "name_persian": "حزب‌الله لبنان",
  "name_english": "Hezbollah Lebanon",
  "name_arabic": "حزب الله لبنان",
  "entity_type": "Organization",
  "position": null,
  "organization": "حزب‌الله لبنان",
  "category": "سازمان",
  "country": "Lebanon",
  "side": "Resistance",
  "attack_nature": "Institutional"
}
  
  "threat_level": "Critical" | "High" | "Medium" | "Low",
  "virality_potential": عدد 0-10,
  "coordination_indicators": ["Similar Timing", "Same Keywords", "Multiple Sources", "Cross-Platform", "Synchronized Release"],
  "evidence_type": ["Fabricated", "Manipulated", "Out of Context", "Unverified", "Partial Truth", "Opinion as Fact"],
  "source_credibility": "Known Enemy Source" | "Suspicious Source" | "Neutral Source" | "Unclear Source",
  "urgency_level": "Immediate" | "High" | "Medium" | "Low" | "Monitor Only",
  "summary": "خلاصه فارسی در 2-3 جمله",
  "recommended_response": "استراتژی پاسخ در 3-5 جمله فارسی",
  "counter_narrative_points": ["نکته اول", "نکته دوم", "نکته سوم"],
  "suggested_spokespeople": ["Official Media", "Political Leadership", "Military Spokesperson", "Religious Authority", "Social Media Activists", "International Partners"],
  "response_channels": ["Official Statement", "Social Media Campaign", "Press Conference", "Documentary Evidence", "Expert Analysis", "Grassroots Mobilization"],
  "keywords": ["کلمه1", "کلمه2", "کلمه3", "کلمه4", "کلمه5"],
  "sentiment": "Positive" | "Negative" | "Neutral",
  "sentiment_score": عدد -1.0 تا +1.0,
  "main_topic": "سیاسی" | "نظامی" | "اقتصادی" | "اجتماعی" | "فرهنگی" | "مذهبی",
  "campaign_indicators": {
    "is_part_of_campaign": true | false,
    "campaign_name_suggestion": "نام پیشنهادی یا null",
    "similar_content_keywords": ["کلمه1", "کلمه2"]
  }
}

📚 راهنمای انتخاب narrative_theme:

1. **Demonization** (شیطان‌سازی) - رایج‌ترین:
   ✅ اتهام تروریسم، افراطی‌گری
   ✅ توصیف به عنوان تهدید، خطر
   ✅ استفاده از واژگان منفی شدید (شیطان، وحشی، تروریست)
   مثال: "گروه تروریستی حزب‌الله"

2. **Delegitimization** (بی‌اعتبارسازی):
   ✅ زیر سوال بردن مشروعیت
   ✅ توصیف به عنوان غیرقانونی، نامشروع
   ✅ اتهام وابستگی به قدرت خارجی
   مثال: "میلیشیای غیرقانونی وابسته به ایران"

3. **Fear-Mongering** (ترس‌افکنی):
   ✅ تأکید بر خطرات و تهدیدها
   ✅ ایجاد حس ناامنی
   ✅ بزرگ‌نمایی قدرت نظامی
   مثال: "تهدید فزاینده موشک‌های حزب‌الله"

4. **Divide & Conquer** (تفرقه‌اندازی):
   ✅ تأکید بر اختلافات فرقه‌ای
   ✅ ایجاد شکاف بین گروه‌ها
   ✅ شیعه vs سنی
   مثال: "جنگ شیعه و سنی توسط ایران"

5. **False Flag** (پرچم دروغین):
   ✅ ادعاهای بدون مدرک
   ✅ اتهامات مبتنی بر "منابع امنیتی"
   ✅ اخبار کذب
   مثال: "منابع امنیتی: حزب‌الله سلاح شیمیایی دارد"

6. **Victimization** (قربانی‌سازی):
   ✅ نشان دادن هدف به عنوان قربانی
   ✅ تأکید بر آسیب‌دیدگان
   مثال: "قربانیان حملات حزب‌الله"

7. **Heroization** (قهرمان‌سازی):
   ✅ نمایش مثبت دشمنان محور مقاومت
   ✅ تحسین مخالفان
   مثال: "مبارزان آزادی سوریه"

8. **Whitewashing** (سفیدشویی):
   ✅ توجیه اقدامات دشمن
   ✅ پوشش دادن به جنایات
   مثال: "عملیات دموکراتیک علیه تروریسم"

⚠️ حتماً narrative_theme و narrative_type را پر کن، حتی اگر مطلب PsyOp نیست.

معیارهای تشخیص:
- is_psyop = "Yes": اتهامات بدون مدرک، تحریف واقعیات، برچسب‌زنی منفی، ایجاد شبهه، نمایش ضعف، ایجاد اختلاف
- threat_level = "Critical": رسانه قدرتمند، وایرال، اتهامات جدی، کمپین هماهنگ، هدف شخصیت برجسته
- urgency_level = "Immediate": در حال وایرال شدن، رسانه‌های متعدد همزمان، اتهام علیه رهبری، خطر آسیب به افکار عمومی`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
    });
    
    if (!response.ok) {
      // If rate limited, retry with exponential backoff
      if ((response.status === 429 || response.status === 503 || response.status === 504) && attempt < maxRetries - 1) {
        const backoffDelay = Math.pow(2, attempt) * 3000;
        console.log(`⏳ Rate limited, retrying after ${backoffDelay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        continue;
      }
      
      const errorText = await response.text();
      console.error("DeepSeek API error:", response.status, errorText);
      throw new Error(`DeepSeek API error: ${response.status}`);
    }
    
    // Success, break out of retry loop
    break;
    
  } catch (error) {
    if (attempt === maxRetries - 1) throw error;
    
    const backoffDelay = Math.pow(2, attempt) * 3000;
    console.log(`⏳ Retrying after error (attempt ${attempt + 1}/${maxRetries})...`);
    await new Promise(resolve => setTimeout(resolve, backoffDelay));
  }
}

if (!response) {
  throw new Error('Failed to get response from DeepSeek API after retries');
}

    const data = await response.json();
    let analysisResult;

    try {
      const content = data.choices[0].message.content;
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysisResult = JSON.parse(cleanContent);
    } catch (e) {
      console.error("Failed to parse DeepSeek response:", e);
      throw new Error("Failed to parse DeepSeek response as JSON");
    }

    // ⚠️ CRITICAL VALIDATION: Ensure narrative_theme is always populated
    if (analysisResult.is_psyop === "Yes" || analysisResult.is_psyop === true) {
      // For PsyOps, narrative_theme is mandatory
      if (!analysisResult.narrative_theme) {
        console.warn(`⚠️ Missing narrative_theme for PsyOp post ${postId}, inferring from content...`);
        analysisResult.narrative_theme = inferNarrativeThemeFromAnalysis(analysisResult, title, contents);
      }
      
      if (!analysisResult.narrative_type) {
        console.warn(`⚠️ Missing narrative_type for PsyOp post ${postId}, defaulting to Attack`);
        analysisResult.narrative_type = 'Attack';
      }
      
      // Validate narrative_theme is from allowed list
      const validThemes = [
        'Demonization', 'Victimization', 'Heroization', 'Delegitimization',
        'Fear-Mongering', 'Divide & Conquer', 'False Flag', 'Whitewashing'
      ];
      
      if (!validThemes.includes(analysisResult.narrative_theme)) {
        console.warn(`⚠️ Invalid narrative_theme: "${analysisResult.narrative_theme}", defaulting to Demonization`);
        analysisResult.narrative_theme = 'Demonization';
      }

      console.log(`✅ Post ${postId} narrative_theme: ${analysisResult.narrative_theme}, type: ${analysisResult.narrative_type}`);
    }

    const processingTime = Date.now() - startTime;

    // Update post in Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Helper function to infer narrative theme from analysis
    function inferNarrativeThemeFromAnalysis(analysis: any, title: string, contents: string): string {
      console.log(`🔍 Inferring narrative_theme for post...`);
      
      // Check attack_vectors for clues
      const vectors = JSON.stringify(analysis.attack_vectors || []).toLowerCase();
      
      if (vectors.includes('terrorism') || vectors.includes('labeling')) {
        console.log(`  → Found terrorism/labeling vectors → Demonization`);
        return 'Demonization';
      }
      
      if (vectors.includes('legitimacy') || vectors.includes('questioning')) {
        console.log(`  → Found legitimacy/questioning vectors → Delegitimization`);
        return 'Delegitimization';
      }
      
      if (vectors.includes('sectarian') || vectors.includes('division')) {
        console.log(`  → Found sectarian/division vectors → Divide & Conquer`);
        return 'Divide & Conquer';
      }
      
      if (vectors.includes('human rights')) {
        console.log(`  → Found human rights vectors → Victimization`);
        return 'Victimization';
      }
      
      // Check psyop_type
      const psyopType = (analysis.psyop_type || '').toLowerCase();
      if (psyopType.includes('false flag')) {
        console.log(`  → PsyOp type is false flag → False Flag`);
        return 'False Flag';
      }
      
      // Check content keywords
      const fullText = (title + ' ' + contents).toLowerCase();
      
      if (fullText.match(/تروریس|terrorist|extremist|افراطی|داعش|isis/)) {
        console.log(`  → Found terrorism keywords in content → Demonization`);
        return 'Demonization';
      }
      
      if (fullText.match(/قربانی|victim|ضحیة|مظلوم/)) {
        console.log(`  → Found victimization keywords → Victimization`);
        return 'Victimization';
      }
      
      if (fullText.match(/غیرقانون|illegal|نامشروع|illegitimate/)) {
        console.log(`  → Found illegitimacy keywords → Delegitimization`);
        return 'Delegitimization';
      }
      
      if (fullText.match(/خطر|threat|تهدید|خطرناک|dangerous/)) {
        console.log(`  → Found fear keywords → Fear-Mongering`);
        return 'Fear-Mongering';
      }
      
      // Default to most common for anti-resistance PsyOps
      console.log(`  → No specific indicators, defaulting to Demonization`);
      return 'Demonization';
    }

    const { error } = await supabase
      .from("posts")
      .update({
        analysis_summary: analysisResult.summary,
        sentiment: analysisResult.sentiment,
        sentiment_score: analysisResult.sentiment_score,
        main_topic: analysisResult.main_topic,
        keywords: analysisResult.keywords,
        is_psyop: analysisResult.is_psyop === "Yes",
        psyop_confidence: analysisResult.psyop_confidence,
        target_entity: analysisResult.secondary_targets.length > 0 
          ? [analysisResult.primary_target, ...analysisResult.secondary_targets].filter(Boolean)
          : analysisResult.primary_target ? [analysisResult.primary_target] : [],
        target_persons: analysisResult.targeted_persons,
        psyop_technique: analysisResult.attack_vectors,
        narrative_theme: analysisResult.narrative_theme,  // ⚠️ NOW ALWAYS POPULATED
        psyop_type: analysisResult.psyop_type,
        threat_level: analysisResult.threat_level,
        confidence: analysisResult.psyop_confidence,
        key_points: analysisResult.counter_narrative_points,
        recommended_action: analysisResult.recommended_response,
        analyzed_at: new Date().toISOString(),
        analysis_model: "deepseek-chat",
        processing_time: processingTime / 1000,
        status: "analyzed",
        analysis_stage: "deep"  // Mark as deep analysis complete
      })
      .eq("id", postId);

    if (error) {
      console.error("Supabase update error:", error);
      throw error;
    }

    // Log API usage
    await supabase.from("api_usage_logs").insert({
      model_used: "deepseek-chat",
      input_tokens: data.usage?.prompt_tokens || 0,
      output_tokens: data.usage?.completion_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0,
      cost_usd: (data.usage?.total_tokens || 0) * 0.00000014,
      response_time_ms: processingTime,
      status: "success",
      post_id: postId
    });

    console.log(`Successfully analyzed post ${postId}`);

    return new Response(
      JSON.stringify({ success: true, analysis: analysisResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-post-deepseek:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
