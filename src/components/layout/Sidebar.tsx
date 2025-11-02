import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  FileText, 
  Brain, 
  MessageSquare, 
  AlertTriangle, 
  TrendingUp, 
  Settings, 
  Newspaper, 
  Wrench, 
  Activity, 
  Shield, 
  Network, 
  Target,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface MenuItem {
  label: string;
  icon: any;
  route: string;
  badge?: { type: 'count' | 'label'; source?: string; label?: string };
  description?: string;
}

interface MenuGroup {
  id: string;
  title?: string;
  collapsible?: boolean;
  items: MenuItem[];
}

const menuStructure: MenuGroup[] = [
  {
    id: 'overview',
    items: [
      { 
        label: 'داشبورد', 
        icon: Home, 
        route: '/dashboard',
        description: 'نمای کلی سیستم'
      }
    ]
  },
  {
    id: 'monitoring',
    title: 'رصد و تحلیل',
    collapsible: false,
    items: [
      { 
        label: 'شناسایی PsyOp', 
        icon: AlertTriangle, 
        route: '/psyop-detection',
        badge: { type: 'count', source: 'criticalThreats' },
        description: 'شناسایی عملیات روانی'
      },
      { 
        label: 'کمپین‌های هماهنگ', 
        icon: Network, 
        route: '/campaign-tracking',
        badge: { type: 'count', source: 'activeCampaigns' },
        description: 'ردیابی کمپین‌ها'
      },
      { 
        label: 'تحلیل اهداف', 
        icon: Target, 
        route: '/target-analysis',
        description: 'اهداف و الگوهای حملات'
      },
      { 
        label: 'هوش و روندها', 
        icon: TrendingUp, 
        route: '/intelligence',
        description: 'تحلیل روندها و الگوها'
      }
    ]
  },
  {
    id: 'response',
    title: 'مدیریت پاسخ',
    collapsible: false,
    items: [
      { 
        label: 'مدیریت پاسخ‌ها', 
        icon: Shield, 
        route: '/response-management',
        badge: { type: 'count', source: 'urgentResponses' },
        description: 'آماده‌سازی ضدروایت'
      },
      { 
        label: 'گفتگو با داده‌ها', 
        icon: MessageSquare, 
        route: '/chat',
        description: 'پرسش و پاسخ هوشمند'
      }
    ]
  },
  {
    id: 'data',
    title: 'داده‌ها',
    collapsible: true,
    items: [
      { 
        label: 'مطالب', 
        icon: FileText, 
        route: '/posts',
        description: 'جستجو و مرور مطالب'
      },
      { 
        label: 'تحلیل هوشمند', 
        icon: Brain, 
        route: '/ai-analysis',
        description: 'نتایج تحلیل AI'
      }
    ]
  },
  {
    id: 'system',
    title: 'سیستم',
    collapsible: true,
    items: [
      { 
        label: 'تنظیمات', 
        icon: Settings, 
        route: '/settings',
        description: 'پیکربندی سیستم'
      },
      { 
        label: 'مصرف API', 
        icon: Activity, 
        route: '/api-usage',
        description: 'آمار و هزینه API'
      },
      { 
        label: 'تست سیستم', 
        icon: Wrench, 
        route: '/system-test',
        badge: { type: 'label', label: 'Debug' },
        description: 'تست و دیباگ'
      }
    ]
  }
];

const Sidebar = () => {
  const [criticalCount, setCriticalCount] = useState(0);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [urgentResponses, setUrgentResponses] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>(() => {
    const saved = localStorage.getItem('sidebar-collapsed-groups');
    return saved ? JSON.parse(saved) : { data: false, system: true };
  });

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

  const getBadgeValue = (badge?: { type: 'count' | 'label'; source?: string; label?: string }) => {
    if (!badge) return null;
    
    if (badge.type === 'label') {
      return badge.label;
    }
    
    if (badge.type === 'count') {
      if (badge.source === 'criticalThreats') return criticalCount;
      if (badge.source === 'activeCampaigns') return activeCampaigns;
      if (badge.source === 'urgentResponses') return urgentResponses;
    }
    
    return null;
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const newState = { ...prev, [groupId]: !prev[groupId] };
      localStorage.setItem('sidebar-collapsed-groups', JSON.stringify(newState));
      return newState;
    });
  };

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-screen overflow-y-auto">
      {/* Logo */}
      <div className="p-6 border-b border-border sticky top-0 bg-card z-10">
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
      <nav className="flex-1 p-4">
        {menuStructure.map((group, groupIndex) => (
          <div 
            key={group.id} 
            className={cn(groupIndex > 0 && 'mt-6')}
          >
            {/* Group Header */}
            {group.title && (
              <div className="flex items-center justify-between mb-2 px-3">
                <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                  {group.title}
                </h3>
                {group.collapsible && (
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="p-1 hover:bg-accent rounded transition-colors"
                  >
                    {collapsedGroups[group.id] ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Group Items */}
            <div 
              className={cn(
                'space-y-1 transition-all duration-200',
                group.collapsible && collapsedGroups[group.id] && 'hidden'
              )}
            >
              {group.items.map((item) => {
                const badgeValue = getBadgeValue(item.badge);
                const showBadge = badgeValue !== null && (
                  item.badge?.type === 'label' || 
                  (item.badge?.type === 'count' && typeof badgeValue === 'number' && badgeValue > 0)
                );

                return (
                  <NavLink
                    key={item.route}
                    to={item.route}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-between px-3 py-2.5 rounded-lg transition-smooth text-right relative group',
                        'hover:bg-accent',
                        isActive && 'bg-primary/10 text-primary font-medium border-r-4 border-primary'
                      )
                    }
                    title={item.description}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    
                    {showBadge && (
                      <Badge 
                        variant={item.badge?.type === 'count' ? 'destructive' : 'secondary'}
                        className={cn(
                          'text-xs px-2',
                          item.badge?.type === 'count' && 'animate-pulse'
                        )}
                      >
                        {badgeValue}
                      </Badge>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
