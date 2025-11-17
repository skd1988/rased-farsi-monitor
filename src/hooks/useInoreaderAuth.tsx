/**
 * =====================================================
 * INOREADER AUTH HOOK - Auto Token Management
 * سیستم AFTAB Intelligence System
 * =====================================================
 * 
 * این Hook مسئولیت‌های زیر را دارد:
 * 1. بررسی خودکار وضعیت Token
 * 2. Auto-refresh قبل از expire شدن
 * 3. مدیریت Session و Error Handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface InoreaderAuthState {
  isConnected: boolean;
  isChecking: boolean;
  needsRefresh: boolean;
  expiresAt?: string;
  lastChecked?: Date;
}

export const useInoreaderAuth = () => {
  const [state, setState] = useState<InoreaderAuthState>({
    isConnected: false,
    isChecking: true,
    needsRefresh: false
  });

  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const checkIntervalRef = useRef<NodeJS.Timeout>();

  /**
   * بررسی وضعیت اتصال
   */
  const checkStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'validate' }
      });

      if (error) throw error;

      const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
      const now = new Date();
      
      // محاسبه زمان باقی‌مانده تا expire
      const timeUntilExpiry = expiresAt ? expiresAt.getTime() - now.getTime() : 0;
      const needsRefresh = timeUntilExpiry > 0 && timeUntilExpiry < 10 * 60 * 1000; // کمتر از 10 دقیقه

      setState({
        isConnected: data.isValid,
        isChecking: false,
        needsRefresh,
        expiresAt: data.expiresAt,
        lastChecked: now
      });

      // اگر نیاز به refresh داره، خودکار انجام بده
      if (needsRefresh && data.isValid) {
        console.log('🔄 Token needs refresh, auto-refreshing...');
        await refreshToken();
      }

      // برنامه‌ریزی refresh بعدی
      scheduleNextRefresh(timeUntilExpiry);

      return data;
    } catch (error: any) {
      console.error('❌ Error checking status:', error);
      setState(prev => ({
        ...prev,
        isConnected: false,
        isChecking: false
      }));
      return null;
    }
  }, []);

  /**
   * تمدید خودکار Token
   */
  const refreshToken = useCallback(async () => {
    try {
      console.log('🔄 Refreshing Inoreader token...');
      
      const { data, error } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'refresh' }
      });

      if (error) throw error;

      toast({
        title: '✅ تمدید موفق',
        description: 'اتصال به Inoreader تمدید شد',
      });

      // بررسی مجدد وضعیت
      await checkStatus();

      return true;
    } catch (error: any) {
      console.error('❌ Token refresh failed:', error);
      
      toast({
        title: '⚠️ خطا در تمدید',
        description: 'لطفاً دوباره به Inoreader متصل شوید',
        variant: 'destructive'
      });

      setState(prev => ({
        ...prev,
        isConnected: false,
        needsRefresh: false
      }));

      return false;
    }
  }, [checkStatus]);

  /**
   * برنامه‌ریزی refresh بعدی
   */
  const scheduleNextRefresh = useCallback((timeUntilExpiry: number) => {
    // پاک کردن timeout قبلی
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    if (timeUntilExpiry <= 0) return;

    // Refresh کن 5 دقیقه قبل از expire شدن
    const refreshTime = Math.max(0, timeUntilExpiry - 5 * 60 * 1000);

    console.log(`⏰ Next refresh scheduled in ${Math.round(refreshTime / 1000 / 60)} minutes`);

    refreshTimeoutRef.current = setTimeout(async () => {
      await refreshToken();
    }, refreshTime);
  }, [refreshToken]);

  /**
   * بررسی دوره‌ای وضعیت (هر 5 دقیقه)
   */
  useEffect(() => {
    // بررسی اولیه
    checkStatus();

    // بررسی دوره‌ای هر 5 دقیقه
    checkIntervalRef.current = setInterval(() => {
      checkStatus();
    }, 5 * 60 * 1000);

    // پاکسازی
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkStatus]);

  /**
   * بررسی وضعیت هنگام focus شدن صفحه
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // وقتی کاربر برگشت به tab، وضعیت رو چک کن
        checkStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkStatus]);

  /**
   * قطع اتصال
   */
  const disconnect = useCallback(async () => {
    if (!confirm('آیا مطمئن هستید؟ اتصال به Inoreader قطع خواهد شد.')) {
      return false;
    }

    try {
      const { error } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'disconnect' }
      });

      if (error) throw error;

      // پاک کردن تمام timer‌ها
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }

      setState({
        isConnected: false,
        isChecking: false,
        needsRefresh: false
      });

      toast({
        title: '✅ موفق',
        description: 'اتصال به Inoreader قطع شد'
      });

      return true;
    } catch (error: any) {
      toast({
        title: '❌ خطا',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    }
  }, []);

  /**
   * اتصال به Inoreader
   */
  const connect = useCallback(async () => {
    try {
      const REDIRECT_URI = window.location.hostname === 'localhost'
        ? 'http://localhost:5173/oauth-callback.html'
        : 'https://skd1988.github.io/rased-farsi-monitor/oauth-callback.html';

      const { data, error } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'authorize', redirectUri: REDIRECT_URI }
      });

      if (error) throw error;

      // ذخیره state برای بعد از redirect
      sessionStorage.setItem('inoreader_connecting', 'true');

      // Redirect به صفحه OAuth
      window.location.href = data.authUrl;

      return true;
    } catch (error: any) {
      toast({
        title: '❌ خطا',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    }
  }, []);

  /**
   * تکمیل OAuth callback
   */
  const handleCallback = useCallback(async (code: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'exchange', code }
      });

      if (error) throw error;

      // پاک کردن state
      sessionStorage.removeItem('inoreader_connecting');

      toast({
        title: '✅ موفق',
        description: data.message
      });

      // بررسی وضعیت جدید
      await checkStatus();

      return true;
    } catch (error: any) {
      sessionStorage.removeItem('inoreader_connecting');
      
      toast({
        title: '❌ خطا در اتصال',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    }
  }, [checkStatus]);

  return {
    ...state,
    checkStatus,
    refreshToken,
    disconnect,
    connect,
    handleCallback
  };
};
