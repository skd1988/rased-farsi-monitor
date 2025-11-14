import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';

type UserRole = 'super_admin' | 'admin' | 'analyst' | 'viewer' | 'guest';
type UserStatus = 'active' | 'suspended' | 'inactive';
type LimitType = 'aiAnalysis' | 'chatMessages' | 'exports';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  preferences: {
    language: 'fa' | 'en';
    theme: 'light' | 'dark';
    notifications: boolean;
  };
  dailyLimits: {
    aiAnalysis: number;
    chatMessages: number;
    exports: number;
  };
  usageToday: {
    aiAnalysis: number;
    chatMessages: number;
    exports: number;
  };
  lastLogin: string | null;
  createdAt: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  canPerform: (action: string, resourceType?: string, resourceId?: string) => Promise<boolean>;
  checkDailyLimit: (limitType: LimitType) => boolean;
  incrementUsage: (limitType: LimitType) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PERMISSIONS = {
  VIEW_POSTS: ['super_admin', 'admin', 'analyst', 'viewer', 'guest'],
  EDIT_POSTS: ['super_admin', 'admin'],
  DELETE_POSTS: ['super_admin', 'admin'],
  EDIT_OWN_POSTS: ['super_admin', 'admin', 'analyst'],
  REQUEST_AI_ANALYSIS: ['super_admin', 'admin', 'analyst'],
  VIEW_ALERTS: ['super_admin', 'admin', 'analyst', 'viewer'],
  CREATE_ALERTS: ['super_admin', 'admin', 'analyst'],
  EDIT_ALL_ALERTS: ['super_admin', 'admin'],
  EDIT_OWN_ALERTS: ['super_admin', 'admin', 'analyst'],
  MANAGE_USERS: ['super_admin'],
  INVITE_USERS: ['super_admin', 'admin'],
  MANAGE_SETTINGS: ['super_admin'],
  MANAGE_API_KEYS: ['super_admin'],
  VIEW_API_USAGE: ['super_admin', 'admin'],
  EXPORT_DATA: ['super_admin', 'admin', 'analyst', 'viewer'],
  USE_CHAT: ['super_admin', 'admin', 'analyst', 'viewer'],
};

