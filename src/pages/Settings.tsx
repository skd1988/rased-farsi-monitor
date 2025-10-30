import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Download, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
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

  // Auto-sync states
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState(60);
  const [lastAutoSync, setLastAutoSync] = useState<string | null>(null);
  const [nextSyncTime, setNextSyncTime] = useState<string | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncHistory, setSyncHistory] = useState<Array<{ timestamp: string; success: boolean; count?: number; error?: string; manual?: boolean }>>([]);
  const [lastSyncedRow, setLastSyncedRow] = useState(0);
  const [totalRowsInSheet, setTotalRowsInSheet] = useState(0);

  const SHEET_ID = '11VzLIg5-evMkdGBUPzFgGXiv6nTgEL4r1wc4FDn2TKQ';
  const SHEET_NAME = 'Sheet1';

  // Load settings from localStorage
  useEffect(() => {
    const savedEnabled = localStorage.getItem('autoSyncEnabled') === 'true';
    const savedInterval = parseInt(localStorage.getItem('syncInterval') || '60');
    const savedLastSync = localStorage.getItem('lastAutoSync');
    const savedHistory = JSON.parse(localStorage.getItem('syncHistory') || '[]');
    const savedRow = parseInt(localStorage.getItem('lastSyncedRow') || '0');
    const savedTotal = parseInt(localStorage.getItem('totalRowsInSheet') || '0');
    
    setAutoSyncEnabled(savedEnabled);
    setSyncInterval(savedInterval);
    if (savedLastSync) setLastAutoSync(savedLastSync);
    setSyncHistory(savedHistory);
    setLastSyncedRow(savedRow);
    setTotalRowsInSheet(savedTotal);
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('autoSyncEnabled', String(autoSyncEnabled));
    localStorage.setItem('syncInterval', String(syncInterval));
  }, [autoSyncEnabled, syncInterval]);

  // Auto-sync interval
  useEffect(() => {
    if (!autoSyncEnabled) {
      setNextSyncTime(null);
      return;
    }
    
    console.log(`Auto-sync enabled with interval: ${syncInterval} minutes`);
    
    // Calculate next sync time
    const intervalMs = syncInterval * 60 * 1000;
    const updateNextSyncTime = () => {
      const next = new Date(Date.now() + intervalMs);
      setNextSyncTime(next.toISOString());
    };
    
    updateNextSyncTime();
    
    // Run auto-sync
    const interval = setInterval(() => {
      handleAutoSync();
      updateNextSyncTime();
    }, intervalMs);
    
    return () => clearInterval(interval);
  }, [autoSyncEnabled, syncInterval]);

