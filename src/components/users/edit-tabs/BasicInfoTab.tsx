import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Mail, Phone, Globe, Calendar, Clock, UserPlus, Activity, Upload } from 'lucide-react';
import { User as UserType } from '@/pages/settings/UserManagement';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BasicInfoTabProps {
  user: UserType;
  setUser: (user: UserType) => void;
  setHasUnsavedChanges: (value: boolean) => void;
}

export const BasicInfoTab: React.FC<BasicInfoTabProps> = ({ user, setUser, setHasUnsavedChanges }) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500';
      case 'suspended': return 'text-red-500';
      case 'inactive': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'حساب فعال';
      case 'suspended': return 'حساب معلق';
      case 'inactive': return 'حساب غیرفعال';
      default: return status;
    }
  };

  const handleFieldChange = (field: keyof UserType, value: any) => {
    setUser({ ...user, [field]: value });
    setHasUnsavedChanges(true);
  };

  const handleBlurSave = async (field: keyof UserType, value: any) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ [field]: value })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'ذخیره شد',
        description: 'تغییرات با موفقیت ذخیره شد',
      });
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

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">پروفایل</h3>
        <div className="flex items-start gap-6">
          <div className="relative group">
            <Avatar className="h-32 w-32">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary/10 text-primary text-3xl">
                {getInitials(user.full_name)}
              </AvatarFallback>
            </Avatar>
            <Button
              size="sm"
              variant="secondary"
              className="absolute bottom-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Upload className="h-3 w-3 ml-1" />
              تغییر تصویر
            </Button>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                ایمیل
              </Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-muted cursor-not-allowed mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                ایمیل قابل تغییر نیست
              </p>
            </div>

            <div>
              <Label htmlFor="full_name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                نام کامل
              </Label>
              <Input
                id="full_name"
                value={user.full_name}
                onChange={(e) => handleFieldChange('full_name', e.target.value)}
                onBlur={(e) => handleBlurSave('full_name', e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="language" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                زبان ترجیحی
              </Label>
              <Select
                value={user.preferences?.language || 'fa'}
                onValueChange={(value) => {
                  const newPreferences = { ...user.preferences, language: value };
                  handleFieldChange('preferences', newPreferences);
                  handleBlurSave('preferences', newPreferences);
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fa">فارسی</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Account Status */}
      <div>
        <h3 className="text-lg font-semibold mb-4">وضعیت حساب</h3>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                user.status === 'active' ? 'bg-green-500' :
                user.status === 'suspended' ? 'bg-red-500' :
                'bg-gray-500'
              }`} />
              <div>
                <p className={`font-semibold ${getStatusColor(user.status)}`}>
                  {getStatusText(user.status)}
                </p>
              </div>
            </div>
            
            {user.status === 'active' && (
              <Button variant="outline" className="text-orange-600 border-orange-600">
                تعلیق حساب
              </Button>
            )}
            {user.status === 'suspended' && (
              <Button variant="outline" className="text-green-600 border-green-600">
                فعال‌سازی
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Metadata */}
      <div>
        <h3 className="text-lg font-semibold mb-4">اطلاعات حساب</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">عضویت از</p>
                <p className="font-semibold">
                  {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString('fa-IR')}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">آخرین ورود</p>
                <p className="font-semibold">
                  {user.last_login 
                    ? formatDistanceToNow(new Date(user.last_login), { addSuffix: true })
                    : 'هرگز'
                  }
                </p>
                {user.last_login && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(user.last_login).toLocaleDateString('fa-IR')}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
