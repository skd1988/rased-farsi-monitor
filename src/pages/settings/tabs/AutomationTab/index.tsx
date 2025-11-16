import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '../../hooks/useSettings';
import { SYNC_INTERVALS, BATCH_SIZES } from '../../constants/options';
import { Zap, Brain, Database, Trash2, Clock, Package, Calendar, Archive } from 'lucide-react';

export const AutomationTab = () => {
  const { settings, setSetting } = useSettings();

  return (
    <div className="space-y-6">
      {/* AI Analysis Automation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            تحلیل هوشمند خودکار
          </CardTitle>
          <CardDescription>
            تنظیمات تحلیل خودکار محتوا با هوش مصنوعی
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto Analysis Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">تحلیل خودکار</Label>
              <p className="text-sm text-muted-foreground">
                فعال‌سازی تحلیل خودکار مطالب جدید
              </p>
            </div>
            <Switch
              checked={settings.auto_analysis}
              onCheckedChange={(checked) => setSetting('auto_analysis', checked, true)}
            />
          </div>

          {/* Analysis Delay */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              تاخیر بین تحلیل‌ها (دقیقه)
            </Label>
            <Select
              value={String(settings.analysis_delay)}
              onValueChange={(value) => setSetting('analysis_delay', Number(value), true)}
              disabled={!settings.auto_analysis}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 دقیقه</SelectItem>
                <SelectItem value="5">5 دقیقه</SelectItem>
                <SelectItem value="10">10 دقیقه</SelectItem>
                <SelectItem value="15">15 دقیقه</SelectItem>
                <SelectItem value="30">30 دقیقه</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              فاصله زمانی بین هر دور تحلیل
            </p>
          </div>

          {/* Batch Size */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              تعداد مطالب در هر دسته
            </Label>
            <Select
              value={settings.batch_size}
              onValueChange={(value) => setSetting('batch_size', value, true)}
              disabled={!settings.auto_analysis}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BATCH_SIZES.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              تعداد مطالبی که در هر دور تحلیل می‌شوند
            </p>
          </div>

          {/* Analysis Schedule */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              نوع زمان‌بندی
            </Label>
            <Select
              value={settings.analysis_schedule}
              onValueChange={(value: any) => setSetting('analysis_schedule', value, true)}
              disabled={!settings.auto_analysis}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">دستی - فقط با کلیک دکمه</SelectItem>
                <SelectItem value="immediate">فوری - بلافاصله بعد از ورود</SelectItem>
                <SelectItem value="delayed">تاخیری - با فاصله زمانی مشخص</SelectItem>
                <SelectItem value="scheduled">زمان‌بندی شده - در ساعات مشخص</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Google Sheets Sync Automation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            همگام‌سازی خودکار Google Sheets
          </CardTitle>
          <CardDescription>
            تنظیمات همگام‌سازی خودکار با Google Sheets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto Sync Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">همگام‌سازی خودکار</Label>
              <p className="text-sm text-muted-foreground">
                فعال‌سازی همگام‌سازی خودکار با Google Sheets
              </p>
            </div>
            <Switch
              checked={settings.auto_sync}
              onCheckedChange={(checked) => setSetting('auto_sync', checked, true)}
            />
          </div>

          {/* Sync Interval */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              فاصله زمانی همگام‌سازی
            </Label>
            <Select
              value={settings.sync_interval}
              onValueChange={(value) => setSetting('sync_interval', value, true)}
              disabled={!settings.auto_sync}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYNC_INTERVALS.map((interval) => (
                  <SelectItem key={interval.value} value={interval.value}>
                    {interval.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              چند دقیقه یکبار داده‌ها همگام‌سازی شوند
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Cleanup Automation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            پاکسازی خودکار داده‌ها
          </CardTitle>
          <CardDescription>
            تنظیمات پاکسازی خودکار مطالب قدیمی
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto Cleanup Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">پاکسازی خودکار</Label>
              <p className="text-sm text-muted-foreground">
                فعال‌سازی پاکسازی خودکار مطالب قدیمی
              </p>
            </div>
            <Switch
              checked={settings.auto_cleanup}
              onCheckedChange={(checked) => setSetting('auto_cleanup', checked, true)}
            />
          </div>

          {/* Keep Posts For */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              نگهداری مطالب
            </Label>
            <Select
              value={settings.keep_posts_for}
              onValueChange={(value) => setSetting('keep_posts_for', value, true)}
              disabled={!settings.auto_cleanup}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 روز</SelectItem>
                <SelectItem value="60">60 روز</SelectItem>
                <SelectItem value="90">90 روز</SelectItem>
                <SelectItem value="180">180 روز (6 ماه)</SelectItem>
                <SelectItem value="365">365 روز (1 سال)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              مطالب قدیمی‌تر از این مدت حذف می‌شوند
            </p>
          </div>

          {/* Archive Before Delete */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <Archive className="h-4 w-4" />
                آرشیو قبل از حذف
              </Label>
              <p className="text-sm text-muted-foreground">
                مطالب مهم قبل از حذف آرشیو شوند
              </p>
            </div>
            <Switch
              checked={settings.archive_before_delete}
              onCheckedChange={(checked) => setSetting('archive_before_delete', checked, true)}
              disabled={!settings.auto_cleanup}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AutomationTab;
