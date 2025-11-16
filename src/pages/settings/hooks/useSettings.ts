import { useState, useCallback, useEffect } from 'react';
import { settingsService } from '../services/settingsService';
import { AppSettings, SettingsUpdate } from '../types/settings.types';
import { toast } from 'sonner';

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(() => settingsService.load());
  const [isSaving, setIsSaving] = useState(false);

  const updateSettings = useCallback((updates: SettingsUpdate, showToast = true) => {
    try {
      setIsSaving(true);

      // ✅ FIX: اول save کن، بعد state رو آپدیت کن
      settingsService.save(updates);

      // ✅ FIX: state رو با load کامل آپدیت کن
      const newSettings = settingsService.load();
      setSettings(newSettings);

      if (showToast) {
        toast.success('تنظیمات ذخیره شد');
      }

      console.log('[useSettings] Settings updated:', updates);

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
    console.log('[useSettings] setSetting called:', key, value);
    updateSettings({ [key]: value } as SettingsUpdate, showToast);
  }, [updateSettings]);

  const resetSettings = useCallback(() => {
    try {
      settingsService.reset();
      const defaults = settingsService.load();
      setSettings(defaults);
      toast.success('تنظیمات به حالت پیش‌فرض بازگشت');
    } catch (error) {
      console.error('[useSettings] Error resetting:', error);
      toast.error('خطا در بازنشانی تنظیمات');
    }
  }, []);

  // ✅ FIX: اضافه کردن effect برای sync با localStorage
  useEffect(() => {
    console.log('[useSettings] Current settings:', settings);
  }, [settings]);

  // ✅ FIX: اعمال تغییرات ظاهری به document
  useEffect(() => {
    // Dark Mode
    if (settings.dark_mode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Font Size
    document.documentElement.style.fontSize = `${settings.font_size}px`;

    // Theme Color (اضافه کردن data attribute برای theme)
    document.documentElement.setAttribute('data-theme', settings.theme);

    console.log('[useSettings] Applied UI changes:', {
      dark_mode: settings.dark_mode,
      theme: settings.theme,
      font_size: settings.font_size
    });
  }, [settings.dark_mode, settings.theme, settings.font_size]);

  return {
    settings,
    isSaving,
    updateSettings,
    setSetting,
    resetSettings,
  };
};
