import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startPerformanceMonitoring } from './utils/performanceMonitor';
import './utils/networkMonitor'; // 🔥 Import networkMonitor to expose it to window

if (typeof window !== 'undefined') {
  startPerformanceMonitoring();
  console.log('🌐 Network monitor initialized and exposed to window');

  // 🔥 Global page visibility monitoring
  let hiddenTime = 0;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenTime = Date.now();
      console.log('🔴 [Global] Page HIDDEN at', new Date().toLocaleTimeString());
    } else {
      const hiddenDuration = Date.now() - hiddenTime;
      console.log('🟢 [Global] Page VISIBLE after', (hiddenDuration / 1000).toFixed(1), 'seconds');

      // 🔥 اگه بیش از 5 ثانیه hidden بود، warn کن
      if (hiddenDuration > 5000) {
        console.warn('⚠️ [Global] Long absence detected! Some data might need refresh.');
      }
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
