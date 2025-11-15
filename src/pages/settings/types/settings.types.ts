// src/pages/settings/types/settings.types.ts

/**
 * Main Settings Interface
 */
export interface AppSettings {
  // API KEYS
  deepseek_api_key: string;
  google_api_key: string;

  // GOOGLE SHEETS CONFIG
  google_sheet_id: string;
  google_sheet_name: string;
  last_sync_time: string | null;

  // UI/APPEARANCE
  theme: ThemeType;
  dark_mode: boolean;
  language: LanguageType;
  font_size: number;
  show_tooltips: boolean;
  animations_enabled: boolean;
  show_kpi_cards: boolean;
  show_charts: boolean;
  show_recent_posts: boolean;
  show_recent_alerts: boolean;
  default_time_range: string;

  // AUTOMATION
  auto_analysis: boolean;
  analysis_delay: number;
  batch_size: string;
  analysis_schedule: ScheduleType;
  auto_sync: boolean;
  sync_interval: string;
  auto_cleanup: boolean;
  keep_posts_for: string;
  archive_before_delete: boolean;
  auto_backup: BackupFrequency;

  // NOTIFICATIONS
  notifications_enabled: boolean;
  alert_sounds: boolean;
  weekly_reports: boolean;
  report_day: string;
  report_time: string;
  report_email: string;
}

export interface SyncStats {
  sheetRows: number;
  dbPosts: number;
  lastSynced: number;
  pendingRows: number;
}

export interface CleanupStats {
  empty: number;
  total: number;
}

export interface APIStatus {
  status: 'connected' | 'disconnected' | 'testing';
  lastTested: string | null;
  error?: string;
}

export type ThemeType = 'blue' | 'green' | 'red' | 'purple';
export type LanguageType = 'fa' | 'en' | 'ar';
export type ScheduleType = 'manual' | 'immediate' | 'delayed' | 'scheduled';
export type BackupFrequency = 'never' | 'daily' | 'weekly' | 'monthly';
export type SettingsUpdate = Partial<AppSettings>;
