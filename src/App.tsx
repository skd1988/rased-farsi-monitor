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
import PsyOpDetection from "./pages/PsyOpDetection";
import CampaignTracking from "./pages/CampaignTracking";
import TargetAnalysis from "./pages/TargetAnalysis";
import PostsExplorer from "./pages/PostsExplorer";
import AIAnalysis from "./pages/AIAnalysis";
import Chat from "./pages/Chat";
import Alerts from "./pages/Alerts";
import Settings from "./pages/Settings";
import IntelligenceAndTrends from "./pages/IntelligenceAndTrends";
import APIUsage from "./pages/APIUsage";
import SettingsAPIUsage from "./pages/settings/APIUsage";
import ComingSoon from "./pages/ComingSoon";
import Debug from "./pages/Debug";
import NotFound from "./pages/NotFound";
import ResponseManagement from "./pages/ResponseManagement";
import BatchAnalysis from "./pages/BatchAnalysis";
import SystemTest from "./pages/SystemTest";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <div dir="rtl" className="min-h-screen">
            <Toaster />
            <Sonner position="top-center" />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<DashboardLayout />}>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="psyop-detection" element={<PsyOpDetection />} />
                  <Route path="campaign-tracking" element={<CampaignTracking />} />
                  <Route path="target-analysis" element={<TargetAnalysis />} />
                  <Route path="posts" element={<PostsExplorer />} />
                  <Route path="ai-analysis" element={<AIAnalysis />} />
                  <Route path="chat" element={<Chat />} />
                  <Route path="api-usage" element={<APIUsage />} />
                  <Route path="settings/api-usage" element={<SettingsAPIUsage />} />
                  <Route path="alerts" element={<Alerts />} />
                  <Route path="response-management" element={<ResponseManagement />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="intelligence" element={<IntelligenceAndTrends />} />
                  <Route path="batch-analysis" element={<BatchAnalysis />} />
                  <Route path="system-test" element={<SystemTest />} />
                  <Route path="debug" element={<Debug />} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </div>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
