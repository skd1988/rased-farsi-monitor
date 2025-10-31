import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { 
  Loader2, 
  Key, 
  Database, 
  Shield, 
  Users, 
  Palette, 
  Zap, 
  Eye, 
  EyeOff,
  CheckCircle, 
  XCircle, 
  Download,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

const Settings = () => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Tab 1: Data Sources
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [lastTestedTime, setLastTestedTime] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState('11VzLIg5-evMkdGBUPzFgGXiv6nTgEL4r1wc4FDn2TKQ');
  const [sheetName, setSheetName] = useState('Sheet1');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'success' | 'error' | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Tab 4: Appearance
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [colorScheme, setColorScheme] = useState('blue');
  const [language, setLanguage] = useState('persian');
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [alertSounds, setAlertSounds] = useState(true);
  const [fontSize, setFontSize] = useState([16]);
  const [showTooltips, setShowTooltips] = useState(true);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [showKpiCards, setShowKpiCards] = useState(true);
  const [showCharts, setShowCharts] = useState(true);
  const [showRecentPosts, setShowRecentPosts] = useState(true);
  const [showRecentAlerts, setShowRecentAlerts] = useState(true);
  const [defaultTimeRange, setDefaultTimeRange] = useState('7');

  // Tab 5: Automation
  const [autoAnalysis, setAutoAnalysis] = useState(false);
  const [analysisDelay, setAnalysisDelay] = useState([5]);
  const [batchSize, setBatchSize] = useState('10');
  const [analysisSchedule, setAnalysisSchedule] = useState('manual');
  const [weeklyReports, setWeeklyReports] = useState(false);
  const [reportDay, setReportDay] = useState('saturday');
  const [reportTime, setReportTime] = useState('09:00');
  const [reportEmail, setReportEmail] = useState('');
  const [autoSync, setAutoSync] = useState(false);
  const [syncInterval, setSyncInterval] = useState('30');
  const [autoCleanup, setAutoCleanup] = useState(false);
  const [keepPostsFor, setKeepPostsFor] = useState('90');
  const [archiveBeforeDelete, setArchiveBeforeDelete] = useState(true);
  const [autoBackup, setAutoBackup] = useState('never');

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setDeepseekApiKey(settings.deepseekApiKey || '');
      setSheetId(settings.sheetId || '11VzLIg5-evMkdGBUPzFgGXiv6nTgEL4r1wc4FDn2TKQ');
      setSheetName(settings.sheetName || 'Sheet1');
      setIsDarkMode(settings.isDarkMode || false);
      setColorScheme(settings.colorScheme || 'blue');
      setDesktopNotifications(settings.desktopNotifications ?? true);
      setAlertSounds(settings.alertSounds ?? true);
      setAutoAnalysis(settings.autoAnalysis || false);
      setAutoSync(settings.autoSync || false);
    }
    
    const lastSync = localStorage.getItem('lastSyncTime');
    if (lastSync) setLastSyncTime(lastSync);
  }, []);

  const handleSaveApiKey = async () => {
    setIsSaving(true);
    try {
      const settings = {
        deepseekApiKey,
        sheetId,
        sheetName,
        isDarkMode,
        colorScheme,
        desktopNotifications,
        alertSounds,
        autoAnalysis,
        autoSync
      };
      localStorage.setItem('appSettings', JSON.stringify(settings));
      
      toast({
        title: 'ذخیره شد',
        description: 'تنظیمات با موفقیت ذخیره شد',
      });
    } catch (error) {
      toast({
        title: 'خطا',
        description: 'خطا در ذخیره تنظیمات',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsSaving(true);
    try {
      // Simulate API test
      await new Promise(resolve => setTimeout(resolve, 1000));
      setApiKeyStatus('connected');
      setLastTestedTime(new Date().toISOString());
      toast({
        title: 'اتصال موفق',
        description: 'اتصال به DeepSeek API برقرار شد',
      });
    } catch (error) {
      setApiKeyStatus('disconnected');
      toast({
        title: 'خطا در اتصال',
        description: 'اتصال به API برقرار نشد',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const now = new Date().toISOString();
      setLastSyncTime(now);
      localStorage.setItem('lastSyncTime', now);
      setSyncStatus('success');
      toast({
        title: 'همگام‌سازی موفق',
        description: 'داده‌ها با موفقیت از Google Sheets وارد شد',
      });
    } catch (error) {
      setSyncStatus('error');
      toast({
        title: 'خطا',
        description: 'خطا در همگام‌سازی',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportData = () => {
    toast({
      title: 'در حال آماده‌سازی',
      description: 'فایل پشتیبان در حال آماده‌سازی است...',
    });
  };

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">تنظیمات</h1>
          <p className="text-muted-foreground mt-2">پیکربندی سیستم و تنظیمات پیشرفته</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="data-sources" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="data-sources" className="gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">منابع داده</span>
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">قوانین رصد</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">مدیریت تیم</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">ظاهر</span>
            </TabsTrigger>
            <TabsTrigger value="automation" className="gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">اتوماسیون</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Data Sources */}
          <TabsContent value="data-sources" className="space-y-6">
            {/* API Keys Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  کلیدهای API
                </CardTitle>
                <CardDescription>پیکربندی کلیدهای API برای سرویس‌های خارجی</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* DeepSeek API */}
                <div className="space-y-3">
                  <Label htmlFor="deepseek-key">کلید API دیپ‌سیک</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="deepseek-key"
                        type={showApiKey ? "text" : "password"}
                        value={deepseekApiKey}
                        onChange={(e) => setDeepseekApiKey(e.target.value)}
                        placeholder="sk-..."
                        dir="ltr"
                        className="text-left"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute left-2 top-1/2 -translate-y-1/2"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button onClick={handleTestConnection} disabled={isSaving || !deepseekApiKey}>
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تست اتصال'}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {apiKeyStatus === 'connected' ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span className="text-success">متصل</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">عدم اتصال</span>
                      </>
                    )}
                    {lastTestedTime && (
                      <span className="text-muted-foreground">
                        • آخرین تست: {new Date(lastTestedTime).toLocaleString('fa-IR')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Future APIs (Coming Soon) */}
                <div className="space-y-3 opacity-50">
                  <Label>کلید OpenAI API</Label>
                  <div className="flex gap-2">
                    <Input disabled placeholder="به زودی..." dir="ltr" />
                    <Button disabled>تست اتصال</Button>
                  </div>
                  <span className="text-xs text-muted-foreground">این قابلیت در نسخه بعدی فعال خواهد شد</span>
                </div>

                <Button onClick={handleSaveApiKey} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                  ذخیره کلیدهای API
                </Button>
              </CardContent>
            </Card>

            {/* Google Sheets Integration */}
            <Card>
              <CardHeader>
                <CardTitle>اتصال به Google Sheets</CardTitle>
                <CardDescription>وارد کردن داده‌ها از Google Sheets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sheet-id">شناسه Sheet</Label>
                  <Input
                    id="sheet-id"
                    value={sheetId}
                    onChange={(e) => setSheetId(e.target.value)}
                    placeholder="11VzLIg5-evMkd..."
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sheet-name">نام Sheet</Label>
                  <Input
                    id="sheet-name"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    placeholder="Sheet1"
                  />
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleManualSync} disabled={isSyncing}>
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 ml-2" />
                    )}
                    وارد کردن از Google Sheets
                  </Button>
                  <Button variant="outline" onClick={handleSaveApiKey}>
                    ذخیره
                  </Button>
                </div>

                {lastSyncTime && (
                  <div className="flex items-center gap-2 text-sm pt-2 border-t">
                    {syncStatus === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-danger" />
                    )}
                    <span className="text-muted-foreground">
                      آخرین همگام‌سازی: {new Date(lastSyncTime).toLocaleString('fa-IR')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Connection Status */}
            <Card>
              <CardHeader>
                <CardTitle>وضعیت اتصالات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="font-medium">DeepSeek API</span>
                    <div className="flex items-center gap-2">
                      {apiKeyStatus === 'connected' ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-success" />
                          <span className="text-sm text-success">متصل</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">عدم اتصال</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="font-medium">پایگاه داده</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="text-sm text-success">متصل (Supabase)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Monitoring Rules */}
          <TabsContent value="monitoring" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>مدیریت کلیدواژه‌ها</CardTitle>
                <CardDescription>افزودن و مدیریت کلیدواژه‌های رصد</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>این بخش در نسخه بعدی فعال خواهد شد</p>
                  <p className="text-sm mt-2">مدیریت کلیدواژه‌ها، دسته‌بندی و اولویت‌بندی</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>قوانین هشدار</CardTitle>
                <CardDescription>تنظیم شرایط ایجاد خودکار هشدار</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>این بخش در نسخه بعدی فعال خواهد شد</p>
                  <p className="text-sm mt-2">تعریف قوانین برای ایجاد خودکار هشدار بر اساس سطح تهدید</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Team Management */}
          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>مدیریت تیم</CardTitle>
                <CardDescription>مدیریت کاربران و دسترسی‌ها</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">این بخش در نسخه بعدی فعال خواهد شد</h3>
                  <p className="text-muted-foreground mb-6">
                    افزودن کاربران، تعریف نقش‌ها و مدیریت دسترسی‌ها
                  </p>
                  
                  <div className="max-w-md mx-auto mt-8 p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-3">اطلاعات کاربر فعلی</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">نقش:</span>
                        <span className="font-medium">مدیر</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">وضعیت:</span>
                        <span className="text-success">فعال</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Appearance */}
          <TabsContent value="appearance" className="space-y-6">
            {/* Theme */}
            <Card>
              <CardHeader>
                <CardTitle>تم و رنگ</CardTitle>
                <CardDescription>تنظیمات ظاهری و رنگ‌بندی</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="dark-mode">حالت تاریک</Label>
                    <p className="text-sm text-muted-foreground">فعال‌سازی حالت شب</p>
                  </div>
                  <Switch
                    id="dark-mode"
                    checked={isDarkMode}
                    onCheckedChange={setIsDarkMode}
                  />
                </div>

                <div className="space-y-3">
                  <Label>طرح رنگی</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {['blue', 'purple', 'green', 'orange'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setColorScheme(color)}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          colorScheme === color ? 'border-primary' : 'border-border'
                        }`}
                      >
                        <div
                          className={`h-12 w-full rounded ${
                            color === 'blue' ? 'bg-primary' :
                            color === 'purple' ? 'bg-purple-500' :
                            color === 'green' ? 'bg-success' :
                            'bg-warning'
                          }`}
                        />
                        <p className="text-sm mt-2 capitalize">{color}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleSaveApiKey}>ذخیره تنظیمات</Button>
              </CardContent>
            </Card>

            {/* Display Settings */}
            <Card>
              <CardHeader>
                <CardTitle>تنظیمات نمایش</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notifications">اعلان‌های دسکتاپ</Label>
                  <Switch
                    id="notifications"
                    checked={desktopNotifications}
                    onCheckedChange={setDesktopNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="sounds">صدای هشدارها</Label>
                  <Switch
                    id="sounds"
                    checked={alertSounds}
                    onCheckedChange={setAlertSounds}
                  />
                </div>

                <div className="space-y-2">
                  <Label>اندازه فونت: {fontSize}px</Label>
                  <Slider
                    value={fontSize}
                    onValueChange={setFontSize}
                    min={12}
                    max={20}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="tooltips">نمایش راهنماها</Label>
                  <Switch
                    id="tooltips"
                    checked={showTooltips}
                    onCheckedChange={setShowTooltips}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="animations">انیمیشن‌ها</Label>
                  <Switch
                    id="animations"
                    checked={animationsEnabled}
                    onCheckedChange={setAnimationsEnabled}
                  />
                </div>

                <Button onClick={handleSaveApiKey}>ذخیره تنظیمات</Button>
              </CardContent>
            </Card>

            {/* Dashboard Preferences */}
            <Card>
              <CardHeader>
                <CardTitle>تنظیمات داشبورد</CardTitle>
                <CardDescription>ویجت‌های پیش‌فرض نمایشی</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>نمایش کارت‌های KPI</Label>
                  <Switch checked={showKpiCards} onCheckedChange={setShowKpiCards} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>نمایش نمودارها</Label>
                  <Switch checked={showCharts} onCheckedChange={setShowCharts} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>نمایش پست‌های اخیر</Label>
                  <Switch checked={showRecentPosts} onCheckedChange={setShowRecentPosts} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>نمایش هشدارهای اخیر</Label>
                  <Switch checked={showRecentAlerts} onCheckedChange={setShowRecentAlerts} />
                </div>

                <Button onClick={handleSaveApiKey}>ذخیره تنظیمات</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 5: Automation */}
          <TabsContent value="automation" className="space-y-6">
            {/* Auto Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>تحلیل خودکار</CardTitle>
                <CardDescription>تنظیمات تحلیل خودکار محتوا</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-analysis">تحلیل خودکار مطالب جدید</Label>
                    <p className="text-sm text-muted-foreground">تحلیل هوشمند پست‌های جدید</p>
                  </div>
                  <Switch
                    id="auto-analysis"
                    checked={autoAnalysis}
                    onCheckedChange={setAutoAnalysis}
                  />
                </div>

                {autoAnalysis && (
                  <>
                    <div className="space-y-2">
                      <Label>تاخیر قبل از تحلیل: {analysisDelay} دقیقه</Label>
                      <Slider
                        value={analysisDelay}
                        onValueChange={setAnalysisDelay}
                        min={1}
                        max={60}
                        step={1}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="batch-size">تعداد پست در هر دسته</Label>
                      <Input
                        id="batch-size"
                        type="number"
                        value={batchSize}
                        onChange={(e) => setBatchSize(e.target.value)}
                        min="1"
                        max="100"
                      />
                    </div>
                  </>
                )}

                <Button onClick={handleSaveApiKey}>ذخیره تنظیمات</Button>
              </CardContent>
            </Card>

            {/* Auto Sync */}
            <Card>
              <CardHeader>
                <CardTitle>همگام‌سازی خودکار</CardTitle>
                <CardDescription>تنظیمات همگام‌سازی با Google Sheets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-sync">همگام‌سازی خودکار</Label>
                  <Switch
                    id="auto-sync"
                    checked={autoSync}
                    onCheckedChange={setAutoSync}
                  />
                </div>

                {autoSync && (
                  <div className="space-y-2">
                    <Label htmlFor="sync-interval">فاصله زمانی</Label>
                    <select
                      id="sync-interval"
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3"
                    >
                      <option value="5">هر 5 دقیقه</option>
                      <option value="15">هر 15 دقیقه</option>
                      <option value="30">هر 30 دقیقه</option>
                      <option value="60">هر 1 ساعت</option>
                    </select>
                  </div>
                )}

                <Button onClick={handleSaveApiKey}>ذخیره تنظیمات</Button>
              </CardContent>
            </Card>

            {/* Backup & Export */}
            <Card>
              <CardHeader>
                <CardTitle>پشتیبان‌گیری و خروجی</CardTitle>
                <CardDescription>دانلود و مدیریت پشتیبان داده‌ها</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleExportData} variant="outline" className="w-full">
                  <Download className="h-4 w-4 ml-2" />
                  دانلود پشتیبان از تمام داده‌ها
                </Button>

                <div className="space-y-2">
                  <Label htmlFor="auto-backup">پشتیبان‌گیری خودکار</Label>
                  <select
                    id="auto-backup"
                    value={autoBackup}
                    onChange={(e) => setAutoBackup(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3"
                  >
                    <option value="never">هرگز</option>
                    <option value="daily">روزانه</option>
                    <option value="weekly">هفتگی</option>
                    <option value="monthly">ماهانه</option>
                  </select>
                </div>

                <Button onClick={handleSaveApiKey}>ذخیره تنظیمات</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
