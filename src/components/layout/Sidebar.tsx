import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, FileText, Brain, MessageSquare, AlertTriangle, TrendingUp, Settings, Newspaper, Wrench, BarChart3, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

const menuItems = [
  { icon: Home, label: 'داشبورد', path: '/dashboard' },
  { icon: Shield, label: 'تشخیص جنگ روانی', path: '/psyop-detection', badge: true },
  { icon: FileText, label: 'مطالب', path: '/posts' },
  { icon: Brain, label: 'تحلیل هوشمند', path: '/ai-analysis' },
  { icon: MessageSquare, label: 'گفتگو با داده‌ها', path: '/chat' },
  { icon: BarChart3, label: 'مصرف API', path: '/api-usage' },
  { icon: AlertTriangle, label: 'هشدارها', path: '/alerts' },
  { icon: TrendingUp, label: 'ترندها', path: '/trends' },
  { icon: Settings, label: 'تنظیمات', path: '/settings' },
  { icon: Wrench, label: 'Debug', path: '/debug' },
];

const Sidebar = () => {
  const [criticalCount, setCriticalCount] = useState(0);

  useEffect(() => {
    const fetchCriticalCount = async () => {
      try {
        const { count, error } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('is_psyop', true)
          .eq('threat_level', 'Critical')
          .neq('status', 'حل شده');
        
        if (error) throw error;
        setCriticalCount(count || 0);
      } catch (error) {
        console.error('Error fetching critical count:', error);
      }
    };

    fetchCriticalCount();

    // Real-time updates
    const channel = supabase
      .channel('sidebar-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts'
        },
        () => {
          fetchCriticalCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-smooth text-right relative',
                'hover:bg-accent',
                isActive && 'bg-primary/10 text-primary font-medium'
              )
            }
          >
            <span className="flex-1 text-right">{item.label}</span>
            <div className="flex items-center gap-2">
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {item.badge && criticalCount > 0 && (
                <Badge variant="destructive" className="text-xs px-2 animate-pulse">
                  {criticalCount}
                </Badge>
              )}
            </div>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
