import { useState, useCallback } from 'react';
import { settingsService } from '../services/settingsService';
import { AppSettings, SettingsUpdate } from '../types/settings.types';
import { toast } from 'sonner';

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(() => settingsService.load());
  const [isSaving, setIsSaving] = useState(false);

  const updateSettings = useCallback((updates: SettingsUpdate, showToast = true) => {
    try {
      setIsSaving(true);

      setSettings(prev => {
        const newSettings = { ...prev, ...updates };
        settingsService.save(updates);
        return newSettings;
      });

      if (showToast) {
        toast.success('تنظیمات ذخیره شد');
      }

    } catch (error) {
      console.error('[useSettings] Error:', error);
      toast.error('خطا در ذخیره تنظیمات');
    } finally {
      setIsSaving(false);
    }
  }, []);

  const setSetting = useCallback(<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
    showToast = false
  ) => {
    updateSettings({ [key]: value } as SettingsUpdate, showToast);
  }, [updateSettings]);

  const resetSettings = useCallback(() => {
    settingsService.reset();
    setSettings(settingsService.load());
    toast.success('تنظیمات به حالت پیش‌فرض بازگشت');
  }, []);

  return {
    settings,
    isSaving,
    updateSettings,
    setSetting,
    resetSettings,
  };
};
