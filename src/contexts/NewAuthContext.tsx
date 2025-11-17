import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { debugHelper, startPerf, endPerf } from '@/utils/debugHelper';

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

  // Refs for internal state management
  const isInitializedRef = useRef(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isFetchingRef = useRef(false);

  const fetchUserData = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second between retries

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[fetchUserData] Attempt ${attempt}/${maxRetries} for user:`, authUser.email);

        // Wait before retry (except first attempt)
        if (attempt > 1) {
          console.log(`[fetchUserData] Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        const today = new Date().toISOString().split('T')[0];

        // Query 1: Users table (CRITICAL - must succeed)
        // Using .maybeSingle() instead of .single() to avoid throwing on 0 rows
        const { data: userData, error: usersError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        // Check if query failed with an error
        if (usersError) {
          console.error(`[fetchUserData] Attempt ${attempt} - Users query error:`, usersError);
          if (attempt < maxRetries) {
            console.log('[fetchUserData] Will retry due to query error...');
            continue; // Retry
          }
          toast.error('خطا در بارگذاری پروفایل کاربر');
          return null;
        }

        // Check if no data returned (auth.uid() not ready yet in RLS)
        if (!userData) {
          console.warn(`[fetchUserData] Attempt ${attempt} - No user data returned (auth.uid() not ready in RLS?)`);
          if (attempt < maxRetries) {
            console.log('[fetchUserData] Will retry - auth.uid() may not be propagated to RLS yet...');
            continue; // Retry
          }
          console.error('[fetchUserData] All attempts exhausted - user data not found');
          toast.error('خطا در بارگذاری پروفایل کاربر - لطفا دوباره وارد شوید');
          return null;
        }

        // SUCCESS! User data found
        console.log(`[fetchUserData] Attempt ${attempt} - User data loaded successfully:`, userData.email);

        // Query 2: User roles (optional - use guest as fallback)
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', authUser.id)
          .maybeSingle();

        const role = rolesData?.role || 'guest';
        console.log('[fetchUserData] User role:', role);

        // Query 3: Daily limits (optional - use unlimited as fallback)
        const { data: limitsData } = await supabase
          .from('user_daily_limits')
          .select('*')
          .eq('user_id', authUser.id)
          .maybeSingle();

        console.log('[fetchUserData] Daily limits loaded:', limitsData ? 'yes' : 'using defaults');

        // Query 4: Daily usage (optional - use zero as fallback)
        const { data: usageData } = await supabase
          .from('user_daily_usage')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('usage_date', today)
          .maybeSingle();

        console.log('[fetchUserData] Daily usage loaded:', usageData ? 'yes' : 'using defaults');

        // If no usage record for today, create one (fire and forget)
        if (!usageData) {
          supabase
            .from('user_daily_usage')
            .insert({
              user_id: authUser.id,
              usage_date: today,
              ai_analysis: 0,
              chat_messages: 0,
              exports: 0
            })
            .then(() => console.log('[fetchUserData] Created daily usage record'))
            .catch((err) => console.error('[fetchUserData] Failed to create usage record:', err));
        }

        // Build and return user object
        const userObject = {
          id: userData.id,
          email: userData.email,
          fullName: userData.full_name,
          role: role as UserRole,
          status: userData.status as UserStatus,
          preferences: userData.preferences as User['preferences'],
          dailyLimits: {
            aiAnalysis: limitsData?.ai_analysis || -1,
            chatMessages: limitsData?.chat_messages || -1,
            exports: limitsData?.exports || -1
          },
          usageToday: {
            aiAnalysis: usageData?.ai_analysis || 0,
            chatMessages: usageData?.chat_messages || 0,
            exports: usageData?.exports || 0
          },
          lastLogin: userData.last_login,
          createdAt: userData.created_at
        };

        console.log('[fetchUserData] ✅ User object built successfully for:', userObject.email);
        return userObject;

      } catch (error: any) {
        console.error(`[fetchUserData] Attempt ${attempt} - Critical error:`, error);
        if (attempt < maxRetries) {
          console.log('[fetchUserData] Will retry due to critical error...');
          continue; // Retry
        }
        toast.error('خطا در بارگذاری اطلاعات کاربر');
        return null;
      }
    }

    // Should never reach here, but just in case
    console.error('[fetchUserData] All retry attempts exhausted');
    return null;
  }, []);

  // 🔥 FIX: Stable refreshUser with proper dependencies
  const refreshUser = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    if (!currentSession?.user) {
      console.log('[AuthContext] No session, skipping refresh');
      return;
    }

    console.log('[AuthContext] 🔄 Refreshing user data...');
    const userData = await fetchUserData(currentSession.user);
    
    if (userData) {
      setUser(userData);
      console.log('[AuthContext] ✅ User refreshed successfully');
    }
  }, [fetchUserData]); // Only depends on fetchUserData which is stable

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      console.log('[AuthContext] Starting signIn for email:', email);
      debugHelper.log('AuthContext', 'signIn START', { email });

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
        debugHelper.log('AuthContext', 'signIn ERROR', { error: error.message });
        throw error;
      }

      if (data.session) {
        console.log('[AuthContext] Session created, user ID:', data.user.id);
        setSession(data.session);

        // ✅ Only update last_login here
        // fetchUserData will be called by the SIGNED_IN event handler
        console.log('[AuthContext] Updating last login...');
        await supabase
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

        // ✅ SIGNED_IN event will handle fetchUserData and setUser
        debugHelper.log('AuthContext', 'signIn SUCCESS - waiting for SIGNED_IN event');
        toast.success('خوش آمدید!');
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
      debugHelper.log('AuthContext', 'signIn ERROR', { error: error?.message });

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

      // 🔥 FIX: Clear refresh interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
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

  // 🔥 DISABLED: Auto-refresh causing hang issues
  // useEffect(() => {
  //   if (!user) {
  //     // Clear interval if user logged out
  //     if (refreshIntervalRef.current) {
  //       clearInterval(refreshIntervalRef.current);
  //       refreshIntervalRef.current = null;
  //     }
  //     return;
  //   }

  //   console.log('[AuthContext] ⏰ Setting up user refresh interval');

  //   // Clear any existing interval
  //   if (refreshIntervalRef.current) {
  //     clearInterval(refreshIntervalRef.current);
  //   }

  //   // Create new interval
  //   refreshIntervalRef.current = setInterval(() => {
  //     console.log('[AuthContext] ⏰ Auto-refresh triggered');
  //     refreshUser();
  //   }, REFRESH_INTERVAL);

  //   return () => {
  //     if (refreshIntervalRef.current) {
  //       console.log('[AuthContext] ⏰ Clearing refresh interval');
  //       clearInterval(refreshIntervalRef.current);
  //       refreshIntervalRef.current = null;
  //     }
  //   };
  // }, [user?.id]); // ✅ Only depend on user ID, not the whole user object

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

    // Initialize auth: check current session
    const initAuth = async () => {
      try {
        console.log('[AuthContext] Checking initial session...');
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (currentSession?.user) {
          console.log('[AuthContext] Initial session found:', currentSession.user.email);
          setSession(currentSession);
          const userData = await fetchUserData(currentSession.user);
          if (mounted && userData) {
            setUser(userData);
          }
        } else {
          console.log('[AuthContext] No initial session');
        }
      } catch (error) {
        console.error('[AuthContext] Error checking initial session:', error);
      } finally {
        if (mounted) {
          setLoading(false);
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }
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
        debugHelper.log('AuthContext', 'Auth State Change', {
          event,
          email: session?.user?.email,
          isInitialized: isInitializedRef.current,
          hasUser: !!user
        });

        if (!mounted) {
          console.log('[AuthContext] ⚠️ Component unmounted, ignoring event');
          debugHelper.log('AuthContext', 'Event IGNORED - Component unmounted');
          return;
        }

        // 🔥 FIX: Skip ALL events during initialization
        if (!isInitializedRef.current) {
          console.log('[AuthContext] ⏸️ Skipping event during initialization:', event);
          debugHelper.log('AuthContext', 'Event SKIPPED - Not initialized', { event });
          return;
        }

        // 🔥 FIX: Skip duplicate SIGNED_IN events if user already loaded OR being fetched
        if (event === 'SIGNED_IN') {
          if (user !== null) {
            console.log('[AuthContext] ⏸️ User already loaded, ignoring duplicate SIGNED_IN');
            debugHelper.log('AuthContext', 'SIGNED_IN SKIPPED - User already loaded', {
              userEmail: user.email
            });
            return;
          }

          if (isFetchingRef.current) {
            console.log('[AuthContext] ⏸️ Already fetching user data, ignoring duplicate SIGNED_IN');
            debugHelper.log('AuthContext', 'SIGNED_IN SKIPPED - Already fetching');
            return;
          }
        }

        console.log('[AuthContext] Processing auth event:', event);
        debugHelper.log('AuthContext', 'Processing Auth Event', { event });

        // Skip INITIAL_SESSION event - it's handled by initAuth
        if (event === 'INITIAL_SESSION') {
          console.log('[AuthContext] Skipping INITIAL_SESSION event');
          return;
        }

        setSession(session);

        if (event === 'SIGNED_OUT') {
          setUser(null);
          retryCountRef.current = 0;
          return;
        }

        // Only fetch user data for SIGNED_IN events when user is not already loaded
        if (session?.user && event === 'SIGNED_IN') {
          try {
            const userData = await fetchUserData(session.user);
            if (mounted && userData) {
              setUser(userData);
            }
          } catch (error) {
            console.error('[AuthContext] Error in auth state change handler:', error);
          }
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
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
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
