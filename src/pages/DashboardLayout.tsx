import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import ChatPanel from '@/components/ChatPanel';

const DashboardLayout = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);
  
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <div className="min-h-screen flex w-full bg-background overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-x-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <ChatPanel />
    </div>
  );
};

export default DashboardLayout;
