import React from 'react';
import { Card } from '@/components/ui/card';
import { Users, UserCheck, UserPlus, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UserStatsCardsProps {
  stats: {
    total: number;
    active: number;
    newThisMonth: number;
    suspended: number;
    newThisWeek: number;
    previousMonth: number;
  };
}

export const UserStatsCards: React.FC<UserStatsCardsProps> = ({ stats }) => {
  const activePercentage = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Users */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">کل کاربران</p>
            <p className="text-3xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-green-600 mt-2">
              +{stats.newThisWeek} این هفته
            </p>
          </div>
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </Card>

      {/* Active Users */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">کاربران فعال</p>
            <p className="text-3xl font-bold text-foreground">{stats.active}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {activePercentage}%
            </p>
          </div>
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </Card>

      {/* New This Month */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">کاربران جدید</p>
            <p className="text-3xl font-bold text-foreground">{stats.newThisMonth}</p>
            <p className="text-xs text-muted-foreground mt-2">
              vs {stats.previousMonth} ماه قبل
            </p>
          </div>
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </Card>

      {/* Suspended */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">معلق شده</p>
            <p className="text-3xl font-bold text-foreground">{stats.suspended}</p>
            {stats.suspended > 0 && (
              <Badge variant="destructive" className="mt-2 text-xs">
                نیاز به بررسی
              </Badge>
            )}
          </div>
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
            <UserX className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
        </div>
      </Card>
    </div>
  );
};