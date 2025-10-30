import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import DashboardLayout from "./pages/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-center" />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<DashboardLayout />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="posts" element={<ComingSoon title="مطالب" description="صفحه مدیریت مطالب به زودی راه‌اندازی می‌شود" />} />
                <Route path="ai-analysis" element={<ComingSoon title="تحلیل هوشمند" description="امکانات تحلیل با هوش مصنوعی به زودی اضافه خواهد شد" />} />
                <Route path="alerts" element={<ComingSoon title="هشدارها" description="سیستم هشدارهای هوشمند به زودی فعال می‌شود" />} />
                <Route path="trends" element={<ComingSoon title="ترندها" description="تحلیل روندهای رسانه‌ای به زودی در دسترس خواهد بود" />} />
                <Route path="settings" element={<ComingSoon title="تنظیمات" description="صفحه تنظیمات به زودی راه‌اندازی می‌شود" />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
