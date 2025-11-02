// Translations for sentiment from English to Persian
export const sentimentTranslations: Record<string, string> = {
  'Positive': 'مثبت',
  'Negative': 'منفی',
  'Neutral': 'خنثی'
};

/**
 * Translates a sentiment from English to Persian
 * @param sentiment - The English sentiment value
 * @returns The Persian translation, or the original if no translation exists
 */
export const translateSentiment = (sentiment: string): string => {
  return sentimentTranslations[sentiment] || sentiment;
};

/**
 * Converts Persian sentiment to English for database storage
 * @param sentiment - The Persian sentiment value
 * @returns The English value for database constraint
 */
export const sentimentToEnglish = (sentiment: string): string => {
  const reverseMap: Record<string, string> = {
    'مثبت': 'Positive',
    'منفی': 'Negative',
    'خنثی': 'Neutral'
  };
  return reverseMap[sentiment] || sentiment;
};