const importFromGoogleSheets = async (startFromRow: number | null = null, silent = false) => {
    const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}`;
    
    if (!silent) {
      console.log('=== STARTING GOOGLE SHEETS IMPORT (8-COLUMN FORMAT, INCREMENTAL) ===');
      console.log('Fetching from URL:', CSV_URL);
    }
    
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
      
      const totalRows = parsed.data.length;
      console.log(`Total rows in sheet: ${totalRows}`);
      
      const lastRow = startFromRow !== null 
        ? startFromRow 
        : parseInt(localStorage.getItem('lastSyncedRow') || '0');
      
      console.log(`Last synced row: ${lastRow}`);
      console.log(`New rows to import: ${totalRows - lastRow}`);
      
      if (totalRows <= lastRow) {
        console.log('✅ No new posts to import');
        return { newCount: 0, updatedCount: 0, skippedCount: 0, total: totalRows, errors: [] };
      }
      
      if (parsed.errors.length > 0) {
        console.warn('CSV parsing warnings:', parsed.errors);
      }
      
      const allData = parsed.data as any[];
      const newRows = allData.slice(lastRow);
      console.log(`Processing ${newRows.length} new rows...`);
      
      setProgress({ current: 0, total: newRows.length });
      
      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];
      
      // Process only NEW rows
      for (let i = 0; i < newRows.length; i++) {
        const row = newRows[i] as any;
        const actualRowNumber = lastRow + i + 1;
        
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
            console.warn(`Row ${actualRowNumber}: Missing URL, skipping`);
            skippedCount++;
            continue;
          }
          
          console.log(`\n--- Row ${actualRowNumber}/${totalRows} ---`);
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
            console.log(`Row ${actualRowNumber}: Post exists, updating...`);
            const { error } = await supabase
              .from('posts')
              .update(postData)
              .eq('id', existing.id);
            
            if (error) throw error;
            updatedCount++;
            console.log(`Row ${actualRowNumber}: ✅ Updated`);
          } else {
            console.log(`Row ${actualRowNumber}: Creating new post...`);
            const { error } = await supabase
              .from('posts')
              .insert(postData);
            
            if (error) throw error;
            newCount++;
            console.log(`Row ${actualRowNumber}: ✅ Inserted`);
          }
          
          // Update progress after each successful import
          localStorage.setItem('lastSyncedRow', actualRowNumber.toString());
          
        } catch (rowError) {
          console.error(`❌ Error processing row ${actualRowNumber}:`, rowError);
          errors.push(`Row ${actualRowNumber}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
          skippedCount++;
        }
        
        setProgress({ current: i + 1, total: newRows.length });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Save final state
      localStorage.setItem('lastSyncedRow', totalRows.toString());
      localStorage.setItem('totalRowsInSheet', totalRows.toString());
      setLastSyncedRow(totalRows);
      setTotalRowsInSheet(totalRows);
      
      if (!silent) {
        console.log('\n=== INCREMENTAL SYNC COMPLETE ===');
        console.log('New posts:', newCount);
        console.log('Updated posts:', updatedCount);
        console.log('Skipped/errors:', skippedCount);
        console.log(`Synced rows: ${lastRow} → ${totalRows}`);
        if (errors.length > 0) {
          console.log('Errors:', errors);
        }
      }
      
      return { newCount, updatedCount, skippedCount, total: totalRows, errors };
      
    } catch (error) {
      console.error('❌ Import failed:', error);
      throw error;
    }
  };

  const handleAutoSync = async () => {
    console.log('Running auto-sync (incremental)...');
    
    try {
      const result = await importFromGoogleSheets(null, true);
      const count = result.newCount + result.updatedCount;
      
      if (count === 0) {
        console.log('No new posts to import');
        return;
      }
      
      const now = new Date().toISOString();
      setLastAutoSync(now);
      localStorage.setItem('lastAutoSync', now);
      
      const newHistory = [
        { timestamp: now, success: true, count },
        ...syncHistory
      ].slice(0, 10);
      
      setSyncHistory(newHistory);
      localStorage.setItem('syncHistory', JSON.stringify(newHistory));
      
      console.log(`✅ Auto-sync: ${count} new posts imported`);
      
    } catch (error) {
      console.error('Auto-sync failed:', error);
      
      const now = new Date().toISOString();
      const newHistory = [
        { timestamp: now, success: false, error: error instanceof Error ? error.message : 'Unknown error' },
        ...syncHistory
      ].slice(0, 10);
      
      setSyncHistory(newHistory);
      localStorage.setItem('syncHistory', JSON.stringify(newHistory));
    }
  };

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    
    try {
      const result = await importFromGoogleSheets(null, false);
      const count = result.newCount + result.updatedCount;
      
      const now = new Date().toISOString();
      setLastAutoSync(now);
      localStorage.setItem('lastAutoSync', now);
      
      const newHistory = [
        { timestamp: now, success: true, count, manual: true },
        ...syncHistory
      ].slice(0, 10);
      
      setSyncHistory(newHistory);
      localStorage.setItem('syncHistory', JSON.stringify(newHistory));
      
      if (count === 0) {
        toast({
          title: 'همگام‌سازی انجام شد',
          description: 'مطلب جدیدی یافت نشد',
        });
      } else {
        toast({
          title: 'همگام‌سازی موفق',
          description: `${count} مطلب جدید Import شد`,
        });
      }
      
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
      
    } catch (error) {
      console.error('Manual sync failed:', error);
      toast({
        title: 'خطا در همگام‌سازی',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
        variant: 'destructive',
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleResetSync = async () => {
    if (!confirm('آیا مطمئن هستید؟ تمام مطالب از اول Import می‌شوند.')) {
      return;
    }
    
    localStorage.setItem('lastSyncedRow', '0');
    setLastSyncedRow(0);
    
    setIsManualSyncing(true);
    try {
      const result = await importFromGoogleSheets(0, false);
      const count = result.newCount + result.updatedCount;
      
      toast({
        title: 'همگام‌سازی کامل انجام شد',
        description: `${count} مطلب`,
      });
      
      window.location.href = '/';
    } catch (error) {
      toast({
        title: 'خطا',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
        variant: 'destructive',
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleImport = async () => {
    console.log('=== IMPORT BUTTON CLICKED ===');
    setIsImporting(true);
    setImportStatus(null);
    
    try {
      const result = await importFromGoogleSheets(null, false);
      
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

      {/* Auto-Sync Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            همگام‌سازی خودکار
          </CardTitle>
          <CardDescription>
            Import خودکار مطالب جدید از Google Sheets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle Switch */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex-1">
              <p className="font-bold">فعال‌سازی همگام‌سازی خودکار</p>
              <p className="text-sm text-muted-foreground">مطالب جدید به صورت خودکار Import می‌شوند</p>
            </div>
            <Switch
              checked={autoSyncEnabled}
              onCheckedChange={setAutoSyncEnabled}
            />
          </div>

          {/* Interval Selector */}
          {autoSyncEnabled && (
            <div className="space-y-2">
              <Label className="font-bold">فاصله زمانی همگام‌سازی:</Label>
              <select
                value={syncInterval}
                onChange={(e) => setSyncInterval(Number(e.target.value))}
                className="w-full p-3 border rounded-lg bg-background"
              >
                <option value={5}>هر 5 دقیقه (تست)</option>
                <option value={15}>هر 15 دقیقه</option>
                <option value={30}>هر 30 دقیقه</option>
                <option value={60}>هر 1 ساعت</option>
                <option value={180}>هر 3 ساعت</option>
                <option value={360}>هر 6 ساعت</option>
              </select>
            </div>
          )}

          {/* Status Display */}
          {autoSyncEnabled && (
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-bold">همگام‌سازی خودکار فعال است</span>
              </div>
              <p className="text-sm text-muted-foreground">
                فاصله: هر {syncInterval} دقیقه
              </p>
              {lastAutoSync && (
                <p className="text-sm text-muted-foreground">
                  آخرین همگام‌سازی: {new Date(lastAutoSync).toLocaleString('fa-IR')}
                </p>
              )}
              {nextSyncTime && (
                <p className="text-sm text-muted-foreground">
                  همگام‌سازی بعدی: {new Date(nextSyncTime).toLocaleString('fa-IR')}
                </p>
              )}
              
              {/* Progress Display */}
              <div className="pt-2 mt-2 border-t border-primary/30">
                <p className="font-bold text-sm mb-1">وضعیت همگام‌سازی:</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ردیف‌های پردازش شده:</span>
                  <span className="font-bold">{lastSyncedRow} / {totalRowsInSheet || '?'}</span>
                </div>
                {totalRowsInSheet > lastSyncedRow && (
                  <div className="flex justify-between text-sm text-orange-600 dark:text-orange-400 mt-1">
                    <span>ردیف‌های جدید در انتظار:</span>
                    <span className="font-bold">{totalRowsInSheet - lastSyncedRow}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual Sync Button */}
          <Button
            onClick={handleManualSync}
            disabled={isManualSyncing}
            className="w-full"
            size="lg"
            variant="default"
          >
            {isManualSyncing ? (
              <>
                <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                در حال همگام‌سازی...
              </>
            ) : (
              <>
                <RefreshCw className="ml-2 h-5 w-5" />
                همگام‌سازی دستی (الان)
              </>
            )}
          </Button>

          {/* Sync History */}
          {syncHistory.length > 0 && (
            <div className="space-y-2">
              <p className="font-bold">تاریخچه همگام‌سازی:</p>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {syncHistory.slice(0, 5).map((sync, index) => (
                  <div key={index} className="p-3 bg-muted rounded-lg text-sm flex justify-between items-center">
                    <span className="text-muted-foreground">
                      {new Date(sync.timestamp).toLocaleString('fa-IR')}
                      {sync.manual && ' (دستی)'}
                    </span>
                    <span className={sync.success ? 'text-green-600 font-semibold' : 'text-destructive font-semibold'}>
                      {sync.success ? `✅ ${sync.count} مطلب` : '❌ خطا'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset Sync Section */}
          <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg space-y-3">
            <p className="font-bold">تنظیمات پیشرفته</p>
            <p className="text-sm text-muted-foreground">
              آخرین ردیف همگام‌سازی شده: {lastSyncedRow} از {totalRowsInSheet || '?'}
            </p>
            <Button
              onClick={handleResetSync}
              disabled={isManualSyncing}
              variant="outline"
              className="w-full border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
            >
              <RefreshCw className="ml-2 h-4 w-4" />
              ریست و همگام‌سازی کامل از ابتدا
            </Button>
            <p className="text-xs text-muted-foreground">
              ⚠️ این گزینه تمام مطالب را از اول Import می‌کند
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
