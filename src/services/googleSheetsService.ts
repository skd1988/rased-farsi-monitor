import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncResult {
  success: boolean;
  rowsAdded: number;
  totalRows: number;
  error?: string;
}

interface SyncStats {
  sheetRows: number;
  dbPosts: number;
  lastSynced: number;
  pendingRows: number;
}

class GoogleSheetsService {
  private readonly LAST_SYNCED_ROW_KEY = 'lastSyncedRow_';

  /**
   * دریافت آمار همگام‌سازی
   */
  async getSyncStats(sheetId: string): Promise<SyncStats | null> {
    try {
      const { count: dbCount } = await supabase
        .from('posts_rss')
        .select('*', { count: 'exact', head: true });

      const lastSyncedRow = this.getLastSyncedRow(sheetId);

      return {
        sheetRows: 0, // باید از API بخونیم
        dbPosts: dbCount || 0,
        lastSynced: lastSyncedRow,
        pendingRows: 0,
      };
    } catch (error) {
      console.error('[GoogleSheetsService] Error getting stats:', error);
      return null;
    }
  }

  /**
   * همگام‌سازی با Google Sheets
   */
  async syncFromGoogleSheets(
    apiKey: string,
    sheetId: string,
    sheetName: string,
    onProgress?: (progress: number) => void
  ): Promise<SyncResult> {
    try {
      console.log('[GoogleSheetsService] Starting sync...', { sheetId, sheetName });

      if (!apiKey || !sheetId || !sheetName) {
        return {
          success: false,
          rowsAdded: 0,
          totalRows: 0,
          error: 'اطلاعات Google Sheets ناقص است',
        };
      }

      // دریافت داده‌ها از Google Sheets
      const range = `${sheetName}!A:Z`; // همه ستون‌ها
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

      onProgress?.(10);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('خطا در دریافت داده از Google Sheets');
      }

      const data = await response.json();
      const rows = data.values || [];

      if (rows.length === 0) {
        return {
          success: true,
          rowsAdded: 0,
          totalRows: 0,
        };
      }

      onProgress?.(30);

      // ردیف اول header است
      const headers = rows[0];
      const dataRows = rows.slice(1);

      const lastSyncedRow = this.getLastSyncedRow(sheetId);
      const newRows = dataRows.slice(lastSyncedRow);

      console.log(`[GoogleSheetsService] Found ${newRows.length} new rows`);

      if (newRows.length === 0) {
        return {
          success: true,
          rowsAdded: 0,
          totalRows: dataRows.length,
        };
      }

      onProgress?.(50);

      // تبدیل به object و insert
      let addedCount = 0;
      const batchSize = 50;

      for (let i = 0; i < newRows.length; i += batchSize) {
        const batch = newRows.slice(i, i + batchSize);
        const posts = batch.map((row: any[]) => this.rowToPost(row, headers));

        const { error } = await supabase.from('posts_rss').insert(posts);

        if (error) {
          console.error('[GoogleSheetsService] Insert error:', error);
        } else {
          addedCount += posts.length;
        }

        const progress = 50 + ((i + batch.length) / newRows.length) * 40;
        onProgress?.(progress);
      }

      // ذخیره آخرین ردیف همگام شده
      this.setLastSyncedRow(sheetId, lastSyncedRow + newRows.length);

      onProgress?.(100);

      return {
        success: true,
        rowsAdded: addedCount,
        totalRows: dataRows.length,
      };
    } catch (error: any) {
      console.error('[GoogleSheetsService] Sync error:', error);
      return {
        success: false,
        rowsAdded: 0,
        totalRows: 0,
        error: error.message,
      };
    }
  }

  /**
   * تبدیل ردیف Sheet به Post object
   */
  private rowToPost(row: any[], headers: string[]): any {
    const post: any = {};
    headers.forEach((header, index) => {
      const value = row[index];
      if (value !== undefined && value !== '') {
        post[header] = value;
      }
    });
    return post;
  }

  /**
   * دریافت آخرین ردیف همگام شده
   */
  private getLastSyncedRow(sheetId: string): number {
    const key = this.LAST_SYNCED_ROW_KEY + sheetId;
    const value = localStorage.getItem(key);
    return value ? parseInt(value) : 0;
  }

  /**
   * ذخیره آخرین ردیف همگام شده
   */
  private setLastSyncedRow(sheetId: string, rowNumber: number): void {
    const key = this.LAST_SYNCED_ROW_KEY + sheetId;
    localStorage.setItem(key, rowNumber.toString());
  }

  /**
   * ریست کردن sync
   */
  resetSync(sheetId: string): void {
    const key = this.LAST_SYNCED_ROW_KEY + sheetId;
    localStorage.removeItem(key);
    toast.success('وضعیت همگام‌سازی ریست شد');
  }
}

export const googleSheetsService = new GoogleSheetsService();
