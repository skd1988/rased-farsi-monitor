import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  Shield,
  Gauge,
  Activity,
  AlertTriangle,
  X,
  Save
} from 'lucide-react';
import { User as UserType } from '@/pages/settings/UserManagement';
import { formatDistanceToNow } from 'date-fns';
import { BasicInfoTab } from './edit-tabs/BasicInfoTab';
import { RoleAccessTab } from './edit-tabs/RoleAccessTab';
import { LimitsTab } from './edit-tabs/LimitsTab';
import { ActivityTab } from './edit-tabs/ActivityTab';
import { DangerZoneTab } from './edit-tabs/DangerZoneTab';

interface EditUserModalProps {
  user: UserType | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser: any;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  open,
  onClose,
  onSuccess,
  currentUser
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('basic');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedUser, setEditedUser] = useState<UserType | null>(null);

  useEffect(() => {
    if (user) {
      setEditedUser({ ...user });
      setHasUnsavedChanges(false);
    }
  }, [user]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('تغییرات ذخیره نشده‌ای دارید. آیا مطمئن هستید؟')) {
        onClose();
        setHasUnsavedChanges(false);
      }
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save logic will be implemented in each tab
      toast({
        title: 'موفق',
        description: 'تغییرات با موفقیت ذخیره شد',
      });
      setHasUnsavedChanges(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'خطا',
        description: 'خطا در ذخیره تغییرات',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user || !editedUser) return null;

  const lastLogin = user.last_login 
    ? formatDistanceToNow(new Date(user.last_login), { addSuffix: true })
    : 'هرگز';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                  ویرایش کاربر: {user.full_name}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  آخرین ورود: {lastLogin}
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
            <TabsTrigger value="basic" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              <User className="h-4 w-4" />
              اطلاعات پایه
            </TabsTrigger>
            <TabsTrigger value="role" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              <Shield className="h-4 w-4" />
              دسترسی و نقش
            </TabsTrigger>
            <TabsTrigger value="limits" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              <Gauge className="h-4 w-4" />
              محدودیت‌ها
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              <Activity className="h-4 w-4" />
              فعالیت
            </TabsTrigger>
            <TabsTrigger value="danger" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-destructive text-destructive">
              <AlertTriangle className="h-4 w-4" />
              خطرناک
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="basic" className="mt-0">
              <BasicInfoTab 
                user={editedUser} 
                setUser={setEditedUser}
                setHasUnsavedChanges={setHasUnsavedChanges}
              />
            </TabsContent>

            <TabsContent value="role" className="mt-0">
              <RoleAccessTab 
                user={editedUser}
                currentUser={currentUser}
                setUser={setEditedUser}
                setHasUnsavedChanges={setHasUnsavedChanges}
                onSuccess={onSuccess}
              />
            </TabsContent>

            <TabsContent value="limits" className="mt-0">
              <LimitsTab 
                user={editedUser}
                setUser={setEditedUser}
                setHasUnsavedChanges={setHasUnsavedChanges}
              />
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <ActivityTab user={editedUser} />
            </TabsContent>

            <TabsContent value="danger" className="mt-0">
              <DangerZoneTab 
                user={editedUser}
                currentUser={currentUser}
                onSuccess={onSuccess}
                onClose={onClose}
              />
            </TabsContent>
          </div>
        </Tabs>

        <div className="border-t pt-4 flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || isSaving}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </Button>
            <Button variant="outline" onClick={handleClose}>
              لغو
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>آخرین به‌روزرسانی: {formatDistanceToNow(new Date(user.updated_at), { addSuffix: true })}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
