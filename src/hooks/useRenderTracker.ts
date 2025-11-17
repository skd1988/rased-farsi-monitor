// Component Render Tracker - Monitors component re-renders
// Helps identify excessive rendering and render loops

import { useEffect, useRef } from 'react';

interface RenderInfo {
  component: string;
  renderCount: number;
  lastRender: number;
  renders: number[];
}

class RenderTracker {
  private components: Map<string, RenderInfo> = new Map();

  trackRender(componentName: string) {
    const now = Date.now();
    const info = this.components.get(componentName);

    if (info) {
      info.renderCount++;
      info.lastRender = now;
      info.renders.push(now);

      // Keep only last 50 renders
      if (info.renders.length > 50) {
        info.renders.shift();
      }

      // Warning for excessive renders
      if (info.renderCount > 20) {
        console.warn(
          `⚠️ [Render] ${componentName} has rendered ${info.renderCount} times!`
        );
      }

      // Warning for rapid sequential renders
      if (info.renders.length >= 2) {
        const lastTwo = info.renders.slice(-2);
        const timeDiff = lastTwo[1] - lastTwo[0];
        if (timeDiff < 100) {
          console.warn(
            `⚠️ [Render] ${componentName} rendered twice within ${timeDiff}ms`
          );
        }
      }
    } else {
      this.components.set(componentName, {
        component: componentName,
        renderCount: 1,
        lastRender: now,
        renders: [now]
      });
    }
  }

  getStats() {
    const stats = Array.from(this.components.values())
      .map(info => ({
        component: info.component,
        renderCount: info.renderCount,
        avgTimeBetweenRenders: this.calculateAvgTime(info.renders),
        lastRender: new Date(info.lastRender).toLocaleTimeString()
      }))
      .sort((a, b) => b.renderCount - a.renderCount);

    return stats;
  }

  private calculateAvgTime(renders: number[]): number {
    if (renders.length < 2) return 0;

    let totalTime = 0;
    for (let i = 1; i < renders.length; i++) {
      totalTime += renders[i] - renders[i - 1];
    }

    return Math.round(totalTime / (renders.length - 1));
  }

  clear() {
    this.components.clear();
    console.log('🗑️ Render tracking cleared');
  }
}

export const renderTracker = new RenderTracker();

// Hook for tracking component renders
export function useRenderTracker(componentName: string) {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current++;
    renderTracker.trackRender(componentName);

    console.log(`🔄 [${componentName}] Render #${renderCount.current}`);
  });

  return renderCount.current;
}

// Add to window for console access
if (typeof window !== 'undefined') {
  (window as any).renderTracker = renderTracker;
  (window as any).showRenderStats = () => {
    console.table(renderTracker.getStats());
  };
}
