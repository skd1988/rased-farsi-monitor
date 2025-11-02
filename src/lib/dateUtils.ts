import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { format as dateFnsFormat } from 'date-fns';
import { faIR } from 'date-fns/locale';
import moment from 'moment-jalaali';

// Iran timezone constant
export const IRAN_TIMEZONE = 'Asia/Tehran';

// Convert UTC date to Iran timezone
export function toIranTime(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  return toZonedTime(d, IRAN_TIMEZONE);
}

// Format date in Jalali (Shamsi) calendar with Iran timezone
export function formatIranDate(date: Date | string, formatStr: string = 'jYYYY/jMM/jDD', options?: any): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const iranDate = toIranTime(d);
  
  // Convert to Jalali calendar
  const m = moment(iranDate);
  
  // Format using Jalali
  return m.format(formatStr);
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

// Format date in Jalali (Shamsi) calendar
export function formatPersianDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const iranDate = toIranTime(d);
  
  // Convert to Jalali calendar with time
  const m = moment(iranDate);
  return m.format('jYYYY/jMM/jDD HH:mm');
}

// Format for display with Persian numbers and full Jalali date
export function formatPersianDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const iranDate = toIranTime(d);
  
  // Convert to Jalali calendar
  const m = moment(iranDate);
  
  // Format in Persian with Jalali date
  const formatted = m.format('jYYYY/jMM/jDD');
  const time = m.format('HH:mm');
  
  return `${formatted} ${time}`;
}

// Format full date with Persian month names
export function formatPersianDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const iranDate = toIranTime(d);
  
  const m = moment(iranDate);
  
  // Persian month names
  const persianMonths = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];
  
  const day = m.jDate();
  const month = persianMonths[m.jMonth()];
  const year = m.jYear();
  
  return `${day} ${month} ${year}`;
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
