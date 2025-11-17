// Network Request Monitor - Intercepts and tracks all fetch requests
// Helps identify request loops, slow requests, and network issues

interface RequestInfo {
  id: string;
  url: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  error?: string;
}

class NetworkMonitor {
  private requests: Map<string, RequestInfo> = new Map();
  private completedRequests: RequestInfo[] = [];
  private maxHistory = 100;

  constructor() {
    this.interceptFetch();
  }

  // Intercept all fetch requests
  private interceptFetch() {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const [url, options] = args;
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const requestInfo: RequestInfo = {
        id: requestId,
        url: url.toString(),
        method: (options?.method || 'GET').toUpperCase(),
        startTime: Date.now()
      };

      this.requests.set(requestId, requestInfo);

      console.log(`🌐 [Network] ${requestInfo.method} ${requestInfo.url} - STARTED`);

      try {
        const response = await originalFetch(...args);

        requestInfo.endTime = Date.now();
        requestInfo.duration = requestInfo.endTime - requestInfo.startTime;
        requestInfo.status = response.status;

        console.log(
          `✅ [Network] ${requestInfo.method} ${requestInfo.url} - ` +
          `${requestInfo.status} (${requestInfo.duration}ms)`
        );

        if (requestInfo.duration > 3000) {
          console.warn(
            `⚠️ [Network] SLOW REQUEST: ${requestInfo.url} took ${requestInfo.duration}ms`
          );
        }

        this.moveToCompleted(requestId);
        return response;
      } catch (error) {
        requestInfo.endTime = Date.now();
        requestInfo.duration = requestInfo.endTime - requestInfo.startTime;
        requestInfo.error = error instanceof Error ? error.message : 'Unknown error';

        console.error(
          `❌ [Network] ${requestInfo.method} ${requestInfo.url} - ` +
          `FAILED after ${requestInfo.duration}ms:`,
          error
        );

        this.moveToCompleted(requestId);
        throw error;
      }
    };
  }

  private moveToCompleted(requestId: string) {
    const request = this.requests.get(requestId);
    if (request) {
      this.completedRequests.push(request);
      this.requests.delete(requestId);

      // Keep only last N requests
      if (this.completedRequests.length > this.maxHistory) {
        this.completedRequests.shift();
      }
    }
  }

  // Get currently pending requests
  getPendingRequests(): RequestInfo[] {
    return Array.from(this.requests.values());
  }

  // Get completed requests
  getCompletedRequests(count: number = 20): RequestInfo[] {
    return this.completedRequests.slice(-count);
  }

  // Get request statistics
  getStats() {
    const pending = this.getPendingRequests();
    const completed = this.getCompletedRequests(100);

    const avgDuration = completed.length > 0
      ? completed.reduce((sum, req) => sum + (req.duration || 0), 0) / completed.length
      : 0;

    const failedCount = completed.filter(req => req.error).length;
    const successCount = completed.filter(req => !req.error).length;

    return {
      pending: pending.length,
      completed: completed.length,
      avgDuration: Math.round(avgDuration),
      failed: failedCount,
      success: successCount,
      pendingRequests: pending.map(req => ({
        url: req.url,
        method: req.method,
        age: Date.now() - req.startTime
      }))
    };
  }

  // Clear all history
  clear() {
    this.completedRequests = [];
    console.log('🗑️ Network history cleared');
  }
}

// Singleton instance
export const networkMonitor = new NetworkMonitor();

// Add to window for console access
if (typeof window !== 'undefined') {
  (window as any).networkMonitor = networkMonitor;

  // Helper function to show stats
  (window as any).showNetworkStats = () => {
    const stats = networkMonitor.getStats();
    console.table(stats);
    console.log('Pending Requests:', stats.pendingRequests);
  };
}

export default networkMonitor;
