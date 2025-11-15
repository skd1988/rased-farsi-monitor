import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/NewAuthContext";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import DashboardLayout from "./pages/DashboardLayout";
import Unauthorized from "./pages/Unauthorized";
import Dashboard from "./pages/Dashboard";
import PsyOpDetection from "./pages/PsyOpDetection";
import CampaignTracking from "./pages/CampaignTracking";
import TargetAnalysis from "./pages/TargetAnalysis";
import SourceIntelligence from "./pages/SourceIntelligence";
import ChannelAnalytics from "./pages/ChannelAnalytics";
import PostsExplorer from "./pages/PostsExplorer";
import AIAnalysis from "./pages/AIAnalysis";
import Chat from "./pages/Chat";
import SettingsNew from '@/pages/settings';
import IntelligenceAndTrends from "./pages/IntelligenceAndTrends";
import APIUsage from "./pages/APIUsage";
import SettingsAPIUsage from "./pages/settings/APIUsage";
import PhotoManagement from "./pages/settings/PhotoManagement";
import UserManagement from "./pages/settings/UserManagement";
import InoreaderSettings from "./pages/InoreaderSettings";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";
import ResponseManagement from "./pages/ResponseManagement";
import SystemTest from "./pages/SystemTest";
import Debug from "./pages/Debug";
import GoogleSheetsSync from "./pages/GoogleSheetsSync";
import OperationsHistory from "./pages/OperationsHistory";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <div dir="rtl" className="min-h-screen">
              <Toaster />
              <Sonner position="top-center" />
              <HashRouter>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/unauthorized" element={<Unauthorized />} />
                  <Route path="/debug" element={<Debug />} />
                  
                  <Route element={
                    <ProtectedRoute requiredPermission="VIEW_POSTS">
                      <DashboardLayout />
                    </ProtectedRoute>
                  }>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/psyop-detection" element={<PsyOpDetection />} />
                    <Route path="/campaign-tracking" element={<CampaignTracking />} />
                    <Route path="/target-analysis" element={<TargetAnalysis />} />
                    <Route path="/source-intelligence" element={<SourceIntelligence />} />
                    <Route path="/channel-analytics" element={<ChannelAnalytics />} />
                    <Route path="/posts" element={<PostsExplorer />} />
                    
                    <Route path="/ai-analysis" element={
                      <ProtectedRoute requiredPermission="REQUEST_AI_ANALYSIS" showUnauthorized>
                        <AIAnalysis />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/chat" element={
                      <ProtectedRoute requiredPermission="USE_CHAT" showUnauthorized>
                        <Chat />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/api-usage" element={
                      <ProtectedRoute requiredPermission="VIEW_API_USAGE" showUnauthorized>
                        <APIUsage />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/settings/api-usage" element={
                      <ProtectedRoute requiredPermission="VIEW_API_USAGE" showUnauthorized>
                        <SettingsAPIUsage />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/settings/photo-management" element={<PhotoManagement />} />
                    
                    <Route path="/settings/users" element={
                      <ProtectedRoute requiredPermission="MANAGE_USERS" showUnauthorized>
                        <UserManagement />
                      </ProtectedRoute>
                    } />

                    <Route path="/settings/inoreader" element={<InoreaderSettings />} />

                    <Route path="/response-management" element={<ResponseManagement />} />
                    
                    <Route path="/settings" element={
                      <ProtectedRoute requiredPermission="MANAGE_SETTINGS" showUnauthorized>
                        <SettingsNew />
                      </ProtectedRoute>
                    } />

                    <Route path="/google-sheets-sync" element={
                      <ProtectedRoute requiredPermission="MANAGE_SETTINGS" showUnauthorized>
                        <GoogleSheetsSync />
                      </ProtectedRoute>
                    } />

                    <Route path="/intelligence" element={<IntelligenceAndTrends />} />
                    <Route path="/operations-history" element={<OperationsHistory />} />
                    <Route path="/system-test" element={<SystemTest />} />
                  </Route>
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </HashRouter>
            </div>
          </ErrorBoundary>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
