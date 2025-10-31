import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trash2, RefreshCw, Database, AlertTriangle } from 'lucide-react';

const Debug = () => {
  const [stats, setStats] = useState({
    totalPosts: 0,
    emptyPosts: 0,
    sheetRows: 0,
    lastSyncedRow: 0,
  });
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const loadStats = async () => {
    try {
      setLoading(true);

      // Get total posts
      const { count: totalCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true });

      // Get all posts to count empty ones
      const { data: allPosts } = await supabase
        .from('posts')
        .select('*');

      // Count empty posts
      const emptyCount = allPosts?.filter(post => {
        const values = Object.entries(post);
        const meaningful = values.filter(([key, val]) => {
          if (['id', 'created_at', 'updated_at'].includes(key)) return false;
          if (!val || val === '' || val === null) return false;
          return true;
        });
        return meaningful.length <= 2;
      }).length || 0;

      // Get sheet info from localStorage
      const sheetId = localStorage.getItem('sheetId') || '';
      const sheetName = localStorage.getItem('sheetName') || 'Sheet1';
      const lastSyncedRow = parseInt(localStorage.getItem('lastSyncedRow') || '0');

      // Try to get sheet row count
      let sheetRows = 0;
      if (sheetId) {
        try {
          const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
          const response = await fetch(sheetUrl);
          const csv = await response.text();
          sheetRows = csv.split('\n').length - 1;
        } catch (e) {
          console.error('Could not fetch sheet:', e);
        }
      }

      setStats({
        totalPosts: totalCount || 0,
        emptyPosts: emptyCount,
        sheetRows,
        lastSyncedRow,
      });

    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteEmptyPosts = async () => {
    if (!confirm(`حذف ${stats.emptyPosts} مطلب خالی؟`)) return;

    try {
      setCleaning(true);

      // Get all posts
      const { data: allPosts } = await supabase
        .from('posts')
        .select('*');

      // Find empty IDs
      const emptyIds = allPosts
        ?.filter(post => {
          const values = Object.entries(post);
          const meaningful = values.filter(([key, val]) => {
            if (['id', 'created_at', 'updated_at'].includes(key)) return false;
            if (!val || val === '' || val === null) return false;
            return true;
          });
          return meaningful.length <= 2;
        })
        .map(p => p.id) || [];

      console.log('Deleting IDs:', emptyIds);

      // Delete in batches
      let deleted = 0;
      for (let i = 0; i < emptyIds.length; i += 50) {
        const batch = emptyIds.slice(i, i + 50);
        const { error } = await supabase
          .from('posts')
          .delete()
          .in('id', batch);

        if (!error) deleted += batch.length;
      }

      toast({
        title: 'حذف موفق',
        description: `${deleted} مطلب حذف شد`,
      });

      await loadStats();

    } catch (error) {
      console.error(error);
      toast({
        title: 'خطا',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCleaning(false);
    }
  };

  const resetAndSync = async () => {
    if (!confirm('همگام‌سازی از ابتدا؟ این ممکن است مطالب تکراری ایجاد کند.')) return;

    try {
      setSyncing(true);
      localStorage.setItem('lastSyncedRow', '0');
      
      toast({
        title: 'localStorage پاک شد',
        description: 'حالا می‌توانید از صفحه تنظیمات همگام‌سازی کنید',
      });

      await loadStats();
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold">🔧 Debug & Admin</h1>
        <p className="text-muted-foreground">ابزارهای رفع مشکل و مدیریت</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">کل مطالب</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalPosts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">مطالب خالی</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.emptyPosts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">ردیف‌های Sheet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.sheetRows}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">آخرین Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.lastSyncedRow}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {stats.emptyPosts > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {stats.emptyPosts} مطلب خالی در دیتابیس وجود دارد ({Math.round((stats.emptyPosts / stats.totalPosts) * 100)}%)
          </AlertDescription>
        </Alert>
      )}

      {stats.sheetRows > stats.totalPosts && (
        <Alert>
          <Database className="h-4 w-4" />
          <AlertDescription>
            {stats.sheetRows - stats.totalPosts} ردیف در Google Sheet هنوز import نشده است
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>عملیات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={loadStats} variant="outline">
              <RefreshCw className="ml-2 h-4 w-4" />
              بارگذاری مجدد آمار
            </Button>

            <Button
              onClick={deleteEmptyPosts}
              variant="destructive"
              disabled={cleaning || stats.emptyPosts === 0}
            >
              {cleaning ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  در حال حذف...
                </>
              ) : (
                <>
                  <Trash2 className="ml-2 h-4 w-4" />
                  حذف {stats.emptyPosts} مطلب خالی
                </>
              )}
            </Button>

            <Button
              onClick={resetAndSync}
              disabled={syncing}
            >
              {syncing ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  در حال ریست...
                </>
              ) : (
                'ریست و آماده‌سازی Sync'
              )}
            </Button>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>• دکمه اول: بررسی مجدد وضعیت</p>
            <p>• دکمه دوم: حذف مطالب خالی از دیتابیس</p>
            <p>• دکمه سوم: localStorage را پاک می‌کند و آماده همگام‌سازی می‌شود</p>
          </div>
        </CardContent>
      </Card>

      {/* Console Log */}
      <Card>
        <CardHeader>
          <CardTitle>اطلاعات سیستم</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded overflow-auto">
{JSON.stringify({
  sheetId: localStorage.getItem('sheetId'),
  sheetName: localStorage.getItem('sheetName'),
  lastSyncTime: localStorage.getItem('lastSyncTime'),
  lastSyncedRow: localStorage.getItem('lastSyncedRow'),
  totalRowsInSheet: localStorage.getItem('totalRowsInSheet'),
}, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default Debug;
