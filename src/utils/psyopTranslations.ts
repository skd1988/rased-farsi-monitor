// Translations for PsyOp techniques from English to Persian
export const psyopTechniqueTranslations: Record<string, string> = {
  'Corruption Allegations': 'اتهامات فساد',
  'Weakness Portrayal': 'نمایش ضعف',
  'Legitimacy Questioning': 'زیر سوال بردن مشروعیت',
  'Internal Conflict': 'درگیری داخلی',
  'Human Rights Violations': 'نقض حقوق بشر',
  'Historical Revisionism': 'بازنگری تاریخی',
  'Terrorism Labeling': 'برچسب تروریسم',
  'Sectarian Division': 'تفرقه مذهبی',
  'Foreign Interference': 'دخالت خارجی',
  'Demonization': 'شیطان‌سازی',
  'Normalization of Enemy': 'عادی‌سازی دشمن',
  'Fear Mongering': 'ایجاد ترس',
  'False Flag': 'عملیات پرچم جعلی',
  'Disinformation': 'اطلاعات نادرست',
  'Propaganda': 'تبلیغات',
  'Character Assassination': 'ترور شخصیت',
  'Divide and Conquer': 'تفرقه‌اندازی',
  'Victimhood Narrative': 'روایت قربانی‌سازی',
  'Discrediting': 'بی‌اعتبارسازی',
  'Emotional Manipulation': 'دستکاری احساسی',
  'Amplification': 'تقویت و گسترش',
  'Astroturfing': 'جعل افکار عمومی',
  'Bandwagon Effect': 'اثر موج‌سواری'
};

/**
 * Translates a PsyOp technique from English to Persian
 * @param technique - The English technique name
 * @returns The Persian translation, or the original if no translation exists
 */
export const translatePsyopTechnique = (technique: string): string => {
  return psyopTechniqueTranslations[technique] || technique;
};

/**
 * Translates an array of PsyOp techniques
 * @param techniques - Array of English technique names
 * @returns Array of Persian translations
 */
export const translatePsyopTechniques = (techniques: string[]): string[] => {
  return techniques.map(translatePsyopTechnique);
};
