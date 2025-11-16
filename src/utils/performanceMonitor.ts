// src/utils/performanceMonitor.ts
// Core utility for collecting and reporting performance metrics
// Updated for web-vitals v5 and modern Navigation Timing API

import { onCLS, onINP, onFCP, onLCP, onTTFB } from 'web-vitals';
import type { Metric } from 'web-vitals';
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
  onCLS((metric) => {
    metricsStore.cls = metric.value;
    console.log('[Performance] CLS:', metric.value);
  });

  // INP replaced FID in web-vitals v4+
  onINP((metric) => {
    metricsStore.fid = metric.value; // Store as fid for backward compatibility
    console.log('[Performance] INP (replacing FID):', metric.value);
  });

  onFCP((metric) => {
    metricsStore.fcp = metric.value;
    console.log('[Performance] FCP:', metric.value);
  });

  onLCP((metric) => {
    metricsStore.lcp = metric.value;
    console.log('[Performance] LCP:', metric.value);
  });

  onTTFB((metric) => {
    metricsStore.ttfb = metric.value;
    console.log('[Performance] TTFB:', metric.value);
  });
};

// Collect Performance Timing metrics using Navigation Timing API Level 2
export const collectPerformanceTiming = () => {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  
  if (!navigation) {
    console.warn('[Performance] Navigation Timing API not supported');
    return;
  }

  // Use proper Navigation Timing API Level 2
  metricsStore.page_load_time = Math.round(navigation.loadEventEnd - navigation.fetchStart);
  metricsStore.dom_content_loaded = Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart);
  metricsStore.dom_interactive = Math.round(navigation.domInteractive - navigation.fetchStart);
  metricsStore.connection_time = Math.round(navigation.responseEnd - navigation.requestStart);
  metricsStore.render_time = Math.round(navigation.domComplete - navigation.domLoading);

  console.log('[Performance] Timing metrics collected:', {
    pageLoadTime: metricsStore.page_load_time,
    domContentLoaded: metricsStore.dom_content_loaded,
    connectionTime: metricsStore.connection_time,
    renderTime: metricsStore.render_time
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
    // Validate data before sending
    if (metricsStore.page_load_time && metricsStore.page_load_time < 0) {
      console.warn('[Performance] Invalid page_load_time, skipping report');
      return;
    }

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