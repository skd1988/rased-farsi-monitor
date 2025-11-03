import React, { useState, useEffect, useMemo } from 'react';
import { useNewAuth } from '@/contexts/NewAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  UserPlus,
  Download,
  RefreshCw,
  Search,
  Users,
  UserCheck,
  UserX,
  Filter,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { UserStatsCards } from '@/components/users/UserStatsCards';
import { UserFilters } from '@/components/users/UserFilters';
import { UsersTable } from '@/components/users/UsersTable';
import { BulkActionsBar } from '@/components/users/BulkActionsBar';
import { InviteUserModal } from '@/components/users/InviteUserModal';
import { DataPagination } from '@/components/common/DataPagination';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'admin' | 'analyst' | 'viewer' | 'guest';
  status: 'active' | 'suspended' | 'inactive';
  preferences: any;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

interface UserStats {
  total: number;
  active: number;
  newThisMonth: number;
  suspended: number;
  newThisWeek: number;
  previousMonth: number;
}

const UserManagement = () => {
  const { user: currentUser } = useNewAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customDateRange, setCustomDateRange] = useState<{ from?: Date; to?: Date }>({});
  
  // Selection state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('[UserManagement] Starting to fetch users...');
      
      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('[UserManagement] Error fetching users:', usersError);
        throw usersError;
      }

      console.log('[UserManagement] Users data:', usersData);

      // Fetch roles separately
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        console.error('[UserManagement] Error fetching roles:', rolesError);
        throw rolesError;
      }

      console.log('[UserManagement] Roles data:', rolesData);

      // Create a map of user_id to role
      const roleMap = new Map<string, string>();
      rolesData?.forEach(r => roleMap.set(r.user_id, r.role));

      // Transform data to match User interface
      const transformedUsers = usersData?.map(u => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: (roleMap.get(u.id) || 'viewer') as 'super_admin' | 'admin' | 'analyst' | 'viewer' | 'guest',
        status: u.status,
        preferences: u.preferences,
        last_login: u.last_login,
        created_at: u.created_at,
        updated_at: u.updated_at
      })) || [];

      console.log('[UserManagement] Transformed users:', transformedUsers);
      setUsers(transformedUsers);
      toast.success(`${transformedUsers.length} کاربر بارگذاری شد`);
    } catch (error: any) {
      console.error('[UserManagement] Error:', error);
      toast.error(`خطا در بارگذاری کاربران: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
    toast.success('لیست بروزرسانی شد');
  };

  // Calculate stats
  const stats = useMemo<UserStats>(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    return {
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
      newThisMonth: users.filter(u => new Date(u.created_at) >= startOfMonth).length,
      suspended: users.filter(u => u.status === 'suspended').length,
      newThisWeek: users.filter(u => new Date(u.created_at) >= startOfWeek).length,
      previousMonth: users.filter(u => {
        const date = new Date(u.created_at);
        return date >= startOfPreviousMonth && date <= endOfPreviousMonth;
      }).length
    };
  }, [users]);

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          user.full_name?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Role filter
      if (selectedRoles.length > 0 && !selectedRoles.includes(user.role)) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && user.status !== selectedStatus) {
        return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const userDate = new Date(user.created_at);
        const now = new Date();

        switch (dateFilter) {
          case 'today':
            if (userDate.toDateString() !== now.toDateString()) return false;
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (userDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            if (userDate < monthAgo) return false;
            break;
          case 'custom':
            if (customDateRange.from && userDate < customDateRange.from) return false;
            if (customDateRange.to && userDate > customDateRange.to) return false;
            break;
        }
      }

      return true;
    });
  }, [users, searchQuery, selectedRoles, selectedStatus, dateFilter, customDateRange]);

  // Sort users
  const sortedUsers = useMemo(() => {
    const sorted = [...filteredUsers];
    sorted.sort((a, b) => {
      let aVal: any = a[sortColumn as keyof User];
      let bVal: any = b[sortColumn as keyof User];

      if (sortColumn === 'role') {
        const roleOrder = { super_admin: 0, admin: 1, analyst: 2, viewer: 3, guest: 4 };
        aVal = roleOrder[a.role];
        bVal = roleOrder[b.role];
      }

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal, 'fa')
          : bVal.localeCompare(aVal, 'fa');
      }

      return sortDirection === 'asc' 
        ? aVal > bVal ? 1 : -1
        : aVal < bVal ? 1 : -1;
    });

    return sorted;
  }, [filteredUsers, sortColumn, sortDirection]);

  // Paginate users
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedUsers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedRoles([]);
    setSelectedStatus('all');
    setDateFilter('all');
    setCustomDateRange({});
  };

  const hasActiveFilters = 
    searchQuery || 
    selectedRoles.length > 0 || 
    selectedStatus !== 'all' || 
    dateFilter !== 'all';

  // Export users
  const handleExport = () => {
    const csv = [
      ['Name', 'Email', 'Role', 'Status', 'Last Login', 'Created At'].join(','),
      ...sortedUsers.map(u => [
        u.full_name,
        u.email,
        u.role,
        u.status,
        u.last_login || '-',
        new Date(u.created_at).toLocaleDateString('fa-IR')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('فایل با موفقیت دانلود شد');
  };

  useEffect(() => {
    fetchUsers();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('users-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users'
      }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">مدیریت کاربران</h1>
            <p className="text-muted-foreground mt-1">مشاهده و مدیریت دسترسی کاربران</p>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleRefresh} variant="ghost" disabled={refreshing}>
              <RefreshCw className={`ml-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              بروزرسانی
            </Button>
            
            <Button onClick={handleExport} variant="outline">
              <Download className="ml-2 h-4 w-4" />
              Export لیست
            </Button>
            
            <Button onClick={() => setInviteModalOpen(true)}>
              <UserPlus className="ml-2 h-4 w-4" />
              دعوت کاربر جدید
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <UserStatsCards stats={stats} />

        {/* Filters & Search */}
        <div className="bg-card rounded-lg border p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="جستجو در نام، ایمیل..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>

            {/* Filters */}
            <UserFilters
              selectedRoles={selectedRoles}
              setSelectedRoles={setSelectedRoles}
              selectedStatus={selectedStatus}
              setSelectedStatus={setSelectedStatus}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              customDateRange={customDateRange}
              setCustomDateRange={setCustomDateRange}
            />

            {hasActiveFilters && (
              <Button onClick={clearFilters} variant="outline" size="sm">
                <X className="ml-2 h-4 w-4" />
                پاک کردن فیلترها
              </Button>
            )}
          </div>

          {/* Active filters display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="text-muted-foreground">فیلترهای فعال:</span>
              {searchQuery && (
                <span className="bg-primary/10 text-primary px-2 py-1 rounded">
                  جستجو: {searchQuery}
                </span>
              )}
              {selectedRoles.length > 0 && (
                <span className="bg-primary/10 text-primary px-2 py-1 rounded">
                  نقش: {selectedRoles.join(', ')}
                </span>
              )}
              {selectedStatus !== 'all' && (
                <span className="bg-primary/10 text-primary px-2 py-1 rounded">
                  وضعیت: {selectedStatus}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Users Table */}
        <UsersTable
          users={paginatedUsers}
          loading={loading}
          selectedUserIds={selectedUserIds}
          setSelectedUserIds={setSelectedUserIds}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={(column) => {
            if (sortColumn === column) {
              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
            } else {
              setSortColumn(column);
              setSortDirection('asc');
            }
          }}
          onRefresh={fetchUsers}
          currentUser={currentUser}
        />

        {/* Pagination */}
        <div className="flex items-center justify-between px-2" dir="rtl">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              نمایش {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, sortedUsers.length)} از {sortedUsers.length}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              اول
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              قبلی
            </Button>
            
            <span className="text-sm px-4">
              صفحه {currentPage} از {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              بعدی
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              آخر
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedUserIds.length > 0 && (
          <BulkActionsBar
            selectedCount={selectedUserIds.length}
            onClear={() => setSelectedUserIds([])}
            onAction={(action) => {
              console.log('Bulk action:', action, selectedUserIds);
              // Handle bulk actions
            }}
          />
        )}

        {/* Invite User Modal */}
        <InviteUserModal
          open={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          onSuccess={() => {
            fetchUsers();
            setInviteModalOpen(false);
          }}
        />
      </div>
  );
};

export default UserManagement;