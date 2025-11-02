import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { format as dateFnsFormat } from 'date-fns';
import { faIR } from 'date-fns/locale';

// Iran timezone constant
export const IRAN_TIMEZONE = 'Asia/Tehran';

// Convert UTC date to Iran timezone
export function toIranTime(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  return toZonedTime(d, IRAN_TIMEZONE);
}

// Wrapper for date-fns format that uses Iran timezone
export function formatIranDate(date: Date | string, formatStr: string = 'PP', options?: any): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, IRAN_TIMEZONE, formatStr, { ...options, locale: faIR });
}

// Wrapper for formatDistanceToNow with Iran timezone
export function formatDistanceToNowIran(date: Date | string, options?: any): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const iranDate = toIranTime(d);
  const iranNow = toIranTime(new Date());
  
  const diffMs = iranNow.getTime() - iranDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'هم‌اکنون';
  if (diffMins < 60) return `${diffMins} دقیقه پیش`;
  if (diffHours < 24) return `${diffHours} ساعت پیش`;
  if (diffDays === 1) return 'دیروز';
  if (diffDays < 30) return `${diffDays} روز پیش`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} ماه پیش`;
  
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} سال پیش`;
}

// Date utilities for Persian calendar and relative time (in Iran timezone)
export function formatPersianDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const iranDate = toIranTime(d);
  
  // Format with Iran timezone
  return formatInTimeZone(d, IRAN_TIMEZONE, 'yyyy/MM/dd HH:mm', { locale: undefined });
}

// Format for display with Persian numbers
export function formatPersianDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const iranDate = toIranTime(d);
  
  // Get formatted date in Iran timezone
  const formatted = iranDate.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: IRAN_TIMEZONE
  });
  
  const time = iranDate.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: IRAN_TIMEZONE
  });
  
  return `${formatted} ${time}`;
}

export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const iranNow = toIranTime(new Date());
  const iranDate = toIranTime(d);
  
  const diffMs = iranNow.getTime() - iranDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'هم‌اکنون';
  if (diffMins < 60) return `${diffMins} دقیقه پیش`;
  if (diffHours < 24) return `${diffHours} ساعت پیش`;
  if (diffDays < 30) return `${diffDays} روز پیش`;
  return formatPersianDateTime(d);
}
