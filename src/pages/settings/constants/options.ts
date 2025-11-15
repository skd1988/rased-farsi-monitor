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