const INACTIVITY_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
const WARNING_BEFORE_LOGOUT = 5 * 60 * 1000; // 5 minutes
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_LOADING_TIME = 15000; // 15 seconds
const RETRY_DELAYS = [500, 1000, 2000]; // Retry delays in ms

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [sessionWarningShown, setSessionWarningShown] = useState(false);

  // Refs to track loading state and prevent infinite loops
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  const retryCountRef = useRef(0);

  // Clear any corrupted auth state from localStorage - REMOVED
  // This function was too aggressive and was clearing valid sessions
  // Instead, we rely on supabase.auth.signOut() which properly clears auth state
  const clearCorruptedAuthState = useCallback(() => {
    console.log('[AuthContext] Attempting to sign out and clear auth state');
    try {
      // Use Supabase's built-in signOut which properly clears the session
      supabase.auth.signOut().then(() => {
        toast.info('حالت احراز هویت بازنشانی شد. لطفاً دوباره وارد شوید.');
      }).catch((error) => {
        console.error('[AuthContext] Error during signOut:', error);
        toast.error('خطا در خروج از سیستم');
      });
    } catch (error) {
      console.error('[AuthContext] Error clearing auth state:', error);
    }
  }, []);

  const fetchUserData = useCallback(async (
    authUser: SupabaseUser,
    retryCount = 0,
    skipSessionCheck = false
  ): Promise<User | null> => {
    console.log('[AuthContext] 🚀 fetchUserData START', {
      email: authUser.email,
      id: authUser.id,
      retry: retryCount,
      skipSessionCheck
    });

    // Maximum retries and timeout
    const MAX_RETRIES = 3;
    const RPC_TIMEOUT = 5000; // 5 seconds

    try {
      // Only delay on retries (optimized delays)
      if (retryCount > 0) {
        const OPTIMIZED_DELAYS = [200, 500, 1000];
        const delay = OPTIMIZED_DELAYS[Math.min(retryCount - 1, OPTIMIZED_DELAYS.length - 1)];
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Only verify session if not skipped (skip after fresh login)
      if (!skipSessionCheck) {
        const { error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('[AuthContext] Session verification failed:', sessionError);
          throw new Error('جلسه معتبر نیست');
        }
      }

      // RPC call with explicit timeout and error handling
      console.log('[AuthContext] 📊 Calling get_user_with_details RPC with timeout...');

      let data, error;
      try {
        const timeoutMs = RPC_TIMEOUT;
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('RPC_TIMEOUT')), timeoutMs);
        });

        const rpcPromise = supabase.rpc('get_user_with_details', {
          p_user_id: authUser.id
        });

        const response = await Promise.race([rpcPromise, timeoutPromise]) as any;
        data = response.data;
        error = response.error;

        console.log('[AuthContext] 📥 RPC completed', {
          hasData: !!data,
          hasError: !!error,
          errorMessage: error?.message
        });
      } catch (err: any) {
        console.error('[AuthContext] 🔥 RPC call failed:', err);

        if (err.message === 'RPC_TIMEOUT') {
          console.log('[AuthContext] ⏱️ RPC timeout - will retry');
          throw new Error('timeout');
        }
        throw err;
      }

      console.log('[AuthContext] 📥 RPC Response:', {
        hasData: !!data,
        error: error?.message,
        dataType: Array.isArray(data) ? 'array' : typeof data,
        dataKeys: data ? (Array.isArray(data) ? Object.keys(data[0] || {}) : Object.keys(data)) : []
      });
      console.log('[AuthContext] 🔍 Raw RPC Data:', JSON.stringify(data));

      if (error) {
        console.error('[AuthContext] ❌ Database error:', error);

        if (error.message.includes('permission') && retryCount < 2) {
          console.log('[AuthContext] Retrying due to permissions error...');
          return fetchUserData(authUser, retryCount + 1, skipSessionCheck);
        }

        throw new Error('خطا در بارگذاری اطلاعات: ' + error.message);
      }

      if (!data) {
        console.error('[AuthContext] No data returned from database');
        throw new Error('داده‌های کاربر یافت نشد');
      }

      // More detailed logging for structure analysis
      console.log('[AuthContext] 🔍 Data structure analysis:', {
        isArray: Array.isArray(data),
        isEmptyArray: Array.isArray(data) && data.length === 0,
        dataLength: Array.isArray(data) ? data.length : 'N/A',
        dataType: typeof data,
        dataKeys: Array.isArray(data) ?
          (data.length > 0 ? Object.keys(data[0]) : []) :
          Object.keys(data)
      });

      // Parse the returned data from RPC function
      let result;
      if (Array.isArray(data)) {
        if (data.length === 0) {
          console.error('[AuthContext] Empty array returned - user not found in database');
          throw new Error('کاربر در دیتابیس یافت نشد. لطفاً ابتدا ثبت نام کنید.');
        }
        result = data[0];
      } else {
        result = data;
      }

      console.log('[AuthContext] 🔍 Result object properties (flat):', {
        hasId: 'id' in result,
        hasEmail: 'email' in result,
        hasRole: 'role' in result,
        hasFullName: 'full_name' in result,
        resultKeys: Object.keys(result)
      });

      // RPC directly returns flat object - no nested structures
      const userData = {
        id: result.id,
        email: result.email,
        full_name: result.full_name,
        status: result.status,
        preferences: result.preferences,
        last_login: result.last_login,
        created_at: result.created_at,
        updated_at: result.updated_at
      };

      const roleData = result.role;

      const limitsData = {
        ai_analysis: result.daily_ai_analysis_limit,
        chat_messages: result.daily_chat_messages_limit,
        exports: result.daily_exports_limit
      };

      const usageData = {
        ai_analysis: result.daily_ai_analysis_used || 0,
        chat_messages: result.daily_chat_messages_used || 0,
        exports: result.daily_exports_used || 0
      };

      console.log('[AuthContext] 🔍 Parsed data check:', {
        hasUserData: !!userData,
        hasRoleData: !!roleData,
        hasLimitsData: !!limitsData,
        hasUsageData: !!usageData,
        userEmail: userData.email,
        userRole: roleData
      });

      if (!userData.id || !userData.email) {
        console.error('[AuthContext] No user data found in result:', {
          result,
          userData
        });
        throw new Error('پروفایل کاربر یافت نشد');
      }

      if (!roleData) {
        console.error('[AuthContext] No role data found in result:', {
          result,
          role_value: result.role
        });
        throw new Error('نقش کاربر یافت نشد');
      }

      // If limits data is missing, use default values instead of throwing error
      if (!limitsData.ai_analysis && limitsData.ai_analysis !== 0) {
        console.warn('[AuthContext] No limits data found, using defaults:', {
          result,
          limitsData
        });
        limitsData.ai_analysis = 10;
        limitsData.chat_messages = 50;
        limitsData.exports = 20;
      }

      const userObject: User = {
        id: userData.id,
        email: userData.email,
        fullName: userData.full_name,
        role: roleData as UserRole,
        status: userData.status as UserStatus,
        preferences: userData.preferences as User['preferences'],
        dailyLimits: {
          aiAnalysis: limitsData.ai_analysis,
          chatMessages: limitsData.chat_messages,
          exports: limitsData.exports
        },
        usageToday: {
          aiAnalysis: usageData.ai_analysis || 0,
          chatMessages: usageData.chat_messages || 0,
          exports: usageData.exports || 0
        },
        lastLogin: userData.last_login,
        createdAt: userData.created_at
      };

      console.log('[AuthContext] ✅ User object created successfully', {
        email: userObject.email,
        role: userObject.role,
        status: userObject.status
      });

      return userObject;
      
    } catch (error: any) {
      console.error('[AuthContext] FATAL ERROR in fetchUserData:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        retry: retryCount,
        maxRetries: 3
      });

      // Retry logic با حداکثر تعداد
      if (retryCount < 3 &&
          (error?.message?.includes('permission') ||
           error?.message?.includes('timeout') ||
           error?.message?.includes('RPC timeout') ||
           error?.code === 'PGRST301')) {
        console.log(`[AuthContext] Will retry fetchUserData (${retryCount + 1}/3)...`);
        return fetchUserData(authUser, retryCount + 1, skipSessionCheck);
      }

      // بعد از MAX_RETRIES، فقط error بده (نه signOut)
      console.error('[AuthContext] Max retries reached, giving up');
      toast.error('خطا در بارگذاری اطلاعات کاربر. لطفاً صفحه را رفرش کنید.');
      return null;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!session?.user) return;
    const userData = await fetchUserData(session.user);
    if (userData) {
      setUser(userData);
    }
  }, [session, fetchUserData]);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      console.log('[AuthContext] Starting signIn for email:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('[AuthContext] Supabase signIn response:', {
        hasSession: !!data.session,
        hasUser: !!data.user,
        error: error?.message,
        errorCode: error?.code,
        errorStatus: error?.status
      });

      if (error) {
        console.error('[AuthContext] Supabase auth error:', {
          message: error.message,
          code: error.code,
          status: error.status,
          name: error.name
        });
        throw error;
      }

      if (data.session) {
        console.log('[AuthContext] Session created, user ID:', data.user.id);
        setSession(data.session);

        // Skip session check since we just logged in
        console.log('[AuthContext] Fetching user data...');
        const userData = await fetchUserData(data.user, 0, true);

        if (userData) {
          console.log('[AuthContext] User data fetched successfully:', {
            email: userData.email,
            role: userData.role,
            status: userData.status
          });
          setUser(userData);

          // Update last login in background (non-blocking)
          void supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', data.user.id)
            .then(({ error }) => {
              if (error) {
                console.error('[AuthContext] Last login update error:', error);
              } else {
                console.log('[AuthContext] Last login updated');
              }
            });

          setLastActivity(Date.now());
          retryCountRef.current = 0;
          toast.success('خوش آمدید!');
        } else {
          console.error('[AuthContext] Failed to fetch user data');
          throw new Error('خطا در بارگذاری اطلاعات کاربر');
        }
      } else {
        console.error('[AuthContext] No session returned from Supabase');
        throw new Error('خطا در ایجاد نشست');
      }
    } catch (error: any) {
      console.error('[AuthContext] Sign in error:', {
        message: error?.message,
        code: error?.code,
        status: error?.status,
        name: error?.name,
        stack: error?.stack
      });

      // Don't show toast here - let the Login component handle user-facing messages
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      // Clear loading timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      retryCountRef.current = 0;
      isInitializedRef.current = false;
      toast.success('با موفقیت خارج شدید');
    } catch (error) {
      console.error('[AuthContext] Error signing out:', error);
      // If signOut fails, just clear local state and reload
      setUser(null);
      setSession(null);
      window.location.href = '/login';
    }
  };

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    const allowedRoles = PERMISSIONS[permission as keyof typeof PERMISSIONS];
    return allowedRoles ? allowedRoles.includes(user.role) : false;
  }, [user]);

  const canPerform = useCallback(async (
    action: string,
    resourceType?: string,
    resourceId?: string
  ): Promise<boolean> => {
    if (!user) return false;

    // Check if action requires ownership verification
    if (action.includes('OWN') && resourceId && resourceType) {
      try {
        const { data, error } = await supabase
          .from('resource_ownership')
          .select('id')
          .eq('user_id', user.id)
          .eq('resource_type', resourceType)
          .eq('resource_id', resourceId)
          .maybeSingle();

        if (error) return false;
        return hasPermission(action) && !!data;
      } catch {
        return false;
      }
    }

    return hasPermission(action);
  }, [user, hasPermission]);

  const checkDailyLimit = useCallback((limitType: LimitType): boolean => {
    if (!user) return false;

    const limitMap = {
      aiAnalysis: 'aiAnalysis',
      chatMessages: 'chatMessages',
      exports: 'exports'
    };

    const key = limitMap[limitType];
    const limit = user.dailyLimits[key];
    const usage = user.usageToday[key];

    if (limit === -1) return true; // unlimited
    
    const remaining = limit - usage;
    const percentage = (usage / limit) * 100;

    // Show warning at 80%
    if (percentage >= 80 && percentage < 100) {
      toast.warning(`⚠️ شما به ${Math.round(percentage)}% محدودیت روزانه خود رسیده‌اید (${usage}/${limit})`);
    }

    return usage < limit;
  }, [user]);

  const incrementUsage = useCallback(async (limitType: LimitType) => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const columnMap = {
      aiAnalysis: 'ai_analysis',
      chatMessages: 'chat_messages',
      exports: 'exports'
    };

    const column = columnMap[limitType];

    try {
      // Optimistic update
      setUser(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          usageToday: {
            ...prev.usageToday,
            [limitType]: prev.usageToday[limitType] + 1
          }
        };
      });

      // Update in database
      const { error } = await supabase
        .from('user_daily_usage')
        .update({ [column]: user.usageToday[limitType] + 1 })
        .eq('user_id', user.id)
        .eq('usage_date', today);

      if (error) throw error;
    } catch (error) {
      console.error('Error incrementing usage:', error);
      // Revert optimistic update
      await refreshUser();
    }
  }, [user, refreshUser]);

  // Track user activity for session timeout
  useEffect(() => {
    const updateActivity = () => {
      setLastActivity(Date.now());
      setSessionWarningShown(false);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, []);

  // Check for session timeout
  useEffect(() => {
    if (!user || user.role === 'super_admin' || user.role === 'admin') return;

    const checkTimeout = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivity;

      // Show warning 5 minutes before logout
      if (timeSinceActivity >= INACTIVITY_TIMEOUT - WARNING_BEFORE_LOGOUT && !sessionWarningShown) {
        setSessionWarningShown(true);
        toast.warning('نشست شما به زودی منقضی می‌شود. برای ادامه کار یک عملیات انجام دهید.', {
          duration: WARNING_BEFORE_LOGOUT,
          action: {
            label: 'تمدید نشست',
            onClick: () => {
              setLastActivity(Date.now());
              setSessionWarningShown(false);
            }
          }
        });
      }

      // Auto logout after timeout
      if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
        toast.error('نشست شما به دلیل عدم فعالیت منقضی شد');
        signOut();
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkTimeout);
  }, [user, lastActivity, sessionWarningShown]);

  // Auto-refresh user data every 5 minutes
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      refreshUser();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [user, refreshUser]);

  // Set up auth state listener with improved error handling
  useEffect(() => {
    let mounted = true;

    // Prevent double initialization
    if (isInitializedRef.current) {
      console.log('[AuthContext] Already initialized, skipping');
      return;
    }

    console.log('[AuthContext] Initializing auth state');
    // Don't set isInitializedRef here - set it after initAuth completes

    // Set up loading timeout with recovery
    loadingTimeoutRef.current = setTimeout(() => {
      if (mounted && loading) {
        console.error('[AuthContext] Loading timeout exceeded after 15 seconds!');
        toast.error('خطا در بارگذاری. لطفاً صفحه را رفرش کنید.', {
          duration: 10000
        });
        setLoading(false);
      }
    }, MAX_LOADING_TIME);

    // Check for existing session
    const initAuth = async () => {
      console.log('[AuthContext] 🔄 Starting initAuth...');

      try {
        console.log('[AuthContext] 📞 Calling getSession...');

        // Add timeout to getSession
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getSession timeout')), 5000)
        );

        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;

        console.log('[AuthContext] ✅ getSession completed', {
          hasSession: !!session,
          email: session?.user?.email,
          error: error?.message
        });

        if (error) {
          console.error('[AuthContext] getSession error:', error);
          throw error;
        }

        console.log('[AuthContext] Initial session check:', session?.user?.email || 'No session');
        setSession(session);
        
      if (session?.user && mounted) {
        try {
          const userData = await fetchUserData(session.user);

          if (mounted) {
            if (userData) {
              setUser(userData);
              console.log('[AuthContext] User loaded successfully');
            } else {
              console.error('[AuthContext] Failed to load user data - will retry on next action');
              // Don't sign out! Just set loading to false
              // User will be prompted to login again only if they try to do something
              setUser(null);
            }
          }
        } catch (error) {
          console.error('[AuthContext] Error fetching user data:', error);
          if (mounted) {
            // Don't sign out on error during session restoration
            // Keep the session, just set user to null
            // This allows retry on next user action
            console.log('[AuthContext] Keeping session for retry, user will be null');
            setUser(null);
          }
        }
      }
    } catch (error) {
      console.error('[AuthContext] Init auth error:', error);
      if (mounted) {
        // Don't clear corrupted state aggressively
        // Just ensure we're signed out
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      }
      } finally {
        if (mounted) {
          setLoading(false);
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }
          // Mark as initialized AFTER initAuth completes
          isInitializedRef.current = true;
          console.log('[AuthContext] ✅ Initialization complete');
        }
      }
    };

    initAuth();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] 🔔 Auth event received:', event, session?.user?.email);

        if (!mounted) {
          console.log('[AuthContext] ⚠️ Component unmounted, ignoring event');
          return;
        }

        console.log('[AuthContext] Processing auth event:', event);

        // Skip all events during initialization
        if (event === 'INITIAL_SESSION' || !isInitializedRef.current) {
          console.log('[AuthContext] Skipping event during initialization:', event);
          return;
        }
        
        setSession(session);
        
        if (event === 'SIGNED_OUT') {
          setUser(null);
          retryCountRef.current = 0;
          return;
        }
        
        if (session?.user) {
          try {
            const userData = await fetchUserData(session.user);
            if (mounted && userData) {
              setUser(userData);
            }
          } catch (error) {
            console.error('[AuthContext] Error in auth state change handler:', error);
          }
        } else {
          setUser(null);
        }
      }
    );

    // Cleanup
    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, []); // Empty deps - only run once

  const value: AuthContextValue = {
    user,
    loading,
    signIn,
    signOut,
    hasPermission,
    canPerform,
    checkDailyLimit,
    incrementUsage,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useNewAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useNewAuth must be used within an AuthProvider');
  }
  return context;
};