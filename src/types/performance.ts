// src/types/performance.ts
// Type definitions for Performance Monitoring System

export interface PerformanceMetric {
  id: string;
  created_at: string;

  // Page Information
  page_path: string;
  page_title?: string;

  // Core Web Vitals
  fcp?: number; // First Contentful Paint (ms)
  lcp?: number; // Largest Contentful Paint (ms)
  cls?: number; // Cumulative Layout Shift (score)
  fid?: number; // First Input Delay (ms)
  ttfb?: number; // Time to First Byte (ms)

  // Performance Timing
  page_load_time?: number;
  dom_content_loaded?: number;
  dom_interactive?: number;

  // Resources
  total_resources?: number;
  total_size?: number;
  js_count?: number;
  css_count?: number;
  image_count?: number;
  font_count?: number;

  // Network
  connection_time?: number;
  render_time?: number;

  // User Context
  user_agent?: string;
  viewport_width?: number;
  viewport_height?: number;
  connection_type?: string;

  // Session
  session_id?: string;
  user_id?: string;
}

export interface WebVitalsData {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  unit: string;
  label: string; // فارسی
}

export interface PagePerformance {
  path: string;
  title: string;
  avgLoadTime: number;
  avgLCP: number;
  avgFCP: number;
  visits: number;
  issues: string[];
}

export interface PerformanceSummary {
  overall_score: number; // 0-100
  total_pages_measured: number;
  avg_page_load: number;
  avg_fcp: number;
  avg_lcp: number;
  avg_cls: number;
  avg_fid: number;
  avg_ttfb: number;
  health_status: 'excellent' | 'good' | 'needs-improvement' | 'poor';
  critical_issues: number;
  warnings: number;
}

export interface ResourceBreakdown {
  type: string;
  count: number;
  size: number;
  percentage: number;
  color: string;
}

export interface PerformanceTrend {
  date: string;
  avg_load_time: number;
  avg_fcp: number;
  avg_lcp: number;
  measurements: number;
}

export interface PerformanceRecommendation {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: 'loading' | 'interactivity' | 'visual-stability' | 'resources' | 'network';
}

// Web Vitals thresholds
export const WEB_VITALS_THRESHOLDS = {
  FCP: { good: 1800, needsImprovement: 3000 },
  LCP: { good: 2500, needsImprovement: 4000 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FID: { good: 100, needsImprovement: 300 },
  TTFB: { good: 800, needsImprovement: 1800 }
} as const;

// Helper function to get rating
export const getRating = (
  metricName: keyof typeof WEB_VITALS_THRESHOLDS,
  value: number
): 'good' | 'needs-improvement' | 'poor' => {
  const threshold = WEB_VITALS_THRESHOLDS[metricName];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.needsImprovement) return 'needs-improvement';
  return 'poor';
};

// Helper function to get Persian name
export const getMetricLabel = (metricName: string): string => {
  const labels: Record<string, string> = {
    'FCP': 'اولین نمایش محتوا',
    'LCP': 'بزرگترین نمایش محتوا',
    'CLS': 'تغییر جابجایی بصری',
    'FID': 'تاخیر اولین تعامل',
    'TTFB': 'زمان پاسخ سرور',
    'pageLoadTime': 'زمان بارگذاری کامل',
    'domContentLoaded': 'آماده‌سازی DOM',
    'totalResources': 'تعداد منابع',
    'totalSize': 'حجم کل'
  };
  return labels[metricName] || metricName;
};

// Helper function to get metric unit
export const getMetricUnit = (metricName: string): string => {
  if (metricName === 'CLS') return 'score';
  if (metricName.includes('Size')) return 'MB';
  if (metricName.includes('count') || metricName === 'totalResources') return '';
  return 'ms';
};

// Helper function to calculate overall score
export const calculateOverallScore = (metrics: Partial<PerformanceMetric>): number => {
  let score = 100;

  // FCP (20 points)
  if (metrics.fcp) {
    const fcpRating = getRating('FCP', metrics.fcp);
    if (fcpRating === 'needs-improvement') score -= 10;
    if (fcpRating === 'poor') score -= 20;
  }

  // LCP (25 points)
  if (metrics.lcp) {
    const lcpRating = getRating('LCP', metrics.lcp);
    if (lcpRating === 'needs-improvement') score -= 12;
    if (lcpRating === 'poor') score -= 25;
  }

  // CLS (15 points)
  if (metrics.cls) {
    const clsRating = getRating('CLS', metrics.cls);
    if (clsRating === 'needs-improvement') score -= 7;
    if (clsRating === 'poor') score -= 15;
  }

  // FID (20 points)
  if (metrics.fid) {
    const fidRating = getRating('FID', metrics.fid);
    if (fidRating === 'needs-improvement') score -= 10;
    if (fidRating === 'poor') score -= 20;
  }

  // TTFB (20 points)
  if (metrics.ttfb) {
    const ttfbRating = getRating('TTFB', metrics.ttfb);
    if (ttfbRating === 'needs-improvement') score -= 10;
    if (ttfbRating === 'poor') score -= 20;
  }

  return Math.max(0, score);
};

// Helper function to get health status
export const getHealthStatus = (
  score: number
): 'excellent' | 'good' | 'needs-improvement' | 'poor' => {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'needs-improvement';
  return 'poor';
};

// Helper function to format bytes
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
