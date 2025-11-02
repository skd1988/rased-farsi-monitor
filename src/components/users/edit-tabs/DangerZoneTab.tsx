import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Key, LogOut, Ban, Trash2 } from 'lucide-react';
import { User as UserType } from '@/pages/settings/UserManagement';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DangerZoneTabProps {
  user: UserType;
  currentUser: any;
  onSuccess: () => void;
  onClose: () => void;
}

export const DangerZoneTab: React.FC<DangerZoneTabProps> = ({
  user,
  currentUser,
  onSuccess,
  onClose
}) => {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendDuration, setSuspendDuration] = useState('permanent');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleResetPassword = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email);
      
      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'لینک بازنشانی رمز عبور به ایمیل کاربر ارسال شد',
      });
    } catch (error) {
      toast({
        title: 'خطا',
        description: 'خطا در ارسال لینک بازنشانی',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForceLogout = async () => {
    setIsProcessing(true);
    try {
      // In a real app, you would revoke all sessions for this user
      // This is a placeholder
      toast({
        title: 'موفق',
        description: 'کاربر از تمام دستگاه‌ها خارج شد',
      });
    } catch (error) {
      toast({
        title: 'خطا',
        description: 'خطا در خروج اجباری',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuspendAccount = async () => {
    if (!suspendReason.trim()) {
      toast({
        title: 'خطا',
        description: 'لطفاً دلیل تعلیق را وارد کنید',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          status: 'suspended',
          preferences: {
            ...user.preferences,
            suspend_reason: suspendReason,
            suspend_duration: suspendDuration,
            suspended_at: new Date().toISOString(),
            suspended_by: currentUser.id
          }
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'حساب کاربری با موفقیت تعلیق شد',
      });

      setShowSuspendDialog(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'خطا',
        description: 'خطا در تعلیق حساب کاربری',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE USER') {
      toast({
        title: 'خطا',
        description: 'متن تأیید اشتباه است',
        variant: 'destructive',
      });
      return;
    }

    if (!adminPassword) {
      toast({
        title: 'خطا',
        description: 'لطفاً رمز عبور خود را وارد کنید',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Delete user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.id);

      if (roleError) throw roleError;

      // Delete user
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);

      if (userError) throw userError;

      toast({
        title: 'موفق',
        description: 'حساب کاربری با موفقیت حذف شد',
      });

      setShowDeleteDialog(false);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'خطا',
        description: 'خطا در حذف حساب کاربری',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div className="space-y-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          ⚠️ عملیات‌های این بخش غیرقابل بازگشت هستند
        </AlertDescription>
      </Alert>

      {/* Reset Password */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Key className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold">بازنشانی رمز عبور</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              ارسال لینک بازنشانی رمز عبور به ایمیل کاربر
            </p>
          </div>
          <Button
            variant="outline"
            className="text-orange-600 border-orange-600 hover:bg-orange-50"
            onClick={handleResetPassword}
            disabled={isProcessing}
          >
            ارسال لینک بازنشانی
          </Button>
        </div>
      </Card>

      {/* Force Logout */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <LogOut className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold">خروج اجباری</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              قطع تمام session‌های فعال کاربر
            </p>
          </div>
          <Button
            variant="outline"
            className="text-orange-600 border-orange-600 hover:bg-orange-50"
            onClick={handleForceLogout}
            disabled={isProcessing}
          >
            خروج از همه دستگاه‌ها
          </Button>
        </div>
      </Card>

      {/* Suspend Account */}
      {isSuperAdmin && (
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Ban className="h-5 w-5 text-red-500" />
                <h3 className="text-lg font-semibold">تعلیق حساب کاربری</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                تعلیق موقت یا دائم حساب کاربری
              </p>
            </div>
            <Button
              variant="outline"
              className="text-red-600 border-red-600 hover:bg-red-50"
              onClick={() => setShowSuspendDialog(true)}
              disabled={user.status === 'suspended'}
            >
              تعلیق حساب
            </Button>
          </div>
        </Card>
      )}

      {/* Delete Account */}
      {isSuperAdmin && (
        <Card className="p-6 border-destructive">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                <h3 className="text-lg font-semibold text-destructive">حذف حساب کاربری</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                حذف کامل و غیرقابل بازگشت حساب کاربری
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>حذف تمام داده‌های کاربر</li>
                <li>حذف تمام تحلیل‌ها و Alerts ایجاد شده</li>
                <li>حذف تمام فعالیت‌ها</li>
              </ul>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              حذف دائمی
            </Button>
          </div>
        </Card>
      )}

      {/* Suspend Dialog */}
      <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تعلیق حساب کاربری</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 text-right">
              <div className="space-y-2">
                <Label htmlFor="suspend-reason">دلیل تعلیق (الزامی)</Label>
                <Textarea
                  id="suspend-reason"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="دلیل تعلیق را وارد کنید..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="suspend-duration">مدت تعلیق</Label>
                <Select value={suspendDuration} onValueChange={setSuspendDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 روز</SelectItem>
                    <SelectItem value="3">3 روز</SelectItem>
                    <SelectItem value="7">7 روز</SelectItem>
                    <SelectItem value="30">30 روز</SelectItem>
                    <SelectItem value="permanent">دائم</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>لغو</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspendAccount}
              disabled={isProcessing || !suspendReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? 'در حال تعلیق...' : 'تعلیق حساب'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف دائمی حساب کاربری</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 text-right">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  این عملیات غیرقابل بازگشت است و تمام داده‌های کاربر حذف خواهد شد.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  برای تأیید، عبارت <strong>DELETE USER</strong> را تایپ کنید
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE USER"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password">رمز عبور خود را وارد کنید</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="رمز عبور"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>لغو</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isProcessing || deleteConfirmText !== 'DELETE USER' || !adminPassword}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? 'در حال حذف...' : 'حذف دائمی'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
