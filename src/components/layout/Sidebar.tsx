import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, FileText, Brain, AlertTriangle, TrendingUp, Settings, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { icon: Home, label: 'داشبورد', path: '/dashboard' },
  { icon: FileText, label: 'مطالب', path: '/posts' },
  { icon: Brain, label: 'تحلیل هوشمند', path: '/ai-analysis' },
  { icon: AlertTriangle, label: 'هشدارها', path: '/alerts' },
  { icon: TrendingUp, label: 'ترندها', path: '/trends' },
  { icon: Settings, label: 'تنظیمات', path: '/settings' },
];

const Sidebar = () => {
  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Newspaper className="w-6 h-6 text-primary" />
          </div>
          <div className="text-right">
            <h2 className="font-bold text-lg">رصد رسانه‌ای</h2>
            <p className="text-xs text-muted-foreground">نسخه 1.0</p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-smooth text-right',
                'hover:bg-accent',
                isActive && 'bg-primary/10 text-primary font-medium'
              )
            }
          >
            <span className="flex-1 text-right">{item.label}</span>
            <item.icon className="w-5 h-5 flex-shrink-0" />
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
