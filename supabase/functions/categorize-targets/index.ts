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
    
    console.log('Starting automatic target categorization & cleanup...');
    
    // Get all posts with targets
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, target_persons, target_entity')
      .eq('is_psyop', true);
    
    if (error) throw error;
    
    console.log(`Found ${posts?.length || 0} posts to process`);
    
    let updated = 0;
    let cleaned = 0;
    
    for (const post of posts || []) {
      let needsUpdate = false;
      let cleanedPersons: string[] = [];
      let cleanedEntities: string[] = [];
      
      // Clean up target_persons - extract only Persian names
      if (Array.isArray(post.target_persons) && post.target_persons.length > 0) {
        for (const target of post.target_persons) {
          const name = extractPersonName(target);
          if (name && name !== 'نامشخص' && name !== 'Unknown') {
            cleanedPersons.push(name);
            
            // Also ensure person exists in resistance_persons
            await ensurePersonExists(supabase, name);
          }
        }
        
        if (cleanedPersons.length !== post.target_persons.length) {
          needsUpdate = true;
          cleaned++;
        }
      }
      
      // Clean up target_entity - extract only Persian names
      if (Array.isArray(post.target_entity) && post.target_entity.length > 0) {
        for (const entity of post.target_entity) {
          const name = extractEntityName(entity);
          if (name && name !== 'نامشخص' && name !== 'Unknown') {
            cleanedEntities.push(name);
          }
        }
      }
      
      // Update post if needed
      if (needsUpdate || cleanedPersons.length > 0 || cleanedEntities.length > 0) {
        const updateData: any = {};
        
        if (cleanedPersons.length > 0) {
          updateData.target_persons = cleanedPersons;
        }
        
        if (cleanedEntities.length > 0) {
          updateData.target_entity = cleanedEntities;
        }
        
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('posts')
            .update(updateData)
            .eq('id', post.id);
          
          if (updateError) {
            console.error(`Failed to update post ${post.id}:`, updateError);
          } else {
            updated++;
            console.log(`✅ Cleaned targets in post ${post.id}`);
          }
        }
      }
    }
    
    console.log(`Cleanup complete: ${updated} updated, ${cleaned} cleaned from nested JSON`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        updated,
        cleaned,
        total: posts?.length || 0,
        message: `Successfully cleaned ${updated} posts. ${cleaned} had nested JSON data.` 
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

// Extract person name from any format (string, object, or nested JSON)
function extractPersonName(data: any): string {
  // If it's already a plain string, return it
  if (typeof data === 'string') {
    // Try to parse if it's JSON
    try {
      const parsed = JSON.parse(data);
      return extractPersonName(parsed); // Recursively extract
    } catch {
      // Not JSON, return as-is if it looks like a name
      if (data.length > 0 && data.length < 200 && !data.includes('{')) {
        return data.trim();
      }
      return '';
    }
  }
  
  // If it's an object, extract name_persian
  if (typeof data === 'object' && data !== null) {
    if (typeof data.name_persian === 'string') {
      // Check if name_persian itself is stringified JSON
      if (data.name_persian.startsWith('{')) {
        try {
          const parsed = JSON.parse(data.name_persian);
          return extractPersonName(parsed);
        } catch {
          return data.name_persian.trim();
        }
      }
      return data.name_persian.trim();
    }
    
    // Fallback to name_english or name_arabic
    if (typeof data.name_english === 'string' && data.name_english.length > 0) {
      return data.name_english.trim();
    }
    
    if (typeof data.name_arabic === 'string' && data.name_arabic.length > 0) {
      return data.name_arabic.trim();
    }
  }
  
  return '';
}

// Extract entity name from any format
function extractEntityName(data: any): string {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return extractEntityName(parsed);
    } catch {
      if (data.length > 0 && data.length < 200 && !data.includes('{')) {
        return data.trim();
      }
      return '';
    }
  }
  
  if (typeof data === 'object' && data !== null) {
    if (typeof data.name_persian === 'string') {
      if (data.name_persian.startsWith('{')) {
        try {
          const parsed = JSON.parse(data.name_persian);
          return extractEntityName(parsed);
        } catch {
          return data.name_persian.trim();
        }
      }
      return data.name_persian.trim();
    }
    
    if (typeof data.name_english === 'string' && data.name_english.length > 0) {
      return data.name_english.trim();
    }
  }
  
  return '';
}

// Ensure person exists in resistance_persons table
async function ensurePersonExists(supabase: any, namePersian: string) {
  // Check if person already exists
  const { data: existing } = await supabase
    .from('resistance_persons')
    .select('id')
    .eq('name_persian', namePersian)
    .maybeSingle();
  
  // If doesn't exist, create it
  if (!existing) {
    const category = categorizePersonByName(namePersian);
    
    await supabase
      .from('resistance_persons')
      .insert({
        name_persian: namePersian,
        role: category,
        active: true
      });
    
    console.log(`📝 Created resistance_persons entry for: ${namePersian}`);
  }
}

// Categorize person by name patterns
function categorizePersonByName(name: string): string {
  const lowerName = name.toLowerCase();
  
  // Known leaders
  const knownLeaders: Record<string, string> = {
    'نصرالله': 'رهبر سیاسی',
    'نعیم قاسم': 'رهبر سیاسی',
    'سید حسن نصرالله': 'رهبر سیاسی',
    'عبدالملک الحوثی': 'رهبر سیاسی',
    'یحیی سنوار': 'رهبر سیاسی',
    'اسماعیل هنیه': 'رهبر سیاسی',
    'قاسم سلیمانی': 'فرمانده نظامی',
    'اسماعیل قاآنی': 'فرمانده نظامی',
    'محمد ضیف': 'فرمانده نظامی',
    'ابومهدی المهندس': 'فرمانده نظامی',
    'علی خامنه‌ای': 'مرجع دینی'
  };
  
  for (const [knownName, category] of Object.entries(knownLeaders)) {
    if (lowerName.includes(knownName.toLowerCase())) {
      return category;
    }
  }
  
  // Pattern-based
  if (lowerName.includes('فرمانده') || lowerName.includes('سردار') || lowerName.includes('قائد')) {
    return 'فرمانده نظامی';
  }
  
  if (lowerName.includes('سید') || lowerName.includes('آیت‌الله') || lowerName.includes('شیخ')) {
    return 'مرجع دینی';
  }
  
  if (lowerName.includes('سخنگو') || lowerName.includes('معاون اطلاع')) {
    return 'سخنگو';
  }
  
  if (lowerName.includes('دبیرکل') || lowerName.includes('رهبر') || lowerName.includes('رئیس')) {
    return 'رهبر سیاسی';
  }
  
  return 'همه';
}
