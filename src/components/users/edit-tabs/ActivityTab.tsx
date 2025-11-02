import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Brain,
  MessageSquare,
  Download,
  AlertCircle,
  LogIn,
  Eye,
  FileText,
  Activity as ActivityIcon,
  Download as DownloadIcon
} from 'lucide-react';
import { User as UserType } from '@/pages/settings/UserManagement';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface ActivityTabProps {
  user: UserType;
}

interface ActivityStats {
  total_logins: number;
  ai_analysis: number;
  chat_messages: number;
  exports: number;
}

export const ActivityTab: React.FC<ActivityTabProps> = ({ user }) => {
  const [stats, setStats] = useState<ActivityStats>({
    total_logins: 0,
    ai_analysis: 0,
    chat_messages: 0,
    exports: 0
  });

  useEffect(() => {
    fetchActivityStats();
  }, [user.id]);

  const fetchActivityStats = async () => {
    try {
      // Fetch usage stats
      const { data: usageData, error: usageError } = await supabase
        .from('user_daily_usage')
        .select('ai_analysis, chat_messages, exports')
        .eq('user_id', user.id);

      if (usageError) throw usageError;

      if (usageData) {
        const totals = usageData.reduce((acc, day) => ({
          ai_analysis: acc.ai_analysis + (day.ai_analysis || 0),
          chat_messages: acc.chat_messages + (day.chat_messages || 0),
          exports: acc.exports + (day.exports || 0)
        }), { ai_analysis: 0, chat_messages: 0, exports: 0 });

        setStats({
          total_logins: 0, // Would need to track this separately
          ...totals
        });
      }
    } catch (error) {
      console.error('Error fetching activity stats:', error);
    }
  };

  const statsCards = [
    { label: 'تحلیل AI', value: stats.ai_analysis, icon: Brain, color: 'text-purple-500' },
    { label: 'پیام‌های Chat', value: stats.chat_messages, icon: MessageSquare, color: 'text-blue-500' },
    { label: 'Export', value: stats.exports, icon: DownloadIcon, color: 'text-green-500' },
  ];

  // Mock activity timeline - in production, this would come from an activity log table
  const activities = [
    {
      id: 1,
      type: 'ai_analysis',
      action: 'درخواست تحلیل AI',
      resource: 'Post RSS-123',
      time: new Date(Date.now() - 2 * 60 * 60 * 1000),
      icon: Brain,
      color: 'text-purple-500'
    },
    {
      id: 2,
      type: 'chat',
      action: 'ارسال پیام در Chat',
      resource: 'گفتگو #45',
      time: new Date(Date.now() - 4 * 60 * 60 * 1000),
      icon: MessageSquare,
      color: 'text-blue-500'
    },
    {
      id: 3,
      type: 'export',
      action: 'Export گزارش',
      resource: 'Report-2024-01.pdf',
      time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      icon: Download,
      color: 'text-green-500'
    },
    {
      id: 4,
      type: 'login',
      action: 'ورود به سیستم',
      resource: 'Chrome on Mac',
      time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      icon: LogIn,
      color: 'text-gray-500'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Activity Stats */}
      <div>
        <h3 className="text-lg font-semibold mb-4">آمار فعالیت</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statsCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Activity Timeline */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">تاریخچه فعالیت</h3>
          <Button variant="outline" size="sm" className="gap-2">
            <DownloadIcon className="h-4 w-4" />
            Export فعالیت‌ها
          </Button>
        </div>

        <Card className="p-4">
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {activities.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div key={activity.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className={`h-4 w-4 ${activity.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{activity.action}</p>
                      <p className="text-sm text-muted-foreground">{activity.resource}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(activity.time, { addSuffix: true })}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Login History */}
      <div>
        <h3 className="text-lg font-semibold mb-4">تاریخچه ورود</h3>
        <Card className="p-4">
          <div className="space-y-3">
            {user.last_login && (
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-3">
                  <LogIn className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">آخرین ورود</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(user.last_login), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">موفق</Badge>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center py-4">
              تاریخچه کامل ورود به سیستم در نسخه‌های بعدی اضافه خواهد شد
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
