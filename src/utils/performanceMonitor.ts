// src/utils/performanceMonitor.ts
// Core utility for collecting and reporting performance metrics

import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals';
import { supabase } from '@/integrations/supabase/client';
import type { PerformanceMetric } from '@/types/performance';

// Generate unique session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('perf_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('perf_session_id', sessionId);
  }
  return sessionId;
};

// Get connection type from Network Information API
const getConnectionType = (): string => {
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    return conn?.effectiveType || 'unknown';
  }
  return 'unknown';
};

// Store for collected metrics
const metricsStore: Partial<PerformanceMetric> = {
  page_path: window.location.pathname,
  page_title: document.title,
  session_id: getSessionId(),
  user_agent: navigator.userAgent,
  viewport_width: window.innerWidth,
  viewport_height: window.innerHeight,
  connection_type: getConnectionType()
};

// Collect Web Vitals
export const initWebVitals = () => {
  getCLS((metric: Metric) => {
    metricsStore.cls = metric.value;
    console.log('[Performance] CLS:', metric.value);
  });

  getFID((metric: Metric) => {
    metricsStore.fid = metric.value;
    console.log('[Performance] FID:', metric.value);
  });

  getFCP((metric: Metric) => {
    metricsStore.fcp = metric.value;
    console.log('[Performance] FCP:', metric.value);
  });

  getLCP((metric: Metric) => {
    metricsStore.lcp = metric.value;
    console.log('[Performance] LCP:', metric.value);
  });

  getTTFB((metric: Metric) => {
    metricsStore.ttfb = metric.value;
    console.log('[Performance] TTFB:', metric.value);
  });
};

// Collect Performance Timing metrics
export const collectPerformanceTiming = () => {
  if (!performance || !performance.timing) {
    console.warn('[Performance] Performance API not supported');
    return;
  }

  const timing = performance.timing;

  metricsStore.page_load_time = timing.loadEventEnd - timing.navigationStart;
  metricsStore.dom_content_loaded = timing.domContentLoadedEventEnd - timing.navigationStart;
  metricsStore.dom_interactive = timing.domInteractive - timing.navigationStart;
  metricsStore.connection_time = timing.responseEnd - timing.requestStart;
  metricsStore.render_time = timing.domComplete - timing.domLoading;

  console.log('[Performance] Timing metrics collected:', {
    pageLoadTime: metricsStore.page_load_time,
    domContentLoaded: metricsStore.dom_content_loaded,
    ttfb: metricsStore.ttfb
  });
};

// Collect Resource metrics
export const collectResourceMetrics = () => {
  if (!performance || !performance.getEntriesByType) {
    console.warn('[Performance] Resource Timing API not supported');
    return;
  }

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  metricsStore.total_resources = resources.length;
  metricsStore.js_count = resources.filter(r =>
    r.initiatorType === 'script' || r.name.endsWith('.js')
  ).length;
  metricsStore.css_count = resources.filter(r =>
    r.initiatorType === 'css' || r.initiatorType === 'link' || r.name.endsWith('.css')
  ).length;
  metricsStore.image_count = resources.filter(r =>
    r.initiatorType === 'img' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(r.name)
  ).length;
  metricsStore.font_count = resources.filter(r =>
    /\.(woff|woff2|ttf|otf|eot)$/i.test(r.name)
  ).length;

  // Calculate total transfer size
  metricsStore.total_size = resources.reduce((sum, r) => {
    return sum + (r.transferSize || 0);
  }, 0);

  console.log('[Performance] Resource metrics collected:', {
    totalResources: metricsStore.total_resources,
    totalSize: `${(metricsStore.total_size! / 1024 / 1024).toFixed(2)} MB`,
    js: metricsStore.js_count,
    css: metricsStore.css_count,
    images: metricsStore.image_count,
    fonts: metricsStore.font_count
  });
};

// Send metrics to Supabase
export const reportPerformanceMetrics = async () => {
  try {
    // Get current user if logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      metricsStore.user_id = user.id;
    }

    const { error } = await supabase
      .from('performance_metrics')
      .insert([metricsStore]);

    if (error) {
      console.error('[Performance] Error saving metrics:', error);
    } else {
      console.log('[Performance] ✅ Metrics saved successfully');
    }
  } catch (error) {
    console.error('[Performance] Error reporting metrics:', error);
  }
};

// Main monitoring function
export const startPerformanceMonitoring = () => {
  console.log('[Performance] 🚀 Starting performance monitoring...');

  // Initialize Web Vitals collection
  initWebVitals();

  // Wait for page to fully load
  if (document.readyState === 'complete') {
    collectPerformanceTiming();
    collectResourceMetrics();

    // Report after a short delay to ensure all metrics are collected
    setTimeout(reportPerformanceMetrics, 2000);
  } else {
    window.addEventListener('load', () => {
      collectPerformanceTiming();
      collectResourceMetrics();
      setTimeout(reportPerformanceMetrics, 2000);
    });
  }

  // Report Web Vitals when user leaves the page
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      reportPerformanceMetrics();
    }
  });
};

// Export current metrics for display
export const getCurrentMetrics = (): Partial<PerformanceMetric> => {
  return { ...metricsStore };
};

// Helper function to clear session storage on new session
export const resetPerformanceSession = () => {
  sessionStorage.removeItem('perf_session_id');
  console.log('[Performance] Session reset');
};
