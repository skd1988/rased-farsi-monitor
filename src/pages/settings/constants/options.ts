export const SYNC_INTERVALS = [
  { value: '5', label: 'هر 5 دقیقه' },
  { value: '15', label: 'هر 15 دقیقه' },
  { value: '30', label: 'هر 30 دقیقه' },
  { value: '60', label: 'هر 1 ساعت' },
] as const;

export const BATCH_SIZES = [
  { value: '10', label: '10 مطلب' },
  { value: '25', label: '25 مطلب' },
  { value: '50', label: '50 مطلب' },
  { value: '100', label: '100 مطلب' },
] as const;

export const THEMES = [
  { value: 'blue', label: 'آبی', color: '#3b82f6' },
  { value: 'green', label: 'سبز', color: '#10b981' },
  { value: 'red', label: 'قرمز', color: '#ef4444' },
  { value: 'purple', label: 'بنفش', color: '#8b5cf6' },
] as const;

export const LANGUAGES = [
  { value: 'fa', label: 'فارسی', dir: 'rtl' },
  { value: 'en', label: 'English', dir: 'ltr' },
  { value: 'ar', label: 'العربية', dir: 'rtl' },
] as const;

/**
 * User Management Constants
 */
import { RolePermissions } from '../types/settings.types';

export const USER_ROLES: RolePermissions[] = [
  {
    role: 'super_admin',
    label: 'مدیر ارشد',
    permissions: ['*'], // All permissions
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  {
    role: 'admin',
    label: 'مدیر',
    permissions: [
      'MANAGE_USERS',
      'MANAGE_SETTINGS',
      'VIEW_POSTS',
      'ANALYZE_POSTS',
      'MANAGE_KEYWORDS',
    ],
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  {
    role: 'analyst',
    label: 'تحلیلگر',
    permissions: [
      'VIEW_POSTS',
      'ANALYZE_POSTS',
      'VIEW_ANALYSIS',
    ],
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  {
    role: 'viewer',
    label: 'بیننده',
    permissions: [
      'VIEW_POSTS',
      'VIEW_ANALYSIS',
    ],
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  },
  {
    role: 'guest',
    label: 'مهمان',
    permissions: [
      'VIEW_POSTS',
    ],
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  },
];

export const USER_STATUS_LABELS = {
  active: 'فعال',
  suspended: 'معلق',
  inactive: 'غیرفعال',
};

export const USER_STATUS_COLORS = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  suspended: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  inactive: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};
