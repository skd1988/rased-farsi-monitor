import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, FileText, Brain, MessageSquare, AlertTriangle, TrendingUp, Settings, Newspaper, Wrench, BarChart3, Shield, Radar, Target, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

const menuItems = [
  { icon: Home, label: 'داشبورد', path: '/dashboard' },
  { icon: Shield, label: 'تشخیص جنگ روانی', path: '/psyop-detection', badge: 'critical' },
  { icon: Radar, label: 'رصد کمپین‌ها', path: '/campaign-tracking', badge: 'campaigns' },
  { icon: Target, label: 'تحلیل اهداف', path: '/target-analysis' },
  { icon: ShieldCheck, label: 'مدیریت پاسخ‌ها', path: '/response-management', badge: 'urgent' },
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
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [urgentResponses, setUrgentResponses] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // Fetch critical threats count
        const { count: criticalThreats, error: criticalError } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('is_psyop', true)
          .eq('threat_level', 'Critical')
          .neq('status', 'حل شده');
        
        if (criticalError) throw criticalError;
        setCriticalCount(criticalThreats || 0);

        // Fetch active campaigns count
        const { count: campaignsCount, error: campaignsError } = await supabase
          .from('psyop_campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Active');
        
        if (campaignsError) throw campaignsError;
        setActiveCampaigns(campaignsCount || 0);

        // Fetch urgent responses (Critical posts detected in last 2 hours)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { count: urgentCount, error: urgentError } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('is_psyop', true)
          .eq('threat_level', 'Critical')
          .neq('status', 'حل شده')
          .gte('published_at', twoHoursAgo);
        
        if (urgentError) throw urgentError;
        setUrgentResponses(urgentCount || 0);
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    };

    fetchCounts();

    // Real-time updates for posts
    const postsChannel = supabase
      .channel('sidebar-posts-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts'
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    // Real-time updates for campaigns
    const campaignsChannel = supabase
      .channel('sidebar-campaigns-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'psyop_campaigns'
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(campaignsChannel);
    };
  }, []);

  const getBadgeCount = (badgeType: string | undefined) => {
    if (badgeType === 'critical') return criticalCount;
    if (badgeType === 'campaigns') return activeCampaigns;
    if (badgeType === 'urgent') return urgentResponses;
    return 0;
  };

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
              {item.badge && getBadgeCount(item.badge) > 0 && (
                <Badge variant="destructive" className="text-xs px-2 animate-pulse">
                  {getBadgeCount(item.badge)}
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
