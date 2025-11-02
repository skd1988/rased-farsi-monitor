import React from 'react';
import { useNewAuth } from '@/contexts/NewAuthContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProtectedActionProps {
  permission: string;
  fallback?: React.ReactNode;
  showTooltip?: boolean;
  tooltipMessage?: string;
  children: React.ReactNode;
}

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
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

export const ProtectedAction: React.FC<ProtectedActionProps> = ({
  permission,
  fallback = null,
  showTooltip = false,
  tooltipMessage,
  children,
}) => {
  const { user, hasPermission } = useNewAuth();

  if (!user || !hasPermission(permission)) {
    if (showTooltip) {
      const message = tooltipMessage || 
        `شما دسترسی ${PERMISSION_DESCRIPTIONS[permission] || 'این عملیات'} را ندارید. نقش فعلی: ${getRoleName(user?.role)}`;

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-not-allowed opacity-50">
                {React.cloneElement(children as React.ReactElement, {
                  disabled: true,
                  onClick: (e: any) => e.preventDefault(),
                })}
              </span>
            </TooltipTrigger>
            <TooltipContent dir="rtl">
              <p>{message}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return <>{fallback}</>;
  }

  return <>{children}</>;
};

function getRoleName(role?: string): string {
  const roleNames: Record<string, string> = {
    super_admin: 'مدیر ارشد',
    admin: 'مدیر',
    analyst: 'تحلیل‌گر',
    viewer: 'بیننده',
    guest: 'مهمان',
  };
  return role ? roleNames[role] || role : 'نامشخص';
}