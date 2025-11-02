import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  Loader2,
  Shield,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const loginSchema = z.object({
  email: z.string().email({ message: 'لطفاً ایمیل معتبر وارد کنید' }),
  password: z.string().min(8, { message: 'رمز عبور حداقل ۸ کاراکتر باشد' }),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/dashboard');
      }
    };
    checkAuth();
  }, [navigate]);

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        // Handle specific error cases
        if (error.message.includes('Invalid login credentials')) {
          toast.error('ایمیل یا رمز عبور اشتباه است');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('این حساب هنوز فعال نشده است');
        } else {
          toast.error('خطا در اتصال به سرور');
        }
        form.setValue('password', '');
        form.setFocus('email');
        return;
      }

      if (data.session) {
        toast.success('خوش آمدید!');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error('خطا در اتصال به سرور');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast.info('این قابلیت به زودی فعال خواهد شد');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      form.reset();
    }
  };

  return (
    <div className="min-h-screen flex" onKeyDown={handleKeyDown}>
      {/* Left Side - Login Form (60%) */}
      <div className="w-full lg:w-[60%] flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-right" dir="rtl">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              ورود به سیستم
            </h1>
            <p className="text-muted-foreground">
              لطفاً اطلاعات خود را وارد کنید
            </p>
          </div>

          {/* Login Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" dir="rtl">
              {/* Email Field */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ایمیل</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="your@email.com"
                          className="pr-10"
                          disabled={isLoading}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password Field */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رمز عبور</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="رمز عبور خود را وارد کنید"
                          className="pr-10 pl-10"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                          disabled={isLoading}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-x-reverse space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal cursor-pointer">
                        مرا به خاطر بسپار
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-primary hover:underline"
                  disabled={isLoading}
                >
                  رمز عبور را فراموش کرده‌اید؟
                </button>
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    در حال ورود...
                  </>
                ) : (
                  <>
                    <LogIn className="ml-2 h-4 w-4" />
                    ورود به سیستم
                  </>
                )}
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">یا</span>
                </div>
              </div>

              {/* Alternative Auth (Coming Soon) */}
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full relative"
                  disabled
                >
                  <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  ورود با Google
                  <span className="absolute top-0 left-0 bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-bl rounded-tr">
                    به زودی
                  </span>
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>

      {/* Right Side - Branding (40%) */}
      <div className="hidden lg:flex lg:w-[40%] bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNC0xLjc5IDQtNCA0LTQtMS43OS00LTR6bTAtMTBjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNC0xLjc5IDQtNCA0LTQtMS43OS00LTR6bS0xMCAxMGMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0LTEuNzkgNC00IDQtNC0xLjc5LTQtNHptMC0xMGMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0LTEuNzkgNC00IDQtNC0xLjc5LTQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
        
        <div className="relative z-10 flex flex-col items-center justify-center p-12 text-white text-center">
          {/* Logo & Icons */}
          <div className="mb-8 relative">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-2xl">
              <Shield className="w-12 h-12 text-white" />
            </div>
            
            {/* Floating Icons */}
            <div className="absolute -top-4 -right-4 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center animate-pulse">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center animate-pulse delay-150">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold mb-3" dir="rtl">
            سیستم رصد و تحلیل رسانه‌ای
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Media Monitoring & Analysis System
          </p>

          {/* Features */}
          <div className="space-y-4 text-right w-full max-w-sm" dir="rtl">
            <div className="flex items-center space-x-3 space-x-reverse bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <span className="text-sm">امنیت پیشرفته و رمزنگاری داده‌ها</span>
            </div>
            <div className="flex items-center space-x-3 space-x-reverse bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="text-sm">تحلیل هوشمند و گزارش‌سازی پیشرفته</span>
            </div>
            <div className="flex items-center space-x-3 space-x-reverse bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-sm">رصد لحظه‌ای و پیش‌بینی روندها</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
