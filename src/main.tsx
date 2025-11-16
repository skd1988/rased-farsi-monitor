import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startPerformanceMonitoring } from './utils/performanceMonitor';

if (typeof window !== 'undefined') {
  startPerformanceMonitoring();
}

createRoot(document.getElementById("root")!).render(<App />);
