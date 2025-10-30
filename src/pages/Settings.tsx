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
function parseDate(dateString: string | null | undefined): string {
  if (!dateString) return new Date().toISOString();
  
  try {
    // Format 1: ISO format (2024-10-30 or 2024-10-30T...)
    if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
      const parsed = new Date(dateString);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
    
    // Format 2: Persian/Jalali date (1403/08/08)
    if (/^\d{4}\/\d{2}\/\d{2}/.test(dateString)) {
      console.warn('Jalali date detected:', dateString, '- using current date');
      return new Date().toISOString();
    }
    
    // Format 3: Try parsing as-is
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    
    // Fallback: use current date
    console.warn('Could not parse date:', dateString, '- using current date');
    return new Date().toISOString();
    
  } catch (error) {
    console.error('Date parsing error:', error);
    return new Date().toISOString();
  }
}

function deriveSource(url: string): string {
  if (!url) return 'نامشخص';
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const sourceMap: Record<string, string> = {
      'aljazeera.net': 'الجزیرة',
      'isna.ir': 'ایسنا',
      'mehrnews.com': 'مهر',
      'tasnimnews.com': 'تسنیم',
      'farsnews.ir': 'فارس',
      'irna.ir': 'ایرنا',
      'rt.com': 'RT Arabic',
      'bbc.com': 'BBC Persian'
    };
    return sourceMap[hostname] || 'نامشخص';
  } catch {
    return 'نامشخص';
  }
}

function detectLanguage(text: string): string {
  if (!text) return 'English';
  if (/[پچژگ]/.test(text)) return 'فارسی';
  if (/[\u0600-\u06FF]/.test(text)) return 'عربی';
  return 'English';
}

function extractKeywords(text: string): string[] {
  if (!text) return [];
  const keywords = [
    'جنگ روانی', 'جنگ‌روانی',
    'محور مقاومت', 'محور‌مقاومت',
    'اتهام', 'متهم',
    'شبهه', 'شبهات',
    'کمپین', 'کمپین‌های'
  ];
  return keywords.filter(kw => text.includes(kw));
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
    
    console.log('=== STARTING GOOGLE SHEETS IMPORT ===');
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
      
      // Parse CSV
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim()
      });
      
      console.log('Parsed data:', parsed.data.length, 'rows');
      console.log('Headers found:', parsed.meta.fields);
      
      if (parsed.errors.length > 0) {
        console.warn('CSV parsing warnings:', parsed.errors);
      }
      
      if (parsed.data.length === 0) {
        throw new Error('No data found in sheet. Make sure the sheet has data and is public.');
      }
      
      console.log('Sample row:', parsed.data[0]);
      
      const rows = parsed.data as any[];
      setProgress({ current: 0, total: rows.length });
      
      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];
      
      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        try {
          // Map Google Sheets columns (try multiple variations)
          const date = row['Date'] || row['date'] || row['DATE'];
          const title = row['Title'] || row['title'] || row['TITLE'];
          const contents = row['Contents'] || row['contents'] || row['Content'] || row['CONTENTS'];
          const sheetSource = row['Source'] || row['source'] || row['SOURCE'];
          const articleUrl = row['Article URL'] || row['Artile URL'] || row['article_url'] || row['URL'] || row['url'];
          const sheetLanguage = row['Language'] || row['language'] || row['LANGUAGE'];
          const sheetStatus = row['Status'] || row['status'] || row['STATUS'];
          const sheetKeywords = row['Keywords'] || row['keywords'] || row['KEYWORDS'];
          
          console.log(`\n--- Row ${i + 1}/${rows.length} ---`);
          console.log('Date:', date);
          console.log('Title:', title?.substring(0, 50));
          console.log('Source (sheet):', sheetSource);
          console.log('Article URL:', articleUrl);
          console.log('Language (sheet):', sheetLanguage);
          console.log('Status (sheet):', sheetStatus);
          console.log('Keywords (sheet):', sheetKeywords);
          
          if (!title || !articleUrl) {
            console.warn(`Row ${i + 1}: Missing required fields (title or URL), skipping`);
            skippedCount++;
            continue;
          }
          
          // Use sheet values if provided, fallback to auto-derive
          const source = (sheetSource && sheetSource.trim() !== '') 
            ? sheetSource.trim() 
            : deriveSource(articleUrl);
            
          const language = (sheetLanguage && sheetLanguage.trim() !== '') 
            ? sheetLanguage.trim() 
            : detectLanguage(contents || title);
            
          const status = (sheetStatus && sheetStatus.trim() !== '') 
            ? sheetStatus.trim() 
            : 'جدید';
          
          // Parse keywords from sheet (comma-separated string)
          let keywords: string[] = [];
          if (sheetKeywords && sheetKeywords.trim() !== '') {
            keywords = sheetKeywords.split(',').map((k: string) => k.trim()).filter((k: string) => k);
          }
          // Fallback to auto-extract if empty
          if (keywords.length === 0) {
            keywords = extractKeywords(contents || title);
          }
          
          // Prepare post data with safe date parsing
          const postData = {
            title: title.trim(),
            contents: contents ? contents.trim() : '',
            author: 'نامشخص', // No author column in your sheet
            article_url: articleUrl.trim(),
            source: source,
            source_url: articleUrl.trim(),
            language: language,
            status: status,
            keywords: keywords,
            published_at: parseDate(date) // Use safe date parser
          };
          
          console.log('Final source:', source);
          console.log('Final language:', language);
          console.log('Final status:', status);
          console.log('Final keywords:', keywords);
          console.log('Parsed date:', postData.published_at);
          
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
      
      return { newCount, updatedCount, skippedCount, total: rows.length, errors };
      
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
              <li>ستون 1 - Date: تاریخ انتشار</li>
              <li>ستون 2 - Title: عنوان مطلب</li>
              <li>ستون 3 - Contents: متن کامل</li>
              <li>ستون 4 - Source: منبع (مثل: الشرق الاوسط، Twitter)</li>
              <li>ستون 5 - Article URL: لینک مطلب</li>
              <li>ستون 6 - Language: زبان (فارسی، عربی، English)</li>
              <li>ستون 7 - Status: وضعیت (جدید)</li>
              <li>ستون 8 - Keywords: کلمات کلیدی (جدا شده با ویرگول)</li>
            </ul>
            <p className="text-blue-700 mt-2">
              ✅ سیستم ستون‌های 4، 6، 7، 8 را از Sheet می‌خواند و فقط در صورت خالی بودن، مقادیر را خودکار استخراج می‌کند.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
