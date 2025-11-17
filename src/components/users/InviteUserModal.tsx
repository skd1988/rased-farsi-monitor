import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  UserPlus,
  Mail,
  User,
  Phone,
  Shield,
  LineChart,
  Eye,
  UserCog,
  Send,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNewAuth } from '@/contexts/NewAuthContext';

const inviteUserSchema = z.object({
  fullName: z.string().min(3, 'نام کامل حداقل 3 کاراکتر باشد'),
  email: z.string().email('لطفاً ایمیل معتبر وارد کنید'),
  phone: z.string().optional(),
  role: z.enum(['super_admin', 'admin', 'analyst', 'viewer', 'guest']),
  guestDuration: z.number().optional(),
  customLimits: z.boolean().default(false),
  aiAnalysisLimit: z.number().min(-1).max(500).optional(),
  chatMessagesLimit: z.number().min(-1).max(1000).optional(),
  exportsLimit: z.number().min(-1).max(10000).optional(),
  sendWelcomeEmail: z.boolean().default(true),
  sendConfirmationEmail: z.boolean().default(true),
  addToWeeklyDigest: z.boolean().default(false),
  sendInviteNow: z.boolean().default(true),
  requirePasswordChange: z.boolean().default(true),
});

type InviteUserFormData = z.infer<typeof inviteUserSchema>;

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { user: currentUser } = useNewAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const form = useForm<InviteUserFormData>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      role: 'analyst',
      customLimits: false,
      sendWelcomeEmail: true,
      sendConfirmationEmail: true,
      addToWeeklyDigest: false,
      sendInviteNow: true,
      requirePasswordChange: true,
    },
  });

  const selectedRole = form.watch('role');
  const customLimitsEnabled = form.watch('customLimits');
  const emailValue = form.watch('email');

  // Check if email exists (debounced)
  useEffect(() => {
    if (!emailValue || !emailValue.includes('@')) return;

    const timeoutId = setTimeout(async () => {
      setCheckingEmail(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('email', emailValue)
          .maybeSingle();

        setEmailExists(!!data);
        if (data) {
          form.setError('email', { message: 'این ایمیل قبلاً ثبت شده است' });
        }
      } catch (error) {
        console.error('Error checking email:', error);
      } finally {
        setCheckingEmail(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [emailValue, form]);

  const getRoleDefaults = (role: string) => {
    const defaults = {
      super_admin: { ai: -1, chat: -1, exports: -1 },
      admin: { ai: -1, chat: -1, exports: -1 },
      analyst: { ai: 50, chat: 100, exports: 500 },
      viewer: { ai: 0, chat: 20, exports: 100 },
      guest: { ai: 0, chat: 10, exports: 10 },
    };
    return defaults[role as keyof typeof defaults] || defaults.viewer;
  };

  const roleCards = [
    {
      value: 'super_admin',
      icon: Shield,
      title: 'مدیر ارشد',
      description: 'دسترسی کامل به تمام بخش‌ها',
      color: 'text-red-500',
      badge: 'محدود',
      badgeVariant: 'destructive' as const,
      disabled: currentUser?.role !== 'super_admin',
      features: ['دسترسی کامل', 'مدیریت کاربران', 'تنظیمات سیستم'],
    },
    {
      value: 'admin',
      icon: Shield,
      title: 'مدیر',
      description: 'مدیریت کاربران، محتوا و تنظیمات',
      color: 'text-blue-500',
      features: ['مدیریت کاربران (محدود)', 'دسترسی کامل به داده‌ها', 'مدیریت هشدارها'],
    },
    {
      value: 'analyst',
      icon: LineChart,
      title: 'تحلیلگر',
      description: 'تحلیل محتوا و ایجاد گزارش',
      color: 'text-green-500',
      badge: 'پیشنهاد شده',
      badgeVariant: 'secondary' as const,
      features: ['درخواست تحلیل AI (50/روز)', 'ایجاد و مدیریت هشدارها', 'Export محدود (500/روز)'],
    },
    {
      value: 'viewer',
      icon: Eye,
      title: 'بیننده',
      description: 'مشاهده داشبورد و گزارش‌ها',
      color: 'text-gray-500',
      features: ['مشاهده داده‌ها (فقط خواندن)', 'استفاده محدود از Chat', 'Export محدود (100/روز)'],
    },
    {
      value: 'guest',
      icon: UserCog,
      title: 'مهمان',
      description: 'دسترسی موقت محدود',
      color: 'text-orange-500',
      features: ['دسترسی موقت (7 روز)', 'مشاهده محدود'],
    },
  ];

  const onSubmit = async (data: InviteUserFormData) => {
    // Validation قبل از ارسال
    if (!data.email || !data.fullName) {
      toast.error('لطفاً تمام فیلدهای الزامی را پر کنید');
      return;
    }

    if (!data.email.includes('@')) {
      toast.error('ایمیل نامعتبر است');
      return;
    }

    if (emailExists) {
      toast.error('این ایمیل قبلاً ثبت شده است');
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Create user in Supabase Auth using Admin API
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';

      console.log('[InviteUserModal] Creating user with Admin API...');
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: data.email,
        password: tempPassword,
        email_confirm: true,  // ✅ تأیید خودکار ایمیل
        user_metadata: {
          full_name: data.fullName,
        },
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Failed to create user');
      }

      console.log('✅ User created in auth:', authData.user.id);

      // Step 2: ایجاد پروفایل در user_profiles (یا users table)
      console.log('[InviteUserModal] Creating user profile...');
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,  // ✅ استفاده از ID کاربر ساخته شده
          email: data.email,
          full_name: data.fullName,
          phone: data.phone || null,
          status: 'active',
          created_by: currentUser?.id,
        });

      if (profileError) {
        console.error('Profile error:', profileError);

        // اگر پروفایل ساخته نشد، کاربر auth را حذف کن
        console.log('[InviteUserModal] Rolling back: deleting auth user...');
        await supabase.auth.admin.deleteUser(authData.user.id);

        throw profileError;
      }

      console.log('✅ User profile created');

      // Step 3: Assign role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: data.role,
        });

      if (roleError) {
        console.error('Role error:', roleError);
        throw roleError;
      }

      console.log('✅ User role assigned');

      // Step 4: Set custom limits if enabled
      if (data.customLimits) {
        const { error: limitsError } = await supabase
          .from('user_daily_limits')
          .update({
            ai_analysis: data.aiAnalysisLimit ?? getRoleDefaults(data.role).ai,
            chat_messages: data.chatMessagesLimit ?? getRoleDefaults(data.role).chat,
            exports: data.exportsLimit ?? getRoleDefaults(data.role).exports,
          })
          .eq('user_id', authData.user.id);

        if (limitsError) {
          console.error('Limits error:', limitsError);
          // Don't throw - limits are optional
        }
      }

      // Step 5: Send invitation email if requested
      if (data.sendInviteNow) {
        try {
          const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
            body: {
              to: data.email,
              fullName: data.fullName,
              role: data.role,
              tempPassword,
              requirePasswordChange: data.requirePasswordChange,
            },
          });

          if (emailError) {
            console.error('Email sending failed:', emailError);
            toast.warning('کاربر ایجاد شد اما ارسال ایمیل با خطا مواجه شد');
          }
        } catch (emailError) {
          console.error('Email error:', emailError);
        }
      }

      // Step 6: Log activity
      try {
        await supabase.from('user_activity_log').insert({
          user_id: authData.user.id,
          action: 'USER_CREATED',
          details: {
            created_by: currentUser?.id,
            role: data.role,
            email: data.email,
            full_name: data.fullName,
          }
        });
      } catch (logError) {
        console.log('Activity logging skipped:', logError);
        // Don't fail if activity log fails
      }

      toast.success(`کاربر ${data.fullName} با موفقیت ساخته شد`, {
        action: {
          label: 'مشاهده کاربر',
          onClick: () => {
            // Navigate to user profile
            console.log('View user:', authData.user.id);
          },
        },
      });

      form.reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating user:', error);

      // بهبود Error Handling
      if (error.message?.includes('rate limit')) {
        toast.error('لطفاً 30 ثانیه صبر کنید و دوباره امتحان کنید');
      } else if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        toast.error('این ایمیل قبلاً ثبت شده است');
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        toast.error('خطای شبکه: لطفاً اتصال اینترنت خود را بررسی کنید');
      } else if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
        toast.error('شما مجوز ایجاد کاربر ندارید');
      } else {
        toast.error('خطا در ایجاد کاربر: ' + (error.message || 'خطای ناشناخته'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="text-right">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-2xl">دعوت کاربر جدید</DialogTitle>
              <p className="text-sm text-muted-foreground">افزودن کاربر به سیستم رصد رسانه</p>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">اطلاعات پایه</h3>

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      نام کامل <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input {...field} placeholder="نام و نام خانوادگی" className="pr-10" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      ایمیل <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input {...field} type="email" placeholder="user@example.com" className="pr-10 pl-10" />
                        {checkingEmail && (
                          <Loader2 className="absolute left-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {!checkingEmail && emailValue && !emailExists && (
                          <CheckCircle className="absolute left-3 top-3 h-4 w-4 text-green-500" />
                        )}
                        {!checkingEmail && emailExists && (
                          <AlertCircle className="absolute left-3 top-3 h-4 w-4 text-destructive" />
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      شماره تماس <Badge variant="outline" className="mr-2">اختیاری</Badge>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input {...field} placeholder="09123456789" className="pr-10" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Role Selection */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">
                نقش کاربر <span className="text-destructive">*</span>
              </h3>

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-3">
                        {roleCards.map((role) => (
                          <div
                            key={role.value}
                            className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                              field.value === role.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            } ${role.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <RadioGroupItem
                              value={role.value}
                              disabled={role.disabled}
                              className="absolute left-4 top-4"
                            />
                            <div className="flex items-start gap-3 pr-6">
                              <role.icon className={`w-6 h-6 ${role.color}`} />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold">{role.title}</h4>
                                  {role.badge && (
                                    <Badge variant={role.badgeVariant} className="text-xs">
                                      {role.badge}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{role.description}</p>
                                <ul className="text-xs text-muted-foreground space-y-1">
                                  {role.features.map((feature, i) => (
                                    <li key={i}>• {feature}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Guest Duration */}
              {selectedRole === 'guest' && (
                <FormField
                  control={form.control}
                  name="guestDuration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>مدت دسترسی</FormLabel>
                      <Select
                        value={field.value?.toString()}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="انتخاب کنید" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1 روز</SelectItem>
                          <SelectItem value="3">3 روز</SelectItem>
                          <SelectItem value="7">7 روز</SelectItem>
                          <SelectItem value="14">14 روز</SelectItem>
                          <SelectItem value="30">30 روز</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Custom Limits */}
            {(selectedRole === 'analyst' || selectedRole === 'viewer') && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground">محدودیت‌های سفارشی</h3>
                  <p className="text-sm text-muted-foreground">اختیاری - محدودیت‌های پیش‌فرض اعمال می‌شود</p>
                </div>

                <FormField
                  control={form.control}
                  name="customLimits"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-x-reverse">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="cursor-pointer">تنظیم محدودیت‌های سفارشی</FormLabel>
                    </FormItem>
                  )}
                />

                {customLimitsEnabled && (
                  <div className="grid grid-cols-3 gap-4 pr-6">
                    <FormField
                      control={form.control}
                      name="aiAnalysisLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>تحلیل AI در روز</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              placeholder={getRoleDefaults(selectedRole).ai.toString()}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">-1 برای نامحدود</FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="chatMessagesLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>پیام‌های Chat</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              placeholder={getRoleDefaults(selectedRole).chat.toString()}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="exportsLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Export در روز</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              placeholder={getRoleDefaults(selectedRole).exports.toString()}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Notification Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">تنظیمات اعلان‌ها</h3>

              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="sendWelcomeEmail"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-x-reverse">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="cursor-pointer">ارسال ایمیل خوش‌آمدگویی</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sendConfirmationEmail"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-x-reverse">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="cursor-pointer">ارسال ایمیل تأیید حساب</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="addToWeeklyDigest"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-x-reverse">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="cursor-pointer">افزودن به لیست اعلان‌های هفتگی</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Additional Options */}
            <div className="space-y-3 border-t pt-4">
              <FormField
                control={form.control}
                name="sendInviteNow"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-x-reverse">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer">ارسال دعوت‌نامه بعد از ایجاد</FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requirePasswordChange"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-x-reverse">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer">الزام به تغییر رمز عبور در اولین ورود</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                <p>نقش انتخابی: <span className="font-medium">{roleCards.find(r => r.value === selectedRole)?.title}</span></p>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  لغو
                </Button>
                <Button type="submit" disabled={isSubmitting || emailExists}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      در حال ارسال...
                    </>
                  ) : (
                    <>
                      <Send className="ml-2 h-4 w-4" />
                      ارسال دعوتنامه
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};