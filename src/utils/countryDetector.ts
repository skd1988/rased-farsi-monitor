/**
 * Country Detection Utility
 * 
 * Detects the source country from news source names or URLs
 * Returns Persian country names for consistency with the application
 */

/**
 * Detects the country of origin for a news source
 * 
 * @param source - The name of the news source (e.g., "BBC", "الجزیرة", "مهر")
 * @param sourceUrl - Optional URL of the source (e.g., "https://www.bbc.com/arabic/...")
 * @returns Persian name of the country or null if unknown
 * 
 * @example
 * detectCountryFromSource("الجزیرة") // returns "قطر"
 * detectCountryFromSource("", "https://www.bbc.com/arabic/...") // returns "بریتانیا"
 * detectCountryFromSource("مهر") // returns "ایران"
 * detectCountryFromSource("", "https://t.me/channel") // returns "نامشخص"
 */
export function detectCountryFromSource(
  source: string,
  sourceUrl?: string
): string | null {
  // Combine source and URL for comprehensive matching
  const searchText = `${source} ${sourceUrl || ''}`.toLowerCase();
  
  // ========================================
  // Persian/Iranian Sources
  // ========================================
  if (
    // Domain patterns
    searchText.includes('isna.ir') ||
    searchText.includes('irna.ir') ||
    searchText.includes('mehrnews.com') ||
    searchText.includes('tasnimnews.com') ||
    searchText.includes('farsnews.ir') ||
    searchText.includes('presstv.ir') ||
    searchText.includes('tehrantimes.com') ||
    // Persian names
    searchText.includes('ایسنا') ||
    searchText.includes('ایرنا') ||
    searchText.includes('مهر') ||
    searchText.includes('تسنیم') ||
    searchText.includes('فارس')
  ) {
    return 'ایران';
  }
  
  // ========================================
  // Arabic Sources - Qatar
  // ========================================
  if (
    searchText.includes('aljazeera') ||
    searchText.includes('الجزیرة') ||
    searchText.includes('الجزيرة')
  ) {
    return 'قطر';
  }
  
  // ========================================
  // Arabic Sources - Saudi Arabia
  // ========================================
  if (
    searchText.includes('alarabiya') ||
    searchText.includes('aawsat.com') ||
    searchText.includes('okaz.com.sa') ||
    searchText.includes('العربیة') ||
    searchText.includes('العربية') ||
    searchText.includes('الشرق الأوسط')
  ) {
    return 'عربستان سعودی';
  }
  
  // ========================================
  // Arabic Sources - UAE
  // ========================================
  if (
    searchText.includes('skynewsarabia') ||
    searchText.includes('albayan.ae') ||
    searchText.includes('emaratalyoum.com') ||
    searchText.includes('سکای نیوز عربی') ||
    searchText.includes('سكاي نيوز عربية')
  ) {
    return 'امارات';
  }
  
  // ========================================
  // Arabic Sources - Egypt
  // ========================================
  if (
    searchText.includes('ahram.org.eg') ||
    searchText.includes('youm7.com') ||
    searchText.includes('almasryalyoum.com') ||
    searchText.includes('الأهرام') ||
    searchText.includes('الاهرام') ||
    searchText.includes('الیوم السابع') ||
    searchText.includes('اليوم السابع')
  ) {
    return 'مصر';
  }
  
  // ========================================
  // Arabic Sources - Iraq
  // ========================================
  if (
    searchText.includes('shafaq.com') ||
    searchText.includes('shafaaq.com') ||
    searchText.includes('baghdadtoday.news') ||
    searchText.includes('alsumaria.tv') ||
    searchText.includes('شفق') ||
    searchText.includes('بغداد الیوم') ||
    searchText.includes('بغداد اليوم')
  ) {
    return 'عراق';
  }
  
  // ========================================
  // Arabic Sources - Lebanon
  // ========================================
  if (
    searchText.includes('elnashra.com') ||
    searchText.includes('annahar.com') ||
    searchText.includes('النهار')
  ) {
    return 'لبنان';
  }
  
  // ========================================
  // English Sources - USA
  // ========================================
  if (
    searchText.includes('cnn.com') ||
    searchText.includes('reuters.com') ||
    searchText.includes('nytimes.com') ||
    searchText.includes('washingtonpost.com') ||
    searchText.includes('apnews.com') ||
    (searchText.includes('cnn') && !searchText.includes('arabic')) ||
    searchText.includes('reuters') ||
    searchText.includes('ap news')
  ) {
    return 'آمریکا';
  }
  
  // ========================================
  // English Sources - UK
  // ========================================
  if (
    searchText.includes('bbc.com') ||
    searchText.includes('bbc.co.uk') ||
    searchText.includes('theguardian.com') ||
    searchText.includes('telegraph.co.uk') ||
    (searchText.includes('bbc') && !searchText.includes('arabic'))
  ) {
    return 'بریتانیا';
  }
  
  // ========================================
  // Other International Sources
  // ========================================
  if (searchText.includes('france24.com') || searchText.includes('france24')) {
    return 'فرانسه';
  }
  
  if (searchText.includes('dw.com') || searchText.includes('deutsche welle')) {
    return 'آلمان';
  }
  
  if (searchText.includes('trt.net.tr') || searchText.includes('trt')) {
    return 'ترکیه';
  }
  
  if (
    searchText.includes('rt.com') ||
    searchText.includes('sputniknews.com') ||
    searchText.includes('sputnik')
  ) {
    return 'روسیه';
  }
  
  // ========================================
  // Social Media & Aggregators
  // ========================================
  if (
    searchText.includes('news.google.com') ||
    searchText.includes('youtube.com') ||
    searchText.includes('t.me') ||
    searchText.includes('twitter.com') ||
    searchText.includes('x.com') ||
    searchText.includes('facebook.com') ||
    searchText.includes('telegram') ||
    searchText.includes('instagram.com')
  ) {
    return 'نامشخص';
  }
  
  // No match found
  return null;
}

