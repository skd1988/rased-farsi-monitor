/**
 * =====================================================
 * INOREADER AUTH HOOK - Backend-driven Token Status
 * سیستم AFTAB Intelligence System
 * =====================================================
 *
 * این Hook اکنون فقط وضعیت را از بک‌اند می‌خواند و عملیات حساس
 * (تبادل Token، تمدید و مدیریت) همگی در Edge Functions انجام می‌شود.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface InoreaderAuthState {
  isConnected: boolean;
  isChecking: boolean;
  needsRefresh: boolean;
  expiresAt?: string;
  lastChecked?: Date;
  lastRefreshAt?: string;
  createdAt?: string;
}

export const useInoreaderAuth = () => {
  const [state, setState] = useState<InoreaderAuthState>({
    isConnected: false,
    isChecking: true,
    needsRefresh: false
  });

  /**
   * بررسی وضعیت اتصال از طریق بک‌اند
   */
  const checkStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'validate' }
      });

      if (error) throw error;

      const expiresAt = data?.expiresAt ? new Date(data.expiresAt) : null;
      const now = new Date();

      const timeUntilExpiry = expiresAt ? expiresAt.getTime() - now.getTime() : null;
      const needsRefresh = !!timeUntilExpiry && timeUntilExpiry > 0 && timeUntilExpiry < 60 * 60 * 1000;

      setState({
        isConnected: !!data?.isValid,
        isChecking: false,
        needsRefresh,
        expiresAt: data?.expiresAt,
        lastChecked: now,
        lastRefreshAt: data?.lastRefreshAt,
        createdAt: data?.createdAt
      });

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
   * تمدید دستی Token از طریق بک‌اند
   */
  const refreshToken = useCallback(async () => {
    try {
      console.log('🔄 Refreshing Inoreader token...');

      const { data, error } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'ensure-valid' }
      });

      if (error) throw error;

      toast({
        title: '✅ تمدید موفق',
        description: 'اتصال به Inoreader تمدید شد',
      });

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
   * بررسی اولیه وضعیت
   */
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  /**
   * بررسی وضعیت هنگام focus شدن صفحه
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
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

      sessionStorage.setItem('inoreader_connecting', 'true');

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

      sessionStorage.removeItem('inoreader_connecting');

      toast({
        title: '✅ موفق',
        description: data.message
      });

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
