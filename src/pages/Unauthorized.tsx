import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldX, Home, Mail } from 'lucide-react';
import { useNewAuth } from '@/contexts/NewAuthContext';

const Unauthorized = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useNewAuth();
  
  const state = location.state as {
    reason?: string;
    requiredPermission?: string;
    requiredRole?: string[];
    currentRole?: string;
    attemptedPath?: string;
  } | null;

  const getReasonMessage = () => {
    if (state?.reason === 'suspended') {
      return {
        title: 'حساب کاربری معلق شده',
        message: 'حساب کاربری شما به دلیل نقض قوانین موقتاً معلق شده است.',
        suggestion: 'برای فعال‌سازی مجدد حساب خود با پشتیبانی تماس بگیرید.',
      };
    }

    if (state?.reason === 'inactive') {
      return {
        title: 'حساب کاربری غیرفعال',
        message: 'حساب کاربری شما غیرفعال شده است.',
        suggestion: 'برای فعال‌سازی حساب خود با مدیر سیستم تماس بگیرید.',
      };
    }

    return {
      title: 'دسترسی غیرمجاز',
      message: 'شما اجازه دسترسی به این صفحه را ندارید.',
      suggestion: 'لطفاً با مدیر سیستم تماس بگیرید یا به صفحه اصلی بازگردید.',
    };
  };

  const getRoleName = (role?: string): string => {
    const roleNames: Record<string, string> = {
      super_admin: 'مدیر ارشد',
      admin: 'مدیر',
      analyst: 'تحلیل‌گر',
      viewer: 'بیننده',
      guest: 'مهمان',
    };
    return role ? roleNames[role] || role : 'نامشخص';
  };

  const getPermissionName = (permission?: string): string => {
    const permissionNames: Record<string, string> = {
      VIEW_POSTS: 'مشاهده پست‌ها',
      EDIT_POSTS: 'ویرایش پست‌ها',
      DELETE_POSTS: 'حذف پست‌ها',
      EDIT_OWN_POSTS: 'ویرایش پست‌های خود',
      REQUEST_AI_ANALYSIS: 'درخواست تحلیل هوش مصنوعی',
      VIEW_ALERTS: 'مشاهده هشدارها',
      CREATE_ALERTS: 'ایجاد هشدار',
      EDIT_ALL_ALERTS: 'ویرایش تمام هشدارها',
      EDIT_OWN_ALERTS: 'ویرایش هشدارهای خود',
      MANAGE_USERS: 'مدیریت کاربران',
      INVITE_USERS: 'دعوت کاربران',
      MANAGE_SETTINGS: 'مدیریت تنظیمات',
      MANAGE_API_KEYS: 'مدیریت کلیدهای API',
      VIEW_API_USAGE: 'مشاهده مصرف API',
      EXPORT_DATA: 'خروجی گرفتن از داده‌ها',
      USE_CHAT: 'استفاده از چت',
    };
    return permission ? permissionNames[permission] || permission : 'نامشخص';
  };

  const { title, message, suggestion } = getReasonMessage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-24 h-24 bg-destructive/10 rounded-full mb-8">
          <ShieldX className="w-12 h-12 text-destructive" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-foreground mb-4" dir="rtl">
          {title}
        </h1>

        {/* Message */}
        <p className="text-lg text-muted-foreground mb-4" dir="rtl">
          {message}
        </p>

        {/* Suggestion */}
        <p className="text-sm text-muted-foreground mb-8" dir="rtl">
          {suggestion}
        </p>

        {/* Details Card */}
        {user && state && (
          <div className="bg-card border border-border rounded-lg p-6 mb-8 text-right" dir="rtl">
            <h3 className="font-semibold text-foreground mb-4">جزئیات دسترسی</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-muted-foreground">نقش فعلی شما:</span>
                <span className="font-medium text-foreground">{getRoleName(state.currentRole || user.role)}</span>
              </div>
              
              {state.requiredPermission && (
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span className="text-muted-foreground">مجوز مورد نیاز:</span>
                  <span className="font-medium text-foreground">{getPermissionName(state.requiredPermission)}</span>
                </div>
              )}
              
              {state.requiredRole && (
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span className="text-muted-foreground">نقش مورد نیاز:</span>
                  <span className="font-medium text-foreground">
                    {state.requiredRole.map(r => getRoleName(r)).join(' یا ')}
                  </span>
                </div>
              )}
              
              {state.attemptedPath && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">مسیر درخواستی:</span>
                  <span className="font-mono text-xs text-foreground bg-muted px-2 py-1 rounded">
                    {state.attemptedPath}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center" dir="rtl">
          <Button
            onClick={() => navigate('/dashboard')}
            size="lg"
            className="w-full sm:w-auto"
          >
            <Home className="ml-2 h-5 w-5" />
            بازگشت به داشبورد
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => window.location.href = 'mailto:support@example.com'}
          >
            <Mail className="ml-2 h-5 w-5" />
            تماس با پشتیبانی
          </Button>
        </div>

        {/* Additional Info */}
        <p className="mt-8 text-xs text-muted-foreground" dir="rtl">
          اگر فکر می‌کنید این پیام به اشتباه نمایش داده شده، لطفاً با مدیر سیستم تماس بگیرید.
        </p>
      </div>
    </div>
  );
};

export default Unauthorized;