/**
 * Get a list of all supported countries
 * Useful for displaying filter options or statistics
 */
export function getSupportedCountries(): string[] {
  return [
    'ایران',
    'قطر',
    'عربستان سعودی',
    'امارات',
    'مصر',
    'عراق',
    'لبنان',
    'آمریکا',
    'بریتانیا',
    'فرانسه',
    'آلمان',
    'ترکیه',
    'روسیه',
    'نامشخص',
  ];
}

/**
 * Get the color associated with a country for UI consistency
 * Returns HSL color values
 */
export function getCountryColor(country: string): string {
  const colorMap: Record<string, string> = {
    'ایران': 'hsl(145, 63%, 49%)',       // Green
    'قطر': 'hsl(282, 44%, 47%)',          // Purple
    'عربستان سعودی': 'hsl(27, 81%, 51%)', // Orange
    'امارات': 'hsl(204, 70%, 53%)',       // Blue
    'مصر': 'hsl(6, 78%, 57%)',            // Red
    'عراق': 'hsl(35, 89%, 51%)',          // Yellow
    'لبنان': 'hsl(168, 76%, 42%)',        // Teal
    'آمریکا': 'hsl(210, 14%, 37%)',       // Dark Gray
    'بریتانیا': 'hsl(207, 61%, 44%)',     // Blue
    'فرانسه': 'hsl(221, 64%, 53%)',       // Blue
    'آلمان': 'hsl(44, 100%, 50%)',        // Yellow
    'ترکیه': 'hsl(0, 100%, 50%)',         // Red
    'روسیه': 'hsl(221, 58%, 37%)',        // Dark Blue
    'نامشخص': 'hsl(210, 7%, 72%)',        // Light Gray
  };
  
  return colorMap[country] || 'hsl(0, 0%, 60%)';
}
