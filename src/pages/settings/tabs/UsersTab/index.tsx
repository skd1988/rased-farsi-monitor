import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { User, UserRole, UserStatus } from '../../types/settings.types';
import { USER_ROLES, USER_STATUS_LABELS, USER_STATUS_COLORS } from '../../constants/options';
import { Users, Shield, CheckCircle, XCircle, AlertCircle, Mail, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

export const UsersTab = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    loadUsers();
    loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // بارگذاری اطلاعات کامل از جدول users
      const { data } = await supabase
        .from('users')
        .select(`
          *,
          user_roles(role)
        `)
        .eq('id', user.id)
        .single();

      if (data) {
        setCurrentUser({
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          role: data.user_roles?.role || 'viewer',
          status: data.status,
          created_at: data.created_at,
          last_login: data.last_login,
        });
      }
    }
  }

  async function loadUsers() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          user_roles(role)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const usersData = data.map(u => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          role: u.user_roles?.role || 'viewer',
          status: u.status,
          created_at: u.created_at,
          last_login: u.last_login,
        }));

        setUsers(usersData);
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast.error('خطا در بارگذاری کاربران');
    } finally {
      setLoading(false);
    }
  }

  async function handleChangeRole(userId: string, newRole: UserRole) {
    try {
      // چک کردن اینکه آیا user_roles وجود داره
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existingRole) {
        // آپدیت نقش موجود
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // ایجاد نقش جدید
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });

        if (error) throw error;
      }

      toast.success('نقش کاربر تغییر کرد');
      loadUsers();
    } catch (error: any) {
      console.error('Error changing role:', error);
      toast.error('خطا در تغییر نقش');
    }
  }

  async function handleChangeStatus(userId: string, newStatus: UserStatus) {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', userId);

      if (error) throw error;

      toast.success('وضعیت کاربر تغییر کرد');
      loadUsers();
    } catch (error: any) {
      console.error('Error changing status:', error);
      toast.error('خطا در تغییر وضعیت');
    }
  }

  const getRoleInfo = (role: UserRole) => {
    return USER_ROLES.find(r => r.role === role);
  };

  const canManageUser = (targetUser: User) => {
    if (!currentUser) return false;
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'admin') return false;
    if (targetUser.id === currentUser.id) return false; // نمیتونی خودت رو مدیریت کنی
    if (currentUser.role === 'admin' && targetUser.role === 'super_admin') return false;
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              کل کاربران
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{users.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              فعال
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {users.filter(u => u.status === 'active').length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              معلق
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {users.filter(u => u.status === 'suspended').length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              غیرفعال
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {users.filter(u => u.status === 'inactive').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Roles Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            نقش‌های کاربری
          </CardTitle>
          <CardDescription>
            دسترسی‌های هر نقش
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {USER_ROLES.map(role => (
              <div key={role.role} className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={role.color}>
                    {role.label}
                  </Badge>
                </div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  {role.permissions[0] === '*' ? (
                    <li>• دسترسی کامل به تمام بخش‌ها</li>
                  ) : (
                    role.permissions.map(perm => (
                      <li key={perm}>• {perm}</li>
                    ))
                  )}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            لیست کاربران
          </CardTitle>
          <CardDescription>
            مدیریت کاربران و دسترسی‌ها
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">در حال بارگذاری...</p>
          ) : users.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">کاربری یافت نشد</p>
          ) : (
            <div className="space-y-3">
              {users.map(user => {
                const roleInfo = getRoleInfo(user.role);
                const isCurrentUser = currentUser?.id === user.id;
                const canManage = canManageUser(user);

                return (
                  <div
                    key={user.id}
                    className={`p-4 rounded-lg border ${
                      isCurrentUser ? 'bg-accent/50 border-primary' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{user.email}</span>
                          {user.full_name && (
                            <>
                              <UserIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{user.full_name}</span>
                            </>
                          )}
                          {isCurrentUser && (
                            <Badge variant="outline">شما</Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>
                            عضویت: {new Date(user.created_at).toLocaleDateString('fa-IR')}
                          </span>
                          {user.last_login && (
                            <>
                              <span>•</span>
                              <span>
                                آخرین ورود: {new Date(user.last_login).toLocaleDateString('fa-IR')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Role */}
                        <Select
                          value={user.role}
                          onValueChange={(value: UserRole) => handleChangeRole(user.id, value)}
                          disabled={!canManage}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {USER_ROLES.map(role => (
                              <SelectItem key={role.role} value={role.role}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Status */}
                        <Select
                          value={user.status}
                          onValueChange={(value: UserStatus) => handleChangeStatus(user.id, value)}
                          disabled={!canManage}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(USER_STATUS_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Badge className={USER_STATUS_COLORS[user.status]}>
                          {USER_STATUS_LABELS[user.status]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersTab;
