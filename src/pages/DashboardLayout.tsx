import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

const DashboardLayout = () => {
  console.log('[DashboardLayout] Rendering...');
  
  return (
    <div className="min-h-screen flex w-full bg-background overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-x-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
