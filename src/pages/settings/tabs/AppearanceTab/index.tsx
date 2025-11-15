import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useSettings } from '../../hooks/useSettings';
import { THEMES, LANGUAGES } from '../../constants/options';
import { Palette, Moon, Sun, Type, Sparkles, Eye } from 'lucide-react';

export const AppearanceTab = () => {
  const { settings, setSetting } = useSettings();

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            تم رنگی
          </CardTitle>
          <CardDescription>انتخاب رنگ اصلی رابط کاربری</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                onClick={() => setSetting('theme', theme.value)}
                className={`
                  relative p-4 rounded-lg border-2 transition-all
                  ${settings.theme === theme.value
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50'
                  }
                `}
              >
                <div
                  className="w-full h-12 rounded-md mb-2"
                  style={{ backgroundColor: theme.color }}
                />
                <p className="text-sm font-medium text-center">{theme.label}</p>
                {settings.theme === theme.value && (
                  <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dark Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            حالت نمایش
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">حالت تاریک</Label>
              <p className="text-sm text-muted-foreground">
                استفاده از تم تاریک برای کاهش فشار چشم
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!settings.dark_mode && <Sun className="h-4 w-4 text-muted-foreground" />}
              <Switch
                checked={settings.dark_mode}
                onCheckedChange={(checked) => setSetting('dark_mode', checked)}
              />
              {settings.dark_mode && <Moon className="h-4 w-4 text-primary" />}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Font Size */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            اندازه فونت
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>اندازه فونت: {settings.font_size}px</Label>
            </div>

            <Slider
              value={[settings.font_size]}
              onValueChange={(value) => setSetting('font_size', value[0])}
              min={12}
              max={20}
              step={2}
              className="w-full"
            />

            <div className="pt-2">
              <p
                className="text-muted-foreground"
                style={{ fontSize: `${settings.font_size}px` }}
              >
                نمونه متن با اندازه انتخاب شده
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UI Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            ترجیحات نمایش
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>نمایش راهنماها</Label>
              <p className="text-sm text-muted-foreground">نمایش tooltips</p>
            </div>
            <Switch
              checked={settings.show_tooltips}
              onCheckedChange={(checked) => setSetting('show_tooltips', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>انیمیشن‌ها</Label>
              <p className="text-sm text-muted-foreground">فعال‌سازی انیمیشن‌ها</p>
            </div>
            <Switch
              checked={settings.animations_enabled}
              onCheckedChange={(checked) => setSetting('animations_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            نمایش در داشبورد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label>کارت‌های KPI</Label>
              <Switch
                checked={settings.show_kpi_cards}
                onCheckedChange={(checked) => setSetting('show_kpi_cards', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>نمودارها</Label>
              <Switch
                checked={settings.show_charts}
                onCheckedChange={(checked) => setSetting('show_charts', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>مطالب اخیر</Label>
              <Switch
                checked={settings.show_recent_posts}
                onCheckedChange={(checked) => setSetting('show_recent_posts', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>هشدارهای اخیر</Label>
              <Switch
                checked={settings.show_recent_alerts}
                onCheckedChange={(checked) => setSetting('show_recent_alerts', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppearanceTab;
