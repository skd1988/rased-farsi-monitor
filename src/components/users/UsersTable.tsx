import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Eye,
  Edit,
  Ban,
  CheckCircle,
  Trash,
  Mail,
  ArrowUpDown,
  Users
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import type { User } from '@/pages/settings/UserManagement';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UsersTableProps {
  users: User[];
  loading: boolean;
  selectedUserIds: string[];
  setSelectedUserIds: (ids: string[]) => void;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
  onRefresh: () => void;
  currentUser: any;
}

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  loading,
  selectedUserIds,
  setSelectedUserIds,
  sortColumn,
  sortDirection,
  onSort,
  onRefresh,
  currentUser,
}) => {
  const getRoleBadge = (role: string) => {
    const roleConfig = {
      super_admin: { label: 'مدیر ارشد', variant: 'destructive' as const },
      admin: { label: 'مدیر', variant: 'default' as const },
      analyst: { label: 'تحلیلگر', variant: 'secondary' as const },
      viewer: { label: 'بیننده', variant: 'outline' as const },
      guest: { label: 'مهمان', variant: 'outline' as const },
    };

    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.guest;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusIndicator = (status: string) => {
    const statusConfig = {
      active: { label: 'فعال', color: 'bg-green-500' },
      suspended: { label: 'معلق', color: 'bg-red-500' },
      inactive: { label: 'غیرفعال', color: 'bg-gray-500' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.inactive;
    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <span className="text-sm">{config.label}</span>
      </div>
    );
  };

  const getAvatarColor = (role: string) => {
    const colors = {
      super_admin: 'bg-red-500',
      admin: 'bg-blue-500',
      analyst: 'bg-green-500',
      viewer: 'bg-gray-500',
      guest: 'bg-orange-500',
    };
    return colors[role as keyof typeof colors] || colors.guest;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSelectAll = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map(u => u.id));
    }
  };

  const handleSelectUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'suspended' })
        .eq('id', userId);

      if (error) throw error;
      toast.success('کاربر با موفقیت معلق شد');
      onRefresh();
    } catch (error) {
      console.error('Error suspending user:', error);
      toast.error('خطا در تعلیق کاربر');
    }
  };

  const handleActivateUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId);

      if (error) throw error;
      toast.success('کاربر با موفقیت فعال شد');
      onRefresh();
    } catch (error) {
      console.error('Error activating user:', error);
      toast.error('خطا در فعال‌سازی کاربر');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-card rounded-lg border p-12 text-center">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">هیچ کاربری یافت نشد</h3>
        <p className="text-muted-foreground mb-4">کاربر جدیدی دعوت کنید</p>
        <Button>
          دعوت کاربر جدید
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedUserIds.length === users.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-16">آواتار</TableHead>
              <TableHead className="cursor-pointer" onClick={() => onSort('full_name')}>
                <div className="flex items-center gap-2">
                  نام کامل
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead>ایمیل</TableHead>
              <TableHead className="cursor-pointer" onClick={() => onSort('role')}>
                <div className="flex items-center gap-2">
                  نقش
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead className="cursor-pointer" onClick={() => onSort('last_login')}>
                <div className="flex items-center gap-2">
                  آخرین ورود
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead className="text-center w-24">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="hover:bg-muted/50">
                <TableCell>
                  <Checkbox
                    checked={selectedUserIds.includes(user.id)}
                    onCheckedChange={() => handleSelectUser(user.id)}
                  />
                </TableCell>
                <TableCell>
                  <Avatar>
                    <AvatarFallback className={getAvatarColor(user.role)}>
                      {getInitials(user.full_name || user.email)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>
                  <button className="font-medium hover:text-primary transition-colors text-right">
                    {user.full_name || '-'}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">{user.email}</span>
                  </div>
                </TableCell>
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                <TableCell>{getStatusIndicator(user.status)}</TableCell>
                <TableCell>
                  {user.last_login ? (
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(user.last_login), {
                        addSuffix: true,
                      })}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-50 bg-background">
                      <DropdownMenuItem>
                        <Eye className="ml-2 h-4 w-4" />
                        مشاهده پروفایل
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="ml-2 h-4 w-4" />
                        ویرایش
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {user.status === 'active' ? (
                        <DropdownMenuItem
                          onClick={() => handleSuspendUser(user.id)}
                          className="text-orange-600"
                        >
                          <Ban className="ml-2 h-4 w-4" />
                          تعلیق حساب
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => handleActivateUser(user.id)}
                          className="text-green-600"
                        >
                          <CheckCircle className="ml-2 h-4 w-4" />
                          فعال‌سازی
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash className="ml-2 h-4 w-4" />
                        حذف کاربر
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};