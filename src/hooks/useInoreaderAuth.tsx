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

type InoreaderStatusResponse = {
  connected: boolean;
  reason: string;
  expiresAt?: string | null;
};

export const useInoreaderAuth = () => {
  const [status, setStatus] = useState<InoreaderStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const { data, error: statusError } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'status' }
      });

      if (statusError) throw statusError;

      setStatus({
        connected: !!data?.connected,
        reason: data?.reason ?? 'unknown',
        expiresAt: data?.expiresAt ?? null,
      });
      setError(null);
    } catch (err: any) {
      console.error('❌ Error checking status:', err);
      setStatus({ connected: false, reason: 'error' });
      setError(err.message || 'خطا در دریافت وضعیت');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshStatus]);

  const disconnect = useCallback(async () => {
    if (!confirm('آیا مطمئن هستید؟ اتصال به Inoreader قطع خواهد شد.')) {
      return false;
    }

    try {
      const { error: disconnectError } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'disconnect' }
      });

      if (disconnectError) throw disconnectError;

      setStatus({ connected: false, reason: 'no_session', expiresAt: null });
      setLoading(false);

      toast({
        title: '✅ موفق',
        description: 'اتصال به Inoreader قطع شد'
      });

      return true;
    } catch (err: any) {
      toast({
        title: '❌ خطا',
        description: err.message,
        variant: 'destructive',
      });
      return false;
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      const REDIRECT_URI = window.location.hostname === 'localhost'
        ? 'http://localhost:5173/oauth-callback.html'
        : 'https://skd1988.github.io/rased-farsi-monitor/oauth-callback.html';

      const { data, error: authorizeError } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'authorize', redirectUri: REDIRECT_URI }
      });

      if (authorizeError) throw authorizeError;

      sessionStorage.setItem('inoreader_connecting', 'true');

      window.location.href = data.authUrl;

      return true;
    } catch (err: any) {
      toast({
        title: '❌ خطا',
        description: err.message,
        variant: 'destructive'
      });
      return false;
    }
  }, []);

  const handleCallback = useCallback(async (code: string) => {
    try {
      const { data, error: exchangeError } = await supabase.functions.invoke('inoreader-oauth-manager', {
        body: { action: 'exchange', code }
      });

      if (exchangeError) throw exchangeError;

      sessionStorage.removeItem('inoreader_connecting');

      toast({
        title: '✅ موفق',
        description: data.message
      });

      await refreshStatus();

      return true;
    } catch (err: any) {
      sessionStorage.removeItem('inoreader_connecting');

      toast({
        title: '❌ خطا در اتصال',
        description: err.message,
        variant: 'destructive'
      });
      return false;
    }
  }, [refreshStatus]);

  return {
    connected: status?.connected ?? false,
    statusReason: status?.reason ?? 'unknown',
    expiresAt: status?.expiresAt ?? null,
    loading,
    error,
    refreshStatus,
    disconnect,
    connect,
    handleCallback
  };
};
