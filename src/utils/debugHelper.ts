// Debug Utility for Performance and Issue Diagnosis
// This file provides comprehensive debugging tools for the application

interface DebugLog {
  timestamp: number;
  component: string;
  action: string;
  details?: any;
}

class DebugHelper {
  private logs: DebugLog[] = [];
  private maxLogs = 1000;
  private performanceMarks: Map<string, number> = new Map();

  // 📊 Log any operation
  log(component: string, action: string, details?: any) {
    const log: DebugLog = {
      timestamp: Date.now(),
      component,
      action,
      details
    };

    this.logs.push(log);

    // Remove old logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Display in console with formatting
    const time = new Date().toISOString().split('T')[1].slice(0, -1);
    console.log(
      `[${time}] [${component}] ${action}`,
      details || ''
    );
  }

  // ⏱️ Start performance measurement
  startMark(markName: string) {
    this.performanceMarks.set(markName, Date.now());
    console.log(`⏱️ [Performance] Started: ${markName}`);
  }

  // ⏱️ End performance measurement
  endMark(markName: string) {
    const startTime = this.performanceMarks.get(markName);
    if (startTime) {
      const duration = Date.now() - startTime;
      console.log(`⏱️ [Performance] ${markName}: ${duration}ms`);

      // Warning for slow operations
      if (duration > 1000) {
        console.warn(`⚠️ [Performance] SLOW OPERATION: ${markName} took ${duration}ms`);
      }

      this.performanceMarks.delete(markName);
      return duration;
    }
    return null;
  }

  // 🔍 Get recent logs
  getRecentLogs(count: number = 50): DebugLog[] {
    return this.logs.slice(-count);
  }

  // 💾 Export logs
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // 🗑️ Clear logs
  clearLogs() {
    this.logs = [];
    this.performanceMarks.clear();
    console.log('🗑️ All logs cleared');
  }

  // 📊 Get operation statistics
  getStats() {
    const stats: Record<string, number> = {};

    this.logs.forEach(log => {
      const key = `${log.component}:${log.action}`;
      stats[key] = (stats[key] || 0) + 1;
    });

    return Object.entries(stats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20);
  }
}

// Singleton instance
export const debugHelper = new DebugHelper();

// Helper functions for easier usage
export const logDebug = (component: string, action: string, details?: any) => {
  debugHelper.log(component, action, details);
};

export const startPerf = (markName: string) => {
  debugHelper.startMark(markName);
};

export const endPerf = (markName: string) => {
  return debugHelper.endMark(markName);
};

// Add to window for console access
if (typeof window !== 'undefined') {
  (window as any).debugHelper = debugHelper;
}
