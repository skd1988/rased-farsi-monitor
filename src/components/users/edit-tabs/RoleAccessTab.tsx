import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Shield, Eye, LineChart, UserCog, AlertTriangle } from 'lucide-react';
import { User as UserType } from '@/pages/settings/UserManagement';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RoleAccessTabProps {
  user: UserType;
  currentUser: any;
  setUser: (user: UserType) => void;
  setHasUnsavedChanges: (value: boolean) => void;
  onSuccess: () => void;
}

const roles = [
  {
    id: 'super_admin',
    name: 'مدیر ارشد',
    description: 'دسترسی کامل به تمام بخش‌ها',
    icon: Shield,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    features: [
      'دسترسی کامل به تمام بخش‌ها',
      'مدیریت کاربران و نقش‌ها',
      'تنظیمات سیستم',
      'مشاهده تمام آمار و گزارش‌ها'
    ],
    badge: 'محدود',
    badgeColor: 'destructive'
  },
  {
    id: 'admin',
    name: 'مدیر',
    description: 'مدیریت کاربران، محتوا و تنظیمات',
    icon: Shield,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    features: [
      'مدیریت کاربران (محدود)',
      'دسترسی کامل به داده‌ها',
      'مدیریت هشدارها',
      'ایجاد و مدیریت کمپین‌ها'
    ]
  },
  {
    id: 'analyst',
    name: 'تحلیلگر',
    description: 'تحلیل محتوا و ایجاد گزارش',
    icon: LineChart,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    features: [
      'درخواست تحلیل AI (50/روز)',
      'ایجاد و مدیریت هشدارها',
      'Export محدود (500/روز)',
      'دسترسی به Chat Assistant'
    ],
    badge: 'پیشنهاد شده',
    badgeColor: 'default'
  },
  {
    id: 'viewer',
    name: 'بیننده',
    description: 'مشاهده داشبورد و گزارش‌ها',
    icon: Eye,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    features: [
      'مشاهده داده‌ها (فقط خواندن)',
      'استفاده محدود از Chat',
      'Export محدود (100/روز)'
    ]
  },
  {
    id: 'guest',
    name: 'مهمان',
    description: 'دسترسی موقت محدود',
    icon: UserCog,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    features: [
      'دسترسی موقت (7 روز)',
      'مشاهده محدود',
      'بدون دسترسی ویرایش'
    ]
  }
];

export const RoleAccessTab: React.FC<RoleAccessTabProps> = ({
  user,
  currentUser,
  setUser,
  setHasUnsavedChanges,
  onSuccess
}) => {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState(user.role);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  const currentRole = roles.find(r => r.id === user.role);
  const newRole = roles.find(r => r.id === selectedRole);

  const canChangeToSuperAdmin = currentUser?.role === 'super_admin';

  const handleRoleChange = async () => {
    setIsChanging(true);
    try {
      // Update user role in user_roles table
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: selectedRole })
        .eq('user_id', user.id);

      if (roleError) throw roleError;

      toast({
        title: 'موفق',
        description: 'نقش کاربر با موفقیت تغییر یافت',
      });

      setShowConfirmDialog(false);
      onSuccess();
    } catch (error) {
      console.error('Error changing role:', error);
      toast({
        title: 'خطا',
        description: 'خطا در تغییر نقش کاربر',
        variant: 'destructive',
      });
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Role Display */}
      <div>
        <h3 className="text-lg font-semibold mb-4">نقش فعلی</h3>
        <Card className="p-6">
          <div className="flex items-start gap-4">
            {currentRole && (
              <>
                <div className={`p-3 rounded-lg ${currentRole.bgColor}`}>
                  <currentRole.icon className={`h-8 w-8 ${currentRole.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-xl font-bold">{currentRole.name}</h4>
                    <Badge variant="outline">{currentRole.id}</Badge>
                  </div>
                  <p className="text-muted-foreground mb-4">{currentRole.description}</p>
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">دسترسی‌ها:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {currentRole.features.map((feature, i) => (
                        <li key={i}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Change Role Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">تغییر نقش</h3>
        
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            ⚠️ تغییر نقش بر دسترسی‌های کاربر تأثیر می‌گذارد
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((role) => {
            const isDisabled = role.id === 'super_admin' && !canChangeToSuperAdmin;
            const isSelected = selectedRole === role.id;
            const Icon = role.icon;

            return (
              <Card
                key={role.id}
                className={`p-4 cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-primary' : ''
                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
                onClick={() => !isDisabled && setSelectedRole(role.id as any)}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${role.bgColor}`}>
                    <Icon className={`h-5 w-5 ${role.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{role.name}</h4>
                      {role.badge && (
                        <Badge variant={role.badgeColor as any} className="text-xs">
                          {role.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {role.description}
                    </p>
                    <ul className="space-y-1">
                      {role.features.slice(0, 3).map((feature, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          • {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {selectedRole !== user.role && (
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => setShowConfirmDialog(true)}
              className="gap-2"
            >
              تغییر نقش به {newRole?.name}
            </Button>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأیید تغییر نقش</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-right">
              <p>
                آیا مطمئنید می‌خواهید نقش <strong>{user.full_name}</strong> را از{' '}
                <strong>{currentRole?.name}</strong> به <strong>{newRole?.name}</strong> تغییر دهید؟
              </p>
              
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-semibold mb-2">تأثیرات:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>تغییر دسترسی‌های کاربر</li>
                  <li>کاربر باید مجدداً وارد شود</li>
                  <li>تمام session‌های فعلی لغو می‌شوند</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>لغو</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoleChange} disabled={isChanging}>
              {isChanging ? 'در حال تغییر...' : 'تأیید و تغییر نقش'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
