/**
 * Translate narrative theme names from English to Persian
 */
export const translateNarrativeTheme = (theme: string): string => {
  const translations: Record<string, string> = {
    'Demonization': 'شیطان‌سازی',
    'Delegitimization': 'بی‌اعتبارسازی',
    'Victimization': 'قربانی‌سازی',
    'Fear-Mongering': 'ترس‌افکنی',
    'Divide & Conquer': 'تفرقه‌اندازی',
    'False Flag': 'پرچم دروغین',
    'Whitewashing': 'سفیدشویی',
    'Attack': 'حمله',
    'Defense': 'دفاع',
    'Supportive': 'حمایتی',
    'Unknown': 'نامشخص'
  };

  return translations[theme] || theme;
};

/**
 * Translate narrative type from English to Persian
 */
export const translateNarrativeType = (type: string): string => {
  const translations: Record<string, string> = {
    'Attack': 'حمله',
    'Defense': 'دفاع',
    'Supportive': 'حمایتی'
  };

  return translations[type] || type;
};
