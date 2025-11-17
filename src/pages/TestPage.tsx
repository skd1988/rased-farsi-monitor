import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Navigation } from 'lucide-react';

console.log('🔴 [TestPage] FILE LOADED');

const TestPage = () => {
  console.log('🟡 [TestPage] FUNCTION CALLED');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('='.repeat(50));
    console.log('🟢 TEST PAGE MOUNTED SUCCESSFULLY!');
    console.log('Location:', location);
    console.log('Pathname:', location.pathname);
    console.log('Hash:', location.hash);
    console.log('Search:', location.search);
    console.log('Full URL:', window.location.href);
    console.log('='.repeat(50));

    return () => {
      console.log('🔵 [TestPage] COMPONENT UNMOUNTING');
    };
  }, [location]);

  const testRoutes = [
    { path: '/dashboard', label: 'Dashboard', color: 'blue' },
    { path: '/psyop-detection', label: 'PsyOp Detection', color: 'red' },
    { path: '/campaign-tracking', label: 'Campaign Tracking', color: 'purple' },
    { path: '/target-analysis', label: 'Target Analysis', color: 'orange' },
    { path: '/source-intelligence', label: 'Source Intelligence', color: 'green' },
    { path: '/channel-analytics', label: 'Channel Analytics', color: 'cyan' },
    { path: '/posts', label: 'Posts Explorer', color: 'indigo' },
    { path: '/settings', label: 'Settings', color: 'gray' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Success Header */}
        <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-900/20">
          <CardHeader>
            <div className="flex items-center gap-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <div>
                <CardTitle className="text-3xl text-green-700 dark:text-green-400">
                  ✅ TEST PAGE IS WORKING!
                </CardTitle>
                <CardDescription className="text-green-600 dark:text-green-300 mt-2">
                  If you can see this page, the routing system is functioning correctly
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Current Location Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              مسیر فعلی (Current Route)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg font-mono text-sm">
              <div>
                <div className="text-muted-foreground mb-1">Pathname:</div>
                <div className="font-semibold">{location.pathname}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Full URL:</div>
                <div className="font-semibold break-all text-xs">{window.location.href}</div>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Badge variant="outline">Using HashRouter</Badge>
              <Badge variant="secondary">React Router v6</Badge>
              <Badge variant="default">Nested Routes</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Test Grid */}
        <Card>
          <CardHeader>
            <CardTitle>آزمایش ناوبری (Navigation Test)</CardTitle>
            <CardDescription>
              با کلیک روی هر دکمه، به صفحه مربوطه بروید و در Console لاگ‌ها را بررسی کنید
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {testRoutes.map((route) => (
                <Button
                  key={route.path}
                  onClick={() => {
                    console.log(`🚀 [TestPage] Navigating to: ${route.path}`);
                    navigate(route.path);
                  }}
                  variant={location.pathname === route.path ? 'default' : 'outline'}
                  className="h-20 flex flex-col gap-2"
                >
                  <div className="font-bold">{route.label}</div>
                  <div className="text-xs opacity-70">{route.path}</div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Console Instructions */}
        <Card className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/20">
          <CardHeader>
            <CardTitle className="text-blue-700 dark:text-blue-400">
              📋 دستورالعمل‌های Debug
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold">در Console به دنبال این emoji ها باشید:</h4>
              <ul className="space-y-1 text-sm">
                <li>🔴 = فایل کامپوننت load شد</li>
                <li>🟡 = تابع کامپوننت فراخوانی شد</li>
                <li>🟢 = کامپوننت با موفقیت mount شد</li>
                <li>📊 = در حال fetch کردن داده‌ها</li>
                <li>⏳ = loading state فعال است</li>
                <li>✨ = در حال render کردن محتوای اصلی</li>
                <li>🔵 = کامپوننت در حال unmount شدن</li>
              </ul>
            </div>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                ⚠️ اگر صفحه‌ای خالی است:
              </h4>
              <ol className="text-sm space-y-1 text-yellow-800 dark:text-yellow-300">
                <li>1. Console را باز کنید (F12)</li>
                <li>2. به صفحه مورد نظر navigate کنید</li>
                <li>3. چک کنید کدام emoji ها نمایش داده می‌شوند</li>
                <li>4. اگر فقط 🔴 و 🟡 را می‌بینید، کامپوننت mount نمی‌شود</li>
                <li>5. اگر ⏳ را برای مدت طولانی می‌بینید، loading state stuck شده</li>
                <li>6. اگر error می‌بینید، screenshot بگیرید</li>
              </ol>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">
                ✅ صفحاتی که می‌بایست کار کنند:
              </h4>
              <div className="flex flex-wrap gap-2 text-sm">
                {testRoutes.map(route => (
                  <Badge key={route.path} variant="outline" className="text-green-700 dark:text-green-300">
                    {route.label}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestPage;
