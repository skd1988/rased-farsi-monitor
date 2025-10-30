import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download, CheckCircle, XCircle } from 'lucide-react';
import Papa from 'papaparse';

// Helper functions
function deriveSourceFromURL(url: string): string {
  if (!url) return 'نامشخص';
  
  const urlLower = url.toLowerCase();
  
  // Social Media Platforms
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'YouTube';
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.com') || urlLower.includes('fb.watch')) return 'Facebook';
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'Twitter';
  if (urlLower.includes('t.me') || urlLower.includes('telegram')) return 'Telegram';
  if (urlLower.includes('instagram.com')) return 'Instagram';
  if (urlLower.includes('tiktok.com')) return 'TikTok';
  if (urlLower.includes('linkedin.com')) return 'LinkedIn';
  
  // Arabic News Websites
  if (urlLower.includes('aljazeera.')) return 'الجزيرة';
  if (urlLower.includes('alarabiya.')) return 'العربية';
  if (urlLower.includes('france24.com/ar')) return 'فرانس 24';
  if (urlLower.includes('bbc.com/arabic')) return 'بي بي سي عربي';
  if (urlLower.includes('rt.com/arabic')) return 'آر تي عربي';
  if (urlLower.includes('dostor.org')) return 'الدستور';
  if (urlLower.includes('nna-leb.gov')) return 'الوكالة الوطنية للإعلام';
  if (urlLower.includes('almanar.com')) return 'المنار';
  if (urlLower.includes('963media.com')) return '963 ميديا';
  if (urlLower.includes('independentarabia.com')) return 'اندبندنت عربية';
  if (urlLower.includes('7al.net')) return '7al';
  if (urlLower.includes('shorouknews.com')) return 'الشروق';
  if (urlLower.includes('imlebanon.org')) return 'آي ام لبنان';
  if (urlLower.includes('nile.eg')) return 'النيل للأخبار';
  if (urlLower.includes('noonpost.com')) return 'نون بوست';
  if (urlLower.includes('lebanondebate.com')) return 'لبنان ديبيت';
  if (urlLower.includes('viory.video')) return 'فيوري فيديو';
  if (urlLower.includes('arabwindow.net')) return 'نافذة عربية';
  if (urlLower.includes('sarabic.ae')) return 'سرابيك';
  if (urlLower.includes('aawsat.com')) return 'الشرق الأوسط';
  if (urlLower.includes('skynewsarabia.com')) return 'سكاي نيوز عربية';
  if (urlLower.includes('enabbaladi.net')) return 'عنب بلدي';
  if (urlLower.includes('albawabhnews.com')) return 'البوابة نيوز';
  if (urlLower.includes('dijlah.tv')) return 'قناة دجلة';
  if (urlLower.includes('masrawy.com')) return 'مصراوي';
  if (urlLower.includes('jadidouna.com')) return 'جديدونا';
  
  // Persian News
  if (urlLower.includes('isna.ir')) return 'ایسنا';
  if (urlLower.includes('mehrnews.com')) return 'مهر';
  if (urlLower.includes('tasnimnews.com')) return 'تسنیم';
  if (urlLower.includes('farsnews.ir')) return 'فارس';
  if (urlLower.includes('irna.ir')) return 'ایرنا';
  if (urlLower.includes('bbc.com/persian')) return 'بی‌بی‌سی فارسی';
  
  // English News
  if (urlLower.includes('cnn.com')) return 'CNN';
  if (urlLower.includes('bbc.com') || urlLower.includes('bbc.co.uk')) return 'BBC';
  if (urlLower.includes('reuters.com')) return 'Reuters';
  if (urlLower.includes('apnews.com')) return 'AP News';
  
  // Fallback: extract domain
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const domain = hostname.split('.')[0];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return 'نامشخص';
  }
}

function detectLanguage(text: string): string {
  if (!text) return 'عربی';
  if (/[پچژگ]/.test(text)) return 'فارسی';
  if (/[\u0600-\u06FF]/.test(text)) return 'عربی';
  return 'English';
}

function extractKeywords(text: string): string[] {
  if (!text) return [];
  const keywords = [
    'جنگ روانی', 'محور مقاومت', 'اتهام', 'شبهه', 'کمپین',
    'حرب نفسية', 'محور المقاومة', 'اتهامات', 'شبهات', 'حملة'
  ];
  return keywords.filter(kw => text.includes(kw));
}

