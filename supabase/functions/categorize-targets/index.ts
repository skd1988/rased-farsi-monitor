import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    console.log('Starting automatic target categorization...');
    
    // Get all posts with targets
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, target_persons, target_entity')
      .eq('is_psyop', true)
      .not('target_persons', 'is', null);
    
    if (error) throw error;
    
    console.log(`Found ${posts?.length || 0} posts to categorize`);
    
    let updated = 0;
    let alreadyCategorized = 0;
    
    for (const post of posts || []) {
      let needsUpdate = false;
      let updatedTargets = post.target_persons;
      
      // Check if target_persons is array
      if (Array.isArray(updatedTargets)) {
        updatedTargets = updatedTargets.map((target: any) => {
          // If it's a string, convert to object and categorize
          if (typeof target === 'string') {
            needsUpdate = true;
            return categorizeTarget({ name_persian: target });
          } 
          // If it's an object but missing category or has default category
          else if (!target.category || target.category === 'همه' || target.category === 'نامشخص') {
            needsUpdate = true;
            return categorizeTarget(target);
          }
          // Already properly categorized
          else {
            alreadyCategorized++;
            return target;
          }
        });
        
        // Update post if needed
        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('posts')
            .update({ target_persons: updatedTargets })
            .eq('id', post.id);
          
          if (updateError) {
            console.error(`Failed to update post ${post.id}:`, updateError);
          } else {
            updated++;
            console.log(`✅ Categorized targets in post ${post.id}`);
          }
        }
      }
    }
    
    console.log(`Categorization complete: ${updated} updated, ${alreadyCategorized} already categorized`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        updated,
        alreadyCategorized,
        total: posts?.length || 0,
        message: `Successfully categorized ${updated} posts. ${alreadyCategorized} targets were already categorized.` 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
    
  } catch (error) {
    console.error('Categorization error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

function categorizeTarget(target: any): any {
  const name = (target.name_english || target.name_persian || '').toLowerCase();
  const position = (target.position || '').toLowerCase();
  const org = (target.organization || '').toLowerCase();
  
  // Resistance Leaders Database (کلیدی‌ترین افراد محور مقاومت)
  const resistanceLeaders: Record<string, any> = {
    // Hezbollah Lebanon
    'hassan nasrallah': { category: 'رهبر سیاسی', position: 'دبیرکل', org: 'حزب‌الله لبنان', country: 'Lebanon' },
    'نصرالله': { category: 'رهبر سیاسی', position: 'دبیرکل', org: 'حزب‌الله لبنان', country: 'Lebanon' },
    'naim qassem': { category: 'رهبر سیاسی', position: 'معاون دبیرکل', org: 'حزب‌الله لبنان', country: 'Lebanon' },
    'نعیم قاسم': { category: 'رهبر سیاسی', position: 'معاون دبیرکل', org: 'حزب‌الله لبنان', country: 'Lebanon' },
    'muhammad afif': { category: 'سخنگو', position: 'مسئول روابط رسانه‌ای', org: 'حزب‌الله لبنان', country: 'Lebanon' },
    'محمد عفیف': { category: 'سخنگو', position: 'مسئول روابط رسانه‌ای', org: 'حزب‌الله لبنان', country: 'Lebanon' },
    'hashem safieddine': { category: 'رهبر سیاسی', position: 'رئیس شورای اجرایی', org: 'حزب‌الله لبنان', country: 'Lebanon' },
    'هاشم صفی‌الدین': { category: 'رهبر سیاسی', position: 'رئیس شورای اجرایی', org: 'حزب‌الله لبنان', country: 'Lebanon' },
    
    // Hamas Palestine
    'ismail haniyeh': { category: 'رهبر سیاسی', position: 'رئیس دفتر سیاسی', org: 'حماس', country: 'Palestine' },
    'اسماعیل هنیه': { category: 'رهبر سیاسی', position: 'رئیس دفتر سیاسی', org: 'حماس', country: 'Palestine' },
    'yahya sinwar': { category: 'رهبر سیاسی', position: 'رهبر حماس در غزه', org: 'حماس', country: 'Palestine' },
    'یحیی سنوار': { category: 'رهبر سیاسی', position: 'رهبر حماس در غزه', org: 'حماس', country: 'Palestine' },
    'mohammed deif': { category: 'فرمانده نظامی', position: 'فرمانده بال نظامی', org: 'حماس', country: 'Palestine' },
    'محمد ضیف': { category: 'فرمانده نظامی', position: 'فرمانده بال نظامی', org: 'حماس', country: 'Palestine' },
    
    // Ansarallah Yemen  
    'abdul-malik al-houthi': { category: 'رهبر سیاسی', position: 'رهبر', org: 'انصارالله', country: 'Yemen' },
    'عبدالملک الحوثی': { category: 'رهبر سیاسی', position: 'رهبر', org: 'انصارالله', country: 'Yemen' },
    'mohammed ali al-houthi': { category: 'رهبر سیاسی', position: 'رئیس کمیته انقلابی', org: 'انصارالله', country: 'Yemen' },
    'محمد علی الحوثی': { category: 'رهبر سیاسی', position: 'رئیس کمیته انقلابی', org: 'انصارالله', country: 'Yemen' },
    
    // PMF Iraq
    'abu mahdi al-muhandis': { category: 'فرمانده نظامی', position: 'معاون فرمانده', org: 'حشدالشعبی عراق', country: 'Iraq' },
    'ابومهدی المهندس': { category: 'فرمانده نظامی', position: 'معاون فرمانده', org: 'حشدالشعبی عراق', country: 'Iraq' },
    'qais al-khazali': { category: 'رهبر سیاسی', position: 'رهبر عصائب اهل الحق', org: 'حشدالشعبی عراق', country: 'Iraq' },
    'قیس الخزعلی': { category: 'رهبر سیاسی', position: 'رهبر عصائب اهل الحق', org: 'حشدالشعبی عراق', country: 'Iraq' },
    
    // Iran
    'qasem soleimani': { category: 'فرمانده نظامی', position: 'فرمانده نیروی قدس سپاه', org: 'سپاه پاسداران', country: 'Iran' },
    'قاسم سلیمانی': { category: 'فرمانده نظامی', position: 'فرمانده نیروی قدس سپاه', org: 'سپاه پاسداران', country: 'Iran' },
    'ali khamenei': { category: 'مرجع دینی', position: 'رهبر معظم انقلاب', org: 'جمهوری اسلامی ایران', country: 'Iran' },
    'علی خامنه‌ای': { category: 'مرجع دینی', position: 'رهبر معظم انقلاب', org: 'جمهوری اسلامی ایران', country: 'Iran' },
    'esmail ghaani': { category: 'فرمانده نظامی', position: 'فرمانده نیروی قدس سپاه', org: 'سپاه پاسداران', country: 'Iran' },
    'اسماعیل قاآنی': { category: 'فرمانده نظامی', position: 'فرمانده نیروی قدس سپاه', org: 'سپاه پاسداران', country: 'Iran' }
  };
  
  // Check known leaders first
  for (const [knownName, info] of Object.entries(resistanceLeaders)) {
    if (name.includes(knownName) || knownName.includes(name)) {
      return {
        ...target,
        position: info.position,
        organization: info.org,
        country: info.country,
        category: info.category,
        side: 'Resistance',
        entity_type: 'Individual'
      };
    }
  }
  
  // Pattern-based categorization
  
  // Political Leaders
  if (position.match(/leader|secretary|chief|president|chairman|head|رهبر|دبیرکل|رئیس/i) ||
      name.match(/sayyed|sayyid|سید/)) {
    return {
      ...target,
      category: 'رهبر سیاسی',
      side: target.side || 'Resistance',
      entity_type: 'Individual'
    };
  }
  
  // Military Commanders
  if (position.match(/commander|general|colonel|military|قائد|فرمانده|سردار/i) ||
      name.match(/commander|general|سردار/i)) {
    return {
      ...target,
      category: 'فرمانده نظامی',
      side: target.side || 'Resistance',
      entity_type: 'Individual'
    };
  }
  
  // Religious Authorities
  if (position.match(/ayatollah|sheikh|cleric|scholar|مرجع|آیت‌الله|شیخ/i) ||
      name.match(/ayatollah|sheikh|آیت‌الله/i)) {
    return {
      ...target,
      category: 'مرجع دینی',
      side: target.side || 'Resistance',
      entity_type: 'Individual'
    };
  }
  
  // Spokespersons
  if (position.match(/spokesperson|spokesman|media|press|سخنگو|معاون اطلاع/i)) {
    return {
      ...target,
      category: 'سخنگو',
      side: target.side || 'Resistance',
      entity_type: 'Individual'
    };
  }
  
  // Activists
  if (position.match(/journalist|writer|blogger|activist|فعال|روزنامه‌نگار|نویسنده/i)) {
    return {
      ...target,
      category: 'فعال',
      side: target.side || 'Resistance',
      entity_type: 'Individual'
    };
  }
  
  // Organizations
  const organizations = [
    'hezbollah', 'حزب الله', 'حزب‌الله',
    'hamas', 'حماس',
    'ansarallah', 'انصارالله', 'انصار الله',
    'pmf', 'حشد', 'حشدالشعبی',
    'islamic jihad', 'جهاد اسلامی'
  ];
  
  if (organizations.some(orgName => name.includes(orgName) || org.includes(orgName))) {
    return {
      ...target,
      category: 'سازمان',
      side: target.side || 'Resistance',
      entity_type: 'Organization'
    };
  }
  
  // Default fallback - keep as is but ensure required fields
  return {
    ...target,
    category: target.category || 'همه',
    side: target.side || 'Resistance',
    entity_type: target.entity_type || 'Individual'
  };
}
