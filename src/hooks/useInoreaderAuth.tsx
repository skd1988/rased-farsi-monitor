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
  ok: boolean;
  isConnected: boolean;
  isExpired: boolean;
  needsReconnect: boolean;
  hasRefreshToken: boolean;
  canAutoRefresh: boolean;
  expiresAt: string | null;
  secondsToExpiry: number | null;
  error?: { message: string; code?: string } | null;
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

      const normalizedStatus: InoreaderStatusResponse = {
        ok: data?.ok ?? false,
        isConnected: data?.isConnected ?? false,
        isExpired: data?.isExpired ?? false,
        needsReconnect: data?.needsReconnect ?? false,
        hasRefreshToken: data?.hasRefreshToken ?? false,
        canAutoRefresh: data?.canAutoRefresh ?? false,
        expiresAt: data?.expiresAt ?? null,
        secondsToExpiry: data?.secondsToExpiry ?? null,
        error: data?.error ?? null,
      };

      setStatus(normalizedStatus);
      setError(normalizedStatus.ok ? null : normalizedStatus.error?.message ?? null);
    } catch (err: any) {
      console.error('❌ Error checking status:', err);
      setStatus({
        ok: false,
        isConnected: false,
        isExpired: false,
        needsReconnect: true,
        hasRefreshToken: false,
        canAutoRefresh: false,
        expiresAt: null,
        secondsToExpiry: null,
        error: { message: err.message || 'خطا در دریافت وضعیت' }
      });
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
    connected: status?.isConnected ?? false,
    statusReason: (() => {
      if (!status) return 'unknown';
      if (!status.ok) return 'status_error';
      if (!status.isConnected) return 'no_token';
      if (status.isExpired && status.canAutoRefresh) return 'expired_auto_refresh';
      if (status.isExpired) return 'expired';
      return 'connected';
    })(),
    status,
    isExpired: status?.isExpired ?? false,
    canAutoRefresh: status?.canAutoRefresh ?? false,
    needsReconnect: status?.needsReconnect ?? false,
    expiresAt: status?.expiresAt ?? null,
    loading,
    error,
    refreshStatus,
    disconnect,
    connect,
    handleCallback
  };
};
