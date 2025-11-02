import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch photo from Wikipedia for a given person/entity name
 */
export async function fetchPhotoFromWikipedia(name: string): Promise<string | null> {
  try {
    console.log(`🔍 Searching Wikipedia for: ${name}`);
    
    // Step 1: Search for page
    const searchUrl = `https://en.wikipedia.org/w/api.php?` + new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: name,
      format: 'json',
      origin: '*'
    });
    
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    if (!searchData.query?.search?.[0]) {
      console.log(`❌ No Wikipedia page found for: ${name}`);
      return null;
    }
    
    const pageTitle = searchData.query.search[0].title;
    console.log(`✅ Found Wikipedia page: ${pageTitle}`);
    
    // Step 2: Get page images
    const imageUrl = `https://en.wikipedia.org/w/api.php?` + new URLSearchParams({
      action: 'query',
      titles: pageTitle,
      prop: 'pageimages',
      format: 'json',
      pithumbsize: '300',
      origin: '*'
    });
    
    const imageRes = await fetch(imageUrl);
    const imageData = await imageRes.json();
    
    const pages = imageData.query?.pages;
    if (!pages) return null;
    
    const pageId = Object.keys(pages)[0];
    const thumbnail = pages[pageId]?.thumbnail?.source;
    
    if (thumbnail) {
      console.log(`📸 Found photo for ${name}:`, thumbnail);
      return thumbnail;
    }
    
    console.log(`❌ No photo found for: ${name}`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error fetching photo for ${name}:`, error);
    return null;
  }
}

/**
 * Batch fetch photos for multiple targets with progress tracking
 */
export async function fetchPhotosForTargets(
  targets: any[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    
    // Extract name from different possible formats
    let name: string;
    let namePersian: string;
    let nameEnglish: string | null = null;
    let nameArabic: string | null = null;
    
    if (typeof target === 'string') {
      // Simple string format
      name = target;
      namePersian = target;
    } else if (typeof target === 'object') {
      // Object format
      name = target.name_english || target.name_persian || target.name_arabic;
      namePersian = target.name_persian || name;
      nameEnglish = target.name_english || null;
      nameArabic = target.name_arabic || null;
    } else {
      continue;
    }
    
    if (!name) continue;
    
    if (onProgress) {
      onProgress(i + 1, targets.length);
    }
    
    // Search using the available name
    const photoUrl = await fetchPhotoFromWikipedia(name);
    
    if (photoUrl) {
      results.set(name, photoUrl);
      
      // Save to database using Persian name as the key
      try {
        // First try to find existing profile by Persian name
        const { data: existing } = await supabase
          .from('target_profiles')
          .select('id')
          .eq('name_persian', namePersian)
          .maybeSingle();
        
        if (existing) {
          // Update existing record
          await supabase
            .from('target_profiles')
            .update({
              photo_url: photoUrl,
              photo_source: 'wikipedia',
              name_english: nameEnglish || existing.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          // Insert new record - use Persian name as English if not available
          await supabase
            .from('target_profiles')
            .insert({
              name_english: nameEnglish || namePersian,
              name_persian: namePersian,
              name_arabic: nameArabic,
              photo_url: photoUrl,
              photo_source: 'wikipedia',
              position: typeof target === 'object' ? (target.position || target.role) : null,
              organization: typeof target === 'object' ? target.organization : null,
              category: typeof target === 'object' ? target.category : null
            });
        }
        
        console.log(`💾 Saved photo for ${name}`);
      } catch (error) {
        console.error(`❌ Failed to save photo for ${name}:`, error);
      }
    }
    
    // Rate limit: 1 request per second
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * Compress image file before upload
 */
export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Resize to max 300x300
        const maxSize = 300;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to compress image'));
          },
          'image/jpeg',
          0.85
        );
      };
      
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
