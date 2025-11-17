import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startPerformanceMonitoring } from './utils/performanceMonitor';
import './utils/networkMonitor'; // 🔥 Import networkMonitor to expose it to window

if (typeof window !== 'undefined') {
  startPerformanceMonitoring();
  console.log('🌐 Network monitor initialized and exposed to window');
}

createRoot(document.getElementById("root")!).render(<App />);
