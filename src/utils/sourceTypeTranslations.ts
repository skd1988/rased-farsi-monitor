// Translations for source types from English to Persian
export const sourceTypeTranslations: Record<string, string> = {
  'website': 'وب‌سایت',
  'blog': 'وبلاگ',
  'social_media': 'شبکه اجتماعی',
  'news': 'خبرگزاری',
  'news_agency': 'خبرگزاری',
  'forum': 'انجمن',
  'video': 'ویدیو',
  'podcast': 'پادکست',
  'other': 'سایر',
  'Unknown': 'نامشخص'
};

/**
 * Translates a source type from English to Persian
 * @param sourceType - The English source type name
 * @returns The Persian translation, or the original if no translation exists
 */
export const translateSourceType = (sourceType: string): string => {
  return sourceTypeTranslations[sourceType] || sourceType;
};
