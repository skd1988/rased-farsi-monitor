import { AppSettings, SettingsUpdate } from '../types/settings.types';
import { DEFAULT_SETTINGS, LEGACY_KEYS_MAP } from '../constants/defaults';

class SettingsService {
  private readonly STORAGE_KEY = 'appSettings';

  load(): AppSettings {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);

      if (!saved) {
        return this.migrateFromLegacyStorage();
      }

      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };

    } catch (error) {
      console.error('[SettingsService] Failed to load:', error);
      return DEFAULT_SETTINGS;
    }
  }

  save(updates: SettingsUpdate): void {
    try {
      const current = this.load();
      const updated: AppSettings = { ...current, ...updates };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
      this.syncToLegacyKeys(updates);

      console.log('[SettingsService] Saved successfully');

    } catch (error) {
      console.error('[SettingsService] Failed to save:', error);
      throw new Error('خطا در ذخیره تنظیمات');
    }
  }

  reset(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    Object.values(LEGACY_KEYS_MAP).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  export(): string {
    return JSON.stringify(this.load(), null, 2);
  }

  import(jsonString: string): void {
    const imported = JSON.parse(jsonString);
    this.save(imported);
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.load()[key];
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.save({ [key]: value } as SettingsUpdate);
  }

  private migrateFromLegacyStorage(): AppSettings {
    console.log('[SettingsService] Migrating from legacy...');
    const migrated: AppSettings = { ...DEFAULT_SETTINGS };

    Object.entries(LEGACY_KEYS_MAP).forEach(([newKey, oldKey]) => {
      const value = localStorage.getItem(oldKey);
      if (value !== null) {
        if (value === 'true' || value === 'false') {
          (migrated as any)[newKey] = value === 'true';
        } else {
          (migrated as any)[newKey] = value;
        }
      }
    });

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  }

  private syncToLegacyKeys(updates: SettingsUpdate): void {
    Object.entries(updates).forEach(([key, value]) => {
      const legacyKey = LEGACY_KEYS_MAP[key as keyof typeof LEGACY_KEYS_MAP];
      if (legacyKey) {
        localStorage.setItem(legacyKey, String(value));
      }
    });
  }
}

export const settingsService = new SettingsService();
