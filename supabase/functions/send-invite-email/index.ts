import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  to: string;
  fullName: string;
  role: string;
  tempPassword: string;
  requirePasswordChange: boolean;
}

const getRoleName = (role: string): string => {
  const roleNames: Record<string, string> = {
    super_admin: 'مدیر ارشد',
    admin: 'مدیر',
    analyst: 'تحلیلگر',
    viewer: 'بیننده',
    guest: 'مهمان',
  };
  return roleNames[role] || 'کاربر';
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, fullName, role, tempPassword, requirePasswordChange }: InviteEmailRequest = await req.json();

    const loginUrl = `${Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '')}/auth/v1/verify`;
    const dashboardUrl = Deno.env.get('SITE_URL') || 'https://your-app-url.com';

    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Tahoma, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f5f5f5;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background: white;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .content {
              padding: 30px;
            }
            .badge {
              display: inline-block;
              padding: 5px 15px;
              background: #f0f0f0;
              border-radius: 20px;
              font-size: 14px;
              margin: 10px 0;
            }
            .credentials {
              background: #f8f9fa;
              border-right: 4px solid #667eea;
              padding: 20px;
              margin: 20px 0;
              border-radius: 5px;
            }
            .credentials p {
              margin: 10px 0;
            }
            .credentials strong {
              color: #667eea;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .warning {
              background: #fff3cd;
              border-right: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 5px;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 خوش آمدید به سیستم رصد رسانه‌ای</h1>
            </div>
            
            <div class="content">
              <h2>سلام ${fullName}،</h2>
              
              <p>به سیستم رصد و تحلیل رسانه‌ای خوش آمدید!</p>
              
              <p>شما با نقش <span class="badge">${getRoleName(role)}</span> به سیستم دعوت شده‌اید.</p>
              
              <div class="credentials">
                <h3>اطلاعات ورود شما:</h3>
                <p><strong>ایمیل:</strong> ${to}</p>
                <p><strong>رمز عبور موقت:</strong> <code style="background: #e9ecef; padding: 5px 10px; border-radius: 3px;">${tempPassword}</code></p>
              </div>
              
              ${requirePasswordChange ? `
                <div class="warning">
                  <strong>⚠️ توجه:</strong> پس از اولین ورود، باید رمز عبور خود را تغییر دهید.
                </div>
              ` : ''}
              
              <div style="text-align: center;">
                <a href="${dashboardUrl}/login" class="button">
                  ورود به سیستم
                </a>
              </div>
              
              <h3>مزایای دسترسی شما:</h3>
              <ul>
                ${role === 'super_admin' || role === 'admin' ? `
                  <li>دسترسی کامل به تمام بخش‌های سیستم</li>
                  <li>مدیریت کاربران و دسترسی‌ها</li>
                  <li>تحلیل‌های نامحدود AI</li>
                ` : role === 'analyst' ? `
                  <li>درخواست تحلیل AI (50 تحلیل در روز)</li>
                  <li>ایجاد و مدیریت هشدارها</li>
                  <li>Export داده‌ها (500 مورد در روز)</li>
                  <li>دسترسی به Chat هوشمند</li>
                ` : role === 'viewer' ? `
                  <li>مشاهده داشبورد و گزارش‌ها</li>
                  <li>استفاده محدود از Chat</li>
                  <li>Export محدود داده‌ها</li>
                ` : `
                  <li>دسترسی موقت به سیستم</li>
                  <li>مشاهده محدود اطلاعات</li>
                `}
              </ul>
              
              <p><strong>راهنما:</strong></p>
              <ol>
                <li>روی دکمه "ورود به سیستم" کلیک کنید</li>
                <li>ایمیل و رمز عبور موقت خود را وارد کنید</li>
                ${requirePasswordChange ? '<li>رمز عبور جدید خود را تنظیم کنید</li>' : ''}
                <li>از امکانات سیستم لذت ببرید!</li>
              </ol>
              
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                اگر شما درخواست دسترسی به این سیستم را نداشته‌اید، لطفاً این ایمیل را نادیده بگیرید.
              </p>
            </div>
            
            <div class="footer">
              <p>© 2024 سیستم رصد و تحلیل رسانه‌ای</p>
              <p>این یک ایمیل خودکار است، لطفاً به آن پاسخ ندهید.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "سیستم رصد رسانه <onboarding@resend.dev>",
      to: [to],
      subject: "🎉 دعوتنامه شما به سیستم رصد رسانه‌ای",
      html: emailHtml,
    });

    console.log("Invite email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invite-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);