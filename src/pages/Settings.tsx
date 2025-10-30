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
  
  // Social Media
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'YouTube';
  if (urlLower.includes('facebook.com')) return 'Facebook';
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'Twitter';
  if (urlLower.includes('t.me')) return 'Telegram';
  if (urlLower.includes('instagram.com')) return 'Instagram';
  
  // News websites
  if (urlLower.includes('aljazeera.')) return 'الجزيرة';
  if (urlLower.includes('alarabiya.')) return 'العربية';
  if (urlLower.includes('france24.')) return 'فرانس 24';
  if (urlLower.includes('bbc.')) return 'BBC';
  if (urlLower.includes('dostor.org')) return 'الدستور';
  if (urlLower.includes('nna-leb.gov')) return 'الوكالة الوطنية';
  if (urlLower.includes('almanar.com')) return 'المنار';
  if (urlLower.includes('963media.')) return '963 ميديا';
  if (urlLower.includes('independentarabia.')) return 'اندبندنت عربية';
  if (urlLower.includes('7al.net')) return '7al';
  if (urlLower.includes('shorouknews.')) return 'الشروق';
  if (urlLower.includes('imlebanon.')) return 'IMLeb';
  if (urlLower.includes('nile.eg')) return 'النيل';
  if (urlLower.includes('noonpost.')) return 'نون بوست';
  if (urlLower.includes('lebanondebate.')) return 'لبنان ديبيت';
  if (urlLower.includes('viory.')) return 'فيوري';
  if (urlLower.includes('arabwindow.')) return 'نافذة عربية';
  if (urlLower.includes('sarabic.')) return 'سرابيك';
  
  // Fallback
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return hostname.split('.')[0];
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
  
  // Strip ALL HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');
  
  // Decode HTML entities
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&#x([0-9A-F]+);/gi, (m, p1) => 
    String.fromCharCode(parseInt(p1, 16))
  );
  cleaned = cleaned.replace(/&#(\d+);/g, (m, p1) => 
    String.fromCharCode(parseInt(p1, 10))
  );
  
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
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
    
    console.log('=== STARTING GOOGLE SHEETS IMPORT (2-COLUMN FORMAT) ===');
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
      
      // Parse CSV WITHOUT headers (2-column format)
      const parsed = Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true
      });
      
      console.log('Parsed data:', parsed.data.length, 'rows');
      
      if (parsed.errors.length > 0) {
        console.warn('CSV parsing warnings:', parsed.errors);
      }
      
      if (parsed.data.length === 0) {
        throw new Error('No data found in sheet. Make sure the sheet has data and is public.');
      }
      
      const rows = parsed.data as any[];
      setProgress({ current: 0, total: rows.length });
      
      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];
      
      // Process each row (skip header row)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        try {
          if (!row || row.length < 2) {
            console.warn(`Row ${i}: Missing columns, skipping`);
            skippedCount++;
            continue;
          }
          
          const mixedContent = row[0]; // Column A: Date + HTML content mixed
          const articleUrl = row[1];   // Column B: URL
          
          if (!mixedContent || !articleUrl) {
            console.warn(`Row ${i}: Missing content or URL, skipping`);
            skippedCount++;
            continue;
          }
          
          console.log(`\n--- Row ${i}/${rows.length} ---`);
          console.log('Article URL:', articleUrl);
          
          // ✅ EXTRACT DATE from beginning
          const dateMatch = mixedContent.match(/^(\w+\s+\d+,\s+\d+\s+at\s+\d+:\d+)/);
          const dateStr = dateMatch ? dateMatch[1] : null;
          
          // ✅ CLEAN the content (remove ALL HTML)
          let cleanContent = mixedContent;
          
          // Remove date prefix
          if (dateStr) {
            cleanContent = cleanContent.replace(dateStr, '').trim();
          }
          
          // Clean HTML tags and entities
          cleanContent = cleanHTMLContent(cleanContent);
          
          if (!cleanContent || cleanContent.length < 10) {
            console.warn(`Row ${i}: Content too short after cleaning, skipping`);
            skippedCount++;
            continue;
          }
          
          // ✅ EXTRACT TITLE (first 100 chars of clean content as title)
          const title = cleanContent.substring(0, 100).trim() || 'بدون عنوان';
          
          // ✅ FULL CONTENTS (all clean text)
          const contents = cleanContent;
          
          // ✅ DERIVE SOURCE from URL
          const source = deriveSourceFromURL(articleUrl);
          
          // ✅ DETECT LANGUAGE
          const language = detectLanguage(cleanContent);
          
          // ✅ EXTRACT KEYWORDS
          const keywords = extractKeywords(cleanContent);
          
          console.log('Title:', title);
          console.log('Source:', source);
          console.log('Language:', language);
          console.log('Keywords:', keywords);
          
          const postData = {
            title: title,
            contents: contents,
            author: 'نامشخص',
            article_url: articleUrl.trim(),
            source: source,
            source_url: articleUrl.trim(),
            language: language,
            status: 'جدید',
            keywords: keywords,
            published_at: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString()
          };
          
          // Check if post already exists (by URL to avoid duplicates)
          const { data: existing } = await supabase
            .from('posts')
            .select('id')
            .eq('article_url', articleUrl.trim())
            .maybeSingle();
          
          if (existing) {
            console.log(`Row ${i}: Post exists, updating...`);
            const { error } = await supabase
              .from('posts')
              .update(postData)
              .eq('id', existing.id);
            
            if (error) throw error;
            updatedCount++;
            console.log(`Row ${i}: ✅ Updated`);
          } else {
            console.log(`Row ${i}: Creating new post...`);
            const { error } = await supabase
              .from('posts')
              .insert(postData);
            
            if (error) throw error;
            newCount++;
            console.log(`Row ${i}: ✅ Inserted`);
          }
          
        } catch (rowError) {
          console.error(`❌ Error processing row ${i}:`, rowError);
          errors.push(`Row ${i}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
          skippedCount++;
        }
        
        setProgress({ current: i + 1, total: rows.length });
        
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
      
      return { newCount, updatedCount, skippedCount, total: rows.length - 1, errors };
      
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
            <p className="font-semibold text-blue-900">📋 فرمت Google Sheet (2 ستون):</p>
            <ul className="list-disc list-inside text-blue-800 space-y-1 mr-4">
              <li>ستون A - محتوای ترکیبی: تاریخ + محتوای HTML در یک سلول</li>
              <li>ستون B - لینک مطلب: URL کامل مطلب</li>
            </ul>
            <p className="text-blue-700 mt-2">
              ✅ سیستم به صورت خودکار:
            </p>
            <ul className="list-disc list-inside text-blue-700 space-y-1 mr-4">
              <li>تاریخ را از ابتدای متن استخراج می‌کند</li>
              <li>تمام تگ‌های HTML را پاک می‌کند</li>
              <li>عنوان را از 100 کاراکتر اول تولید می‌کند</li>
              <li>منبع را از URL تشخیص می‌دهد (YouTube، الجزيرة، Twitter، و...)</li>
              <li>زبان را شناسایی می‌کند (فارسی، عربی، English)</li>
              <li>کلمات کلیدی را استخراج می‌کند</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
