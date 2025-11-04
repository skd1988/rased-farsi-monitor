import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [sessionWarningShown, setSessionWarningShown] = useState(false);

  const fetchUserData = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
    console.log('[NewAuthContext] fetchUserData START for:', authUser.email, 'ID:', authUser.id);
    
    // Wait longer to ensure auth session is fully propagated
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // First verify we can get current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('[NewAuthContext] Current session check:', {
        hasSession: !!sessionData?.session,
        userId: sessionData?.session?.user?.id,
        authUserId: authUser.id,
        match: sessionData?.session?.user?.id === authUser.id
      });
      
      if (sessionError || !sessionData?.session) {
        console.error('[NewAuthContext] No valid session found');
        throw new Error('نشست کاربری معتبر یافت نشد');
      }
      
      console.log('[NewAuthContext] Starting parallel queries...');
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch all data in parallel with longer timeout
      const [userResult, roleResult, limitsResult, usageResult] = await Promise.all([
        Promise.race([
          supabase.from('users').select('*').eq('id', authUser.id).maybeSingle(),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Users query timeout')), 10000))
        ]),
        Promise.race([
          supabase.from('user_roles').select('role').eq('user_id', authUser.id).maybeSingle(),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Role query timeout')), 10000))
        ]),
        Promise.race([
          supabase.from('user_daily_limits').select('*').eq('user_id', authUser.id).maybeSingle(),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Limits query timeout')), 10000))
        ]),
        Promise.race([
          supabase.from('user_daily_usage').select('*').eq('user_id', authUser.id).eq('usage_date', today).maybeSingle(),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Usage query timeout')), 10000))
        ])
      ]);

      console.log('[NewAuthContext] All queries completed:', {
        hasUser: !!userResult.data,
        hasRole: !!roleResult.data,
        hasLimits: !!limitsResult.data,
        hasUsage: !!usageResult.data,
        userError: userResult.error?.message,
        roleError: roleResult.error?.message,
        limitsError: limitsResult.error?.message,
        usageError: usageResult.error?.message
      });

      const { data: userData, error: userError } = userResult;
      const { data: roleData, error: roleError } = roleResult;
      const { data: limitsData, error: limitsError } = limitsResult;
      const { data: usageData, error: usageError } = usageResult;
      
      if (userError) {
        console.error('[NewAuthContext] Users query error:', userError);
        throw new Error('خطا در بارگذاری پروفایل: ' + userError.message);
      }
      
      if (!userData) {
        console.error('[NewAuthContext] No user data found');
        throw new Error('پروفایل کاربر یافت نشد');
      }
      
      if (roleError) {
        console.error('[NewAuthContext] Role query error:', roleError);
        throw new Error('خطا در بارگذاری نقش کاربر: ' + roleError.message);
      }
      
      if (!roleData) {
        console.error('[NewAuthContext] No role data found');
        throw new Error('نقش کاربر یافت نشد');
      }
      
      if (limitsError) {
        console.error('[NewAuthContext] Limits query error:', limitsError);
        throw new Error('خطا در بارگذاری محدودیت‌ها: ' + limitsError.message);
      }
      
      if (!limitsData) {
        console.error('[NewAuthContext] No limits data found');
        throw new Error('محدودیت‌های کاربر یافت نشد');
      }

      if (usageError && usageError.code !== 'PGRST116') {
        console.error('[NewAuthContext] Usage query error:', usageError);
        throw new Error('خطا در بارگذاری مصرف روزانه: ' + usageError.message);
      }

      // If no usage record for today, create one
      if (!usageData) {
        console.log('[NewAuthContext] Creating new usage record for today...');
        const { error: insertError } = await supabase
          .from('user_daily_usage')
          .insert({
            user_id: authUser.id,
            usage_date: today,
            ai_analysis: 0,
            chat_messages: 0,
            exports: 0
          });
        
        if (insertError) {
          console.error('[NewAuthContext] Insert usage error:', insertError);
        }
      }

      console.log('[NewAuthContext] Building user object...');
      const userObject = {
        id: userData.id,
        email: userData.email,
        fullName: userData.full_name,
        role: roleData.role as UserRole,
        status: userData.status as UserStatus,
        preferences: userData.preferences as User['preferences'],
        dailyLimits: {
          aiAnalysis: limitsData.ai_analysis,
          chatMessages: limitsData.chat_messages,
          exports: limitsData.exports
        },
        usageToday: {
          aiAnalysis: usageData?.ai_analysis || 0,
          chatMessages: usageData?.chat_messages || 0,
          exports: usageData?.exports || 0
        },
        lastLogin: userData.last_login,
        createdAt: userData.created_at
      };
      
      console.log('[NewAuthContext] User object built successfully:', {
        email: userObject.email,
        role: userObject.role,
        status: userObject.status
      });
      
      return userObject;
    } catch (error: any) {
      console.error('[NewAuthContext] FATAL ERROR in fetchUserData:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack
      });
      toast.error(error?.message || 'خطا در بارگذاری اطلاعات کاربر');
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        // Update last login
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', data.user.id);

        setSession(data.session);
        const userData = await fetchUserData(data.user);
        if (userData) {
          setUser(userData);
          setLastActivity(Date.now());
          toast.success('خوش آمدید!');
        }
      }
    } catch (error: any) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      toast.success('با موفقیت خارج شدید');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('خطا در خروج از سیستم');
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

  // Set up auth state listener
  useEffect(() => {
    // Check for existing session FIRST before setting up listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[NewAuthContext] Initial session check:', session?.user?.email);
      setSession(session);
      if (session?.user) {
        // Add timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.error('[NewAuthContext] fetchUserData timeout!');
          setLoading(false);
          toast.error('خطا در بارگذاری اطلاعات کاربر - لطفا مجددا تلاش کنید');
        }, 10000); // 10 second timeout

        fetchUserData(session.user)
          .then(userData => {
            clearTimeout(timeoutId);
            setUser(userData);
            setLoading(false);
          })
          .catch(error => {
            clearTimeout(timeoutId);
            console.error('[NewAuthContext] fetchUserData failed:', error);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    }).catch(error => {
      console.error('[NewAuthContext] getSession failed:', error);
      setLoading(false);
    });

    // Then set up listener for future auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[NewAuthContext] Auth state changed:', event, session?.user?.email);
        
        // Skip INITIAL_SESSION event as we already handled it above
        if (event === 'INITIAL_SESSION') return;
        
        setSession(session);
        
        if (session?.user) {
          const userData = await fetchUserData(session.user);
          console.log('[NewAuthContext] User data fetched:', userData);
          setUser(userData);
        } else {
          console.log('[NewAuthContext] No session, clearing user');
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

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