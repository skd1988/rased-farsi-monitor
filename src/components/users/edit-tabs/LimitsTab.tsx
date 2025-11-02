import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Brain, MessageSquare, Download, Save } from 'lucide-react';
import { User as UserType } from '@/pages/settings/UserManagement';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LimitsTabProps {
  user: UserType;
  setUser: (user: UserType) => void;
  setHasUnsavedChanges: (value: boolean) => void;
}

interface UserLimits {
  ai_analysis: number;
  chat_messages: number;
  exports: number;
}

interface UserUsage {
  ai_analysis: number;
  chat_messages: number;
  exports: number;
}

export const LimitsTab: React.FC<LimitsTabProps> = ({ user, setUser, setHasUnsavedChanges }) => {
  const { toast } = useToast();
  const [limits, setLimits] = useState<UserLimits>({ ai_analysis: 10, chat_messages: 50, exports: 20 });
  const [usage, setUsage] = useState<UserUsage>({ ai_analysis: 0, chat_messages: 0, exports: 0 });
  const [isUnlimited, setIsUnlimited] = useState({ ai_analysis: false, chat_messages: false, exports: false });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchLimitsAndUsage();
  }, [user.id]);

  const fetchLimitsAndUsage = async () => {
    try {
      // Fetch limits
      const { data: limitsData, error: limitsError } = await supabase
        .from('user_daily_limits')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (limitsError) throw limitsError;
      if (limitsData) {
        setLimits(limitsData);
        setIsUnlimited({
          ai_analysis: limitsData.ai_analysis === -1,
          chat_messages: limitsData.chat_messages === -1,
          exports: limitsData.exports === -1
        });
      }

      // Fetch today's usage
      const { data: usageData, error: usageError } = await supabase
        .from('user_daily_usage')
        .select('*')
        .eq('user_id', user.id)
        .eq('usage_date', new Date().toISOString().split('T')[0])
        .single();

      if (usageError && usageError.code !== 'PGRST116') throw usageError;
      if (usageData) {
        setUsage(usageData);
      }
    } catch (error) {
      console.error('Error fetching limits:', error);
    }
  };

  const handleSaveLimit = async (type: keyof UserLimits) => {
    setIsSaving(true);
    try {
      const value = isUnlimited[type] ? -1 : limits[type];
      
      const { error } = await supabase
        .from('user_daily_limits')
        .update({ [type]: value })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'محدودیت با موفقیت به‌روزرسانی شد',
      });

      setHasUnsavedChanges(true);
    } catch (error) {
      toast({
        title: 'خطا',
        description: 'خطا در به‌روزرسانی محدودیت',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const limitCards = [
    {
      type: 'ai_analysis' as keyof UserLimits,
      title: 'تحلیل هوش مصنوعی',
      icon: Brain,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      defaultLimits: { super_admin: -1, admin: 100, analyst: 50, viewer: 10, guest: 0 }
    },
    {
      type: 'chat_messages' as keyof UserLimits,
      title: 'پیام‌های Chat',
      icon: MessageSquare,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      defaultLimits: { super_admin: -1, admin: 200, analyst: 100, viewer: 20, guest: 10 }
    },
    {
      type: 'exports' as keyof UserLimits,
      title: 'Export داده',
      icon: Download,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      defaultLimits: { super_admin: -1, admin: 1000, analyst: 500, viewer: 100, guest: 0 }
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">تنظیمات محدودیت روزانه</h3>
        
        <div className="space-y-4">
          {limitCards.map((card) => {
            const Icon = card.icon;
            const currentLimit = limits[card.type];
            const currentUsage = usage[card.type];
            const percentage = currentLimit > 0 ? (currentUsage / currentLimit) * 100 : 0;
            const unlimited = isUnlimited[card.type];
            const defaultLimit = card.defaultLimits[user.role as keyof typeof card.defaultLimits];

            return (
              <Card key={card.type} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${card.bgColor}`}>
                        <Icon className={`h-5 w-5 ${card.color}`} />
                      </div>
                      <div>
                        <h4 className="font-semibold">{card.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          محدودیت فعلی: {unlimited ? 'نامحدود' : `${currentLimit} در روز`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {!unlimited && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span>استفاده امروز</span>
                        <span className="font-semibold">
                          {currentUsage}/{currentLimit} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  )}

                  <div className="flex items-end gap-4">
                    <div className="flex-1">
                      <Label htmlFor={`limit-${card.type}`}>محدودیت جدید</Label>
                      <Input
                        id={`limit-${card.type}`}
                        type="number"
                        min="0"
                        value={unlimited ? '' : limits[card.type]}
                        onChange={(e) => setLimits({ ...limits, [card.type]: parseInt(e.target.value) || 0 })}
                        disabled={unlimited}
                        className="mt-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        پیش‌فرض برای {user.role}: {defaultLimit === -1 ? 'نامحدود' : defaultLimit}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`unlimited-${card.type}`}
                        checked={unlimited}
                        onCheckedChange={(checked) => 
                          setIsUnlimited({ ...isUnlimited, [card.type]: checked as boolean })
                        }
                      />
                      <Label htmlFor={`unlimited-${card.type}`} className="text-sm cursor-pointer">
                        نامحدود
                      </Label>
                    </div>

                    <Button
                      onClick={() => handleSaveLimit(card.type)}
                      disabled={isSaving}
                      size="sm"
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      اعمال
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
