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
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();

  const SHEET_ID = '11VzLIg5-evMkdGBUPzFgGXiv6nTgEL4r1wc4FDn2TKQ';
  const SHEET_NAME = 'Sheet1';

  const importFromGoogleSheets = async () => {
    const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}`;
    
    console.log('Fetching from Google Sheets:', CSV_URL);
    
    try {
      const response = await fetch(CSV_URL);
      const csvText = await response.text();
      
      console.log('Raw CSV:', csvText.substring(0, 200));
      
      // Parse CSV
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim()
      });
      
      console.log('Parsed data:', parsed.data.length, 'rows');
      console.log('Headers:', parsed.meta.fields);
      if (parsed.data.length > 0) {
        console.log('Sample row:', parsed.data[0]);
      }
      
      const rows = parsed.data as any[];
      setProgress({ current: 0, total: rows.length });
      
      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      
      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        // Map Google Sheets columns (handle variations)
        const date = row['Date'] || row['date'];
        const title = row['Title'] || row['title'];
        const contents = row['Contents'] || row['contents'];
        const author = row['Author'] || row['author'];
        const articleUrl = row['Article URL'] || row['Artile URL'] || row['article_url'];
        
        if (!title || !articleUrl) {
          console.log('Skipping row - missing title or URL:', row);
          skippedCount++;
          continue;
        }
        
        // Auto-derive additional fields
        const source = deriveSource(articleUrl);
        const language = detectLanguage(contents || title);
        const keywords = extractKeywords(contents || title);
        
        // Prepare post data
        const postData = {
          title: title.trim(),
          contents: contents?.trim() || '',
          author: author?.trim() || 'نامشخص',
          article_url: articleUrl.trim(),
          source: source,
          language: language,
          status: 'جدید',
          keywords: keywords,
          published_at: date ? new Date(date).toISOString() : new Date().toISOString()
        };
        
        console.log(`Processing ${i + 1}/${rows.length}:`, postData.title);
        
        // Check if post already exists (by URL to avoid duplicates)
        const { data: existing } = await supabase
          .from('posts')
          .select('id')
          .eq('article_url', articleUrl)
          .maybeSingle();
        
        if (existing) {
          console.log('Post already exists, updating:', articleUrl);
          await supabase
            .from('posts')
            .update(postData)
            .eq('id', existing.id);
          updatedCount++;
        } else {
          console.log('Creating new post:', articleUrl);
          await supabase
            .from('posts')
            .insert(postData);
          newCount++;
        }
        
        setProgress({ current: i + 1, total: rows.length });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`✅ Import complete! New: ${newCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);
      return { newCount, updatedCount, skippedCount, total: rows.length };
      
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    setImportStatus(null);
    
    try {
      const result = await importFromGoogleSheets();
      
      const message = `✅ موفق! ${result.newCount} مطلب جدید، ${result.updatedCount} مطلب به‌روزرسانی شد، ${result.skippedCount} مطلب رد شد.`;
      
      setImportStatus({
        success: true,
        message: message
      });
      
      setLastSyncTime(new Date().toISOString());
      
      toast({
        title: 'Import موفق',
        description: message,
      });
      
      // Refresh data after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'خطای نامشخص';
      setImportStatus({
        success: false,
        message: `❌ خطا: ${errorMessage}`
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
              className={`p-4 rounded-lg flex items-start gap-3 ${
                importStatus.success
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {importStatus.success ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm flex-1">{importStatus.message}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold text-blue-900">📋 فرمت Google Sheet:</p>
            <ul className="list-disc list-inside text-blue-800 space-y-1 mr-4">
              <li>ستون Date: تاریخ انتشار (فرمت: YYYY-MM-DD)</li>
              <li>ستون Title: عنوان مطلب</li>
              <li>ستون Contents: متن کامل مطلب</li>
              <li>ستون Author: نویسنده</li>
              <li>ستون Article URL: لینک مطلب</li>
            </ul>
            <p className="text-blue-700 mt-2">
              💡 سیستم به طور خودکار منبع، زبان و کلمات کلیدی را استخراج می‌کند.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