function cleanHTMLContent(content: string): string {
  if (!content) return '';
  
  let cleaned = content;
  
  // 1. Remove script and style tags with their contents
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // 2. Strip ALL HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  
  // 3. Decode HTML entities
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&quot;': '"',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&apos;': "'",
    '&#39;': "'",
    '&#x27;': "'",
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…'
  };
  
  Object.entries(entities).forEach(([entity, char]) => {
    cleaned = cleaned.replace(new RegExp(entity, 'g'), char);
  });
  
  // Decode numeric entities
  cleaned = cleaned.replace(/&#x([0-9A-F]+);/gi, (match, hex) => 
    String.fromCharCode(parseInt(hex, 16))
  );
  cleaned = cleaned.replace(/&#(\d+);/g, (match, dec) => 
    String.fromCharCode(parseInt(dec, 10))
  );
  
  // 4. Remove URLs from text
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
  
  // 5. Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/\n\s*\n/g, '\n\n');
  
  // 6. Trim
  cleaned = cleaned.trim();
  
  return cleaned;
}

function parseDate(dateString: string | undefined): string {
  if (!dateString) return new Date().toISOString();
  try {
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch {}
  return new Date().toISOString();
}

const Settings = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();

  const SHEET_ID = '11VzLIg5-evMkdGBUPzFgGXiv6nTgEL4r1wc4FDn2TKQ';
  const SHEET_NAME = 'Sheet1';

const importFromGoogleSheets = async () => {
    const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}`;
    
    console.log('=== STARTING GOOGLE SHEETS IMPORT (8-COLUMN FORMAT) ===');
    console.log('Fetching from URL:', CSV_URL);
    
    try {
      const response = await fetch(CSV_URL);
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('دسترسی به Google Sheet رد شد. لطفاً Sheet را Public کنید (Anyone with link can view).');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const csvText = await response.text();
      
      console.log('CSV received, length:', csvText.length);
      console.log('First 500 chars:', csvText.substring(0, 500));
      
      // Check if it's actually CSV
      if (!csvText.includes(',') && !csvText.includes('\n')) {
        throw new Error('Response is not valid CSV format. Make sure the sheet is public.');
      }
      
      // Parse CSV WITH headers (8-column format)
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim()
      });
      
      console.log('Headers:', parsed.meta.fields);
      console.log('Parsed data:', parsed.data.length, 'rows');
      
      if (parsed.errors.length > 0) {
        console.warn('CSV parsing warnings:', parsed.errors);
      }
      
      if (parsed.data.length === 0) {
        throw new Error('No data found in sheet. Make sure the sheet has data and is public.');
      }
      
      setProgress({ current: 0, total: parsed.data.length });
      
      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];
      
      // Process each row
      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i] as any;
        
        try {
          // Read all 8 columns
          const date = row['Date'];
          const title = row['Title'];
          const contents = row['Contents'];
          const sourceColumn = row['Source']; // ❌ IGNORE - has author names!
          const articleUrl = row['Article URL'];
          const language = row['Language'];
          const status = row['Status'];
          const keywords = row['Keywords'];
          
          if (!articleUrl) {
            console.warn(`Row ${i + 1}: Missing URL, skipping`);
            skippedCount++;
            continue;
          }
          
          console.log(`\n--- Row ${i + 1}/${parsed.data.length} ---`);
          console.log('Article URL:', articleUrl);
          
          // ✅ DEEP CLEAN: Title
          const cleanTitle = cleanHTMLContent(title || '');
          const finalTitle = cleanTitle.substring(0, 200) || 'بدون عنوان';
          
          // ✅ DEEP CLEAN: Contents
          const cleanContents = cleanHTMLContent(contents || '');
          
          // ✅ DERIVE SOURCE FROM URL (ignore Source column!)
          const realSource = deriveSourceFromURL(articleUrl);
          
          // ✅ USE PROVIDED DATA (with fallbacks)
          const finalLanguage = language && language.trim() 
            ? language.trim() 
            : detectLanguage(cleanContents || cleanTitle);
          
          const finalStatus = status && status.trim() 
            ? status.trim() 
            : 'جدید';
          
          // ✅ PARSE KEYWORDS (comma-separated or auto-extract)
          let keywordsArray: string[] = [];
          if (keywords && keywords.trim()) {
            keywordsArray = keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k);
          }
          if (keywordsArray.length === 0) {
            keywordsArray = extractKeywords(cleanContents || cleanTitle);
          }
          
          console.log('Title:', finalTitle.substring(0, 50));
          console.log('Source (derived):', realSource);
          console.log('Author (from sheet):', sourceColumn);
          console.log('Language:', finalLanguage);
          console.log('Status:', finalStatus);
          console.log('Keywords:', keywordsArray);
          
          const postData = {
            title: finalTitle,
            contents: cleanContents,
            author: sourceColumn || 'نامشخص', // ✅ Use Source column as Author (has author names)
            article_url: articleUrl.trim(),
            source: realSource, // ✅ SMART: Derived from URL!
            source_url: articleUrl.trim(),
            language: finalLanguage,
            status: finalStatus,
            keywords: keywordsArray,
            published_at: parseDate(date)
          };
          
          // Check if post already exists (by URL to avoid duplicates)
          const { data: existing } = await supabase
            .from('posts')
            .select('id')
            .eq('article_url', articleUrl.trim())
            .maybeSingle();
          
          if (existing) {
            console.log(`Row ${i + 1}: Post exists, updating...`);
            const { error } = await supabase
              .from('posts')
              .update(postData)
              .eq('id', existing.id);
            
            if (error) throw error;
            updatedCount++;
            console.log(`Row ${i + 1}: ✅ Updated`);
          } else {
            console.log(`Row ${i + 1}: Creating new post...`);
            const { error } = await supabase
              .from('posts')
              .insert(postData);
            
            if (error) throw error;
            newCount++;
            console.log(`Row ${i + 1}: ✅ Inserted`);
          }
          
        } catch (rowError) {
          console.error(`❌ Error processing row ${i + 1}:`, rowError);
          errors.push(`Row ${i + 1}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
          skippedCount++;
        }
        
        setProgress({ current: i + 1, total: parsed.data.length });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      console.log('\n=== IMPORT COMPLETE ===');
      console.log('New posts:', newCount);
      console.log('Updated posts:', updatedCount);
      console.log('Skipped/errors:', skippedCount);
      if (errors.length > 0) {
        console.log('Errors:', errors);
      }
      
      return { newCount, updatedCount, skippedCount, total: parsed.data.length, errors };
      
    } catch (error) {
      console.error('❌ Import failed:', error);
      throw error;
    }
  };

  const handleImport = async () => {
    console.log('=== IMPORT BUTTON CLICKED ===');
    setIsImporting(true);
    setImportStatus(null);
    
    try {
      const result = await importFromGoogleSheets();
      
      let message = `✅ موفق! ${result.newCount} مطلب جدید، ${result.updatedCount} مطلب به‌روزرسانی شد`;
      if (result.skippedCount > 0) {
        message += `، ${result.skippedCount} مطلب رد شد`;
      }
      
      const details = result.errors && result.errors.length > 0 
        ? `Errors:\n${result.errors.join('\n')}`
        : undefined;
      
      setImportStatus({
        success: true,
        message: message,
        details: details
      });
      
      setLastSyncTime(new Date().toISOString());
      
      toast({
        title: 'Import موفق',
        description: message,
      });
      
      console.log('=== IMPORT SUCCESS - Reloading in 2 seconds ===');
      
      // Refresh data after 2 seconds
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
      
    } catch (error) {
      console.error('=== IMPORT ERROR ===');
      console.error(error);
      
      const errorMessage = error instanceof Error ? error.message : 'خطای نامشخص';
      const errorDetails = error instanceof Error && error.stack ? error.stack : undefined;
      
      setImportStatus({
        success: false,
        message: `❌ خطا: ${errorMessage}`,
        details: errorDetails
      });
      
      toast({
        title: 'خطا در Import',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-8 space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold">تنظیمات</h1>
        <p className="text-muted-foreground mt-2">مدیریت اتصالات و تنظیمات سیستم</p>
      </div>

      {/* Data Management Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🗑️ مدیریت داده‌ها
          </CardTitle>
          <CardDescription>
            پاک کردن داده‌های آزمایشی و تست
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={async () => {
              if (!confirm('⚠️ آیا مطمئن هستید؟ تمام داده‌های آزمایشی (با آدرس example.com) حذف می‌شوند.')) return;
              
              try {
                const { error } = await supabase
                  .from('posts')
                  .delete()
                  .like('article_url', '%example.com%');
                
                if (error) throw error;
                
                toast({
                  title: "✅ موفق!",
                  description: "داده‌های آزمایشی حذف شدند.",
                });
                
                setTimeout(() => {
                  window.location.reload();
                }, 1000);
              } catch (error: any) {
                toast({
                  title: "❌ خطا",
                  description: error.message,
                  variant: "destructive",
                });
              }
            }}
            variant="destructive"
            size="lg"
            className="w-full"
          >
            🗑️ پاک کردن داده‌های آزمایشی
          </Button>
        </CardContent>
      </Card>

      {/* Google Sheets Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            اتصال به Google Sheets
          </CardTitle>
          <CardDescription>
            Import و همگام‌سازی داده‌ها از Google Sheets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sheet Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sheet ID</Label>
              <Input 
                value={SHEET_ID}
                disabled
                className="bg-muted font-mono text-xs"
              />
            </div>
            
            <div className="space-y-2">
              <Label>نام Sheet</Label>
              <Input 
                value={SHEET_NAME}
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          {/* Import Button */}
          <Button
            onClick={handleImport}
            disabled={isImporting}
            size="lg"
            className="w-full"
          >
            {isImporting ? (
              <>
                <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                در حال Import... ({progress.current}/{progress.total})
              </>
            ) : (
              <>
                <Download className="ml-2 h-5 w-5" />
                Import از Google Sheets
              </>
            )}
          </Button>

          {/* Last Sync Time */}
          {lastSyncTime && (
            <p className="text-sm text-muted-foreground text-center">
              آخرین همگام‌سازی: {new Date(lastSyncTime).toLocaleString('fa-IR')}
            </p>
          )}

          {/* Import Status */}
          {importStatus && (
            <div
              className={`p-4 rounded-lg border-2 ${
                importStatus.success
                  ? 'bg-green-50 text-green-800 border-green-500'
                  : 'bg-red-50 text-red-800 border-red-500'
              }`}
            >
              <div className="flex items-start gap-3">
                {importStatus.success ? (
                  <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-bold">{importStatus.message}</p>
                  {importStatus.details && (
                    <pre className="text-xs mt-2 overflow-auto bg-white/50 p-2 rounded border max-h-40">
                      {importStatus.details}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold text-blue-900">📋 فرمت Google Sheet (8 ستون):</p>
            <ul className="list-disc list-inside text-blue-800 space-y-1 mr-4">
              <li>ستون 1: Date - تاریخ انتشار</li>
              <li>ستون 2: Title - عنوان (ممکن است HTML داشته باشد)</li>
              <li>ستون 3: Contents - محتوا (ممکن است HTML داشته باشد)</li>
              <li>ستون 4: Source - نام نویسنده (به عنوان Author استفاده می‌شود)</li>
              <li>ستون 5: Article URL - لینک کامل مطلب</li>
              <li>ستون 6: Language - زبان (فارسی، عربی، English)</li>
              <li>ستون 7: Status - وضعیت (جدید، در حال بررسی، و...)</li>
              <li>ستون 8: Keywords - کلمات کلیدی (با کاما جدا شده)</li>
            </ul>
            <p className="text-blue-700 mt-2">
              ✅ سیستم به صورت خودکار:
            </p>
            <ul className="list-disc list-inside text-blue-700 space-y-1 mr-4">
              <li>تمام تگ‌های HTML را از عنوان و محتوا پاک می‌کند</li>
              <li>منبع واقعی را از URL تشخیص می‌دهد (YouTube، الجزيرة، Facebook، و...)</li>
              <li>ستون Source را به عنوان Author ذخیره می‌کند</li>
              <li>در صورت خالی بودن، زبان و کلمات کلیدی را شناسایی می‌کند</li>
              <li>از داده‌های ارائه شده در Sheet استفاده می‌کند</li>
              <li>منابع را با نقشه جامع 40+ منبع تشخیص می‌دهد</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
