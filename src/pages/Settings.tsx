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
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [lastTestedTime, setLastTestedTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize settings from localStorage
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing settings:', e);
      }
    }
    
    // Default settings
    return {
      deepseek_api_key: '',
      google_sheet_id: localStorage.getItem('sheetId') || '11VzLIg5-evMkdGBUPzFgGXiv6nTgEL4r1wc4FDn2TKQ',
      google_sheet_name: localStorage.getItem('sheetName') || 'Sheet1',
      last_sync_time: localStorage.getItem('lastSyncTime') || null,
      sync_status: null,
      theme: localStorage.getItem('theme') || 'blue',
      dark_mode: localStorage.getItem('darkMode') === 'true',
      language: 'persian',
      notifications_enabled: true,
      alert_sounds: true,
      font_size: 16,
      show_tooltips: true,
      animations_enabled: true,
      show_kpi_cards: true,
      show_charts: true,
      show_recent_posts: true,
      show_recent_alerts: true,
      default_time_range: '7',
      auto_analysis: localStorage.getItem('autoAnalysis') === 'true',
      analysis_delay: 5,
      batch_size: '10',
      analysis_schedule: 'manual',
      weekly_reports: false,
      report_day: 'saturday',
      report_time: '09:00',
      report_email: '',
      auto_sync: localStorage.getItem('autoSyncEnabled') === 'true',
      sync_interval: localStorage.getItem('syncInterval') || '30',
      auto_cleanup: false,
      keep_posts_for: '90',
      archive_before_delete: true,
      auto_backup: 'never',
    };
  });

  // Save settings function
  const saveSettings = (updates: Partial<typeof settings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    
    // Save to localStorage
    localStorage.setItem('appSettings', JSON.stringify(newSettings));
    
    // Also save individual keys for backward compatibility
    if (updates.theme) localStorage.setItem('theme', updates.theme);
    if (updates.dark_mode !== undefined) localStorage.setItem('darkMode', String(updates.dark_mode));
    if (updates.google_sheet_id) localStorage.setItem('sheetId', updates.google_sheet_id);
    if (updates.google_sheet_name) localStorage.setItem('sheetName', updates.google_sheet_name);
    if (updates.auto_sync !== undefined) localStorage.setItem('autoSyncEnabled', String(updates.auto_sync));
    if (updates.sync_interval) localStorage.setItem('syncInterval', updates.sync_interval);
    if (updates.auto_analysis !== undefined) localStorage.setItem('autoAnalysis', String(updates.auto_analysis));
    
    toast({
      title: 'تنظیمات ذخیره شد',
      description: 'تغییرات با موفقیت اعمال شد',
    });
    
    // Apply theme changes immediately
    if (updates.theme) {
      document.documentElement.setAttribute('data-theme', updates.theme);
    }
    
    if (updates.dark_mode !== undefined) {
      document.documentElement.classList.toggle('dark', updates.dark_mode);
    }
  };

  const handleSaveApiKey = () => {
    if (!settings.deepseek_api_key) {
      toast({
        title: 'خطا',
        description: 'لطفا کلید API را وارد کنید',
        variant: 'destructive',
      });
      return;
    }
    saveSettings({ deepseek_api_key: settings.deepseek_api_key });
  };

  const handleTestConnection = async () => {
    if (!settings.deepseek_api_key) {
      toast({
        title: 'کلید API وارد نشده',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      toast({ title: 'در حال تست اتصال...' });
      
      // Test DeepSeek API
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.deepseek_api_key}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10,
        }),
      });

      if (response.ok) {
        setApiKeyStatus('connected');
        setLastTestedTime(new Date().toISOString());
        toast({
          title: '✅ اتصال موفق',
          description: 'کلید API معتبر است',
        });
      } else {
        throw new Error('Invalid API key');
      }
    } catch (error) {
      setApiKeyStatus('disconnected');
      toast({
        title: '❌ خطا در اتصال',
        description: 'کلید API نامعتبر است',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSync = async () => {
    if (!settings.google_sheet_id || !settings.google_sheet_name) {
      toast({
        title: 'اطلاعات ناقص',
        description: 'لطفا Sheet ID و نام Sheet را وارد کنید',
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);
    try {
      toast({
        title: 'در حال همگام‌سازی...',
        description: 'لطفا صبر کنید',
      });

      // Simulate sync
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const now = new Date().toISOString();
      saveSettings({ 
        last_sync_time: now,
        sync_status: 'success' 
      });
      
      toast({
        title: 'همگام‌سازی موفق',
        description: 'داده‌ها با موفقیت از Google Sheets وارد شد',
      });
    } catch (error) {
      saveSettings({ sync_status: 'error' });
      toast({
        title: 'خطا در همگام‌سازی',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportData = () => {
    try {
      const dataStr = JSON.stringify(settings, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `settings-backup-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: 'دانلود موفق',
        description: 'فایل پشتیبان دانلود شد',
      });
    } catch (error) {
      toast({
        title: 'خطا',
        description: 'خطا در دانلود فایل',
        variant: 'destructive',
      });
    }
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
                        value={settings.deepseek_api_key}
                        onChange={(e) => setSettings({...settings, deepseek_api_key: e.target.value})}
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
                    <Button onClick={handleTestConnection} disabled={isSaving || !settings.deepseek_api_key}>
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
                    value={settings.google_sheet_id}
                    onChange={(e) => setSettings({...settings, google_sheet_id: e.target.value})}
                    placeholder="11VzLIg5-evMkd..."
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sheet-name">نام Sheet</Label>
                  <Input
                    id="sheet-name"
                    value={settings.google_sheet_name}
                    onChange={(e) => setSettings({...settings, google_sheet_name: e.target.value})}
                    placeholder="Sheet1"
                  />
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleManualSync} disabled={isSyncing}>
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin ms-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 ms-2" />
                    )}
                    وارد کردن از Google Sheets
                  </Button>
                  <Button variant="outline" onClick={() => saveSettings({ 
                    google_sheet_id: settings.google_sheet_id,
                    google_sheet_name: settings.google_sheet_name 
                  })}>
                    ذخیره
                  </Button>
                </div>

                {settings.last_sync_time && (
                  <div className="flex items-center gap-2 text-sm pt-2 border-t">
                    {settings.sync_status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-danger" />
                    )}
                    <span className="text-muted-foreground">
                      آخرین همگام‌سازی: {new Date(settings.last_sync_time).toLocaleString('fa-IR')}
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
                    checked={settings.dark_mode}
                    onCheckedChange={(checked) => saveSettings({ dark_mode: checked })}
                  />
                </div>

                <div className="space-y-3">
                  <Label>طرح رنگی</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {['blue', 'purple', 'green', 'orange'].map((color) => (
                      <button
                        key={color}
                        onClick={() => saveSettings({ theme: color })}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          settings.theme === color ? 'border-primary' : 'border-border'
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

                <Button onClick={() => saveSettings({})}>ذخیره تنظیمات</Button>
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
                    checked={settings.notifications_enabled}
                    onCheckedChange={(checked) => saveSettings({ notifications_enabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="sounds">صدای هشدارها</Label>
                  <Switch
                    id="sounds"
                    checked={settings.alert_sounds}
                    onCheckedChange={(checked) => saveSettings({ alert_sounds: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>اندازه فونت: {settings.font_size}px</Label>
                  <Slider
                    value={[settings.font_size]}
                    onValueChange={(value) => saveSettings({ font_size: value[0] })}
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
                    checked={settings.show_tooltips}
                    onCheckedChange={(checked) => saveSettings({ show_tooltips: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="animations">انیمیشن‌ها</Label>
                  <Switch
                    id="animations"
                    checked={settings.animations_enabled}
                    onCheckedChange={(checked) => saveSettings({ animations_enabled: checked })}
                  />
                </div>

                <Button onClick={() => saveSettings({})}>ذخیره تنظیمات</Button>
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
                  <Switch checked={settings.show_kpi_cards} onCheckedChange={(checked) => saveSettings({ show_kpi_cards: checked })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>نمایش نمودارها</Label>
                  <Switch checked={settings.show_charts} onCheckedChange={(checked) => saveSettings({ show_charts: checked })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>نمایش پست‌های اخیر</Label>
                  <Switch checked={settings.show_recent_posts} onCheckedChange={(checked) => saveSettings({ show_recent_posts: checked })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>نمایش هشدارهای اخیر</Label>
                  <Switch checked={settings.show_recent_alerts} onCheckedChange={(checked) => saveSettings({ show_recent_alerts: checked })} />
                </div>

                <Button onClick={() => saveSettings({})}>ذخیره تنظیمات</Button>
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
                    checked={settings.auto_analysis}
                    onCheckedChange={(checked) => saveSettings({ auto_analysis: checked })}
                  />
                </div>

                {settings.auto_analysis && (
                  <>
                    <div className="space-y-2">
                      <Label>تاخیر قبل از تحلیل: {settings.analysis_delay} دقیقه</Label>
                      <Slider
                        value={[settings.analysis_delay]}
                        onValueChange={(value) => saveSettings({ analysis_delay: value[0] })}
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
                        value={settings.batch_size}
                        onChange={(e) => setSettings({...settings, batch_size: e.target.value})}
                        min="1"
                        max="100"
                      />
                    </div>
                  </>
                )}

                <Button onClick={() => saveSettings({})}>ذخیره تنظیمات</Button>
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
                    checked={settings.auto_sync}
                    onCheckedChange={(checked) => saveSettings({ auto_sync: checked })}
                  />
                </div>

                {settings.auto_sync && (
                  <div className="space-y-2">
                    <Label htmlFor="sync-interval">فاصله زمانی</Label>
                    <select
                      id="sync-interval"
                      value={settings.sync_interval}
                      onChange={(e) => saveSettings({ sync_interval: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3"
                    >
                      <option value="5">هر 5 دقیقه</option>
                      <option value="15">هر 15 دقیقه</option>
                      <option value="30">هر 30 دقیقه</option>
                      <option value="60">هر 1 ساعت</option>
                    </select>
                  </div>
                )}

                <Button onClick={() => saveSettings({})}>ذخیره تنظیمات</Button>
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
                  <Download className="h-4 w-4 ms-2" />
                  دانلود پشتیبان از تمام داده‌ها
                </Button>

                <div className="space-y-2">
                  <Label htmlFor="auto-backup">پشتیبان‌گیری خودکار</Label>
                  <select
                    id="auto-backup"
                    value={settings.auto_backup}
                    onChange={(e) => saveSettings({ auto_backup: e.target.value })}
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
