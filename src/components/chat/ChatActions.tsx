import { Download, Share2, FileText, Copy, Check, Save } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  structured_data?: any;
  followUpQuestions?: string[];
}

interface ChatActionsProps {
  messages: Message[];
  conversationId?: string;
}

export function ChatActions({ messages, conversationId }: ChatActionsProps) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { toast } = useToast();

  const handleExportMarkdown = () => {
    try {
      const markdown = generateMarkdown(messages);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-analysis-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'موفق',
        description: 'فایل Markdown دانلود شد',
      });
    } catch (error) {
      toast({
        title: 'خطا',
        description: 'خطا در تولید Markdown',
        variant: 'destructive',
      });
    }
  };

  const handleExportPDF = () => {
    try {
      setExporting(true);
      const html = generatePDFHTML(messages);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-analysis-${new Date().toISOString().split('T')[0]}.html`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'موفق',
        description: 'فایل HTML برای چاپ PDF دانلود شد - از مرورگر Print کنید',
      });
    } catch (error) {
      toast({
        title: 'خطا',
        description: 'خطا در تولید فایل',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleCopyText = async () => {
    try {
      const text = messages
        .map(msg => {
          const prefix = msg.role === 'user' ? '❓ سوال:' : '💬 پاسخ:';
          return `${prefix}\n${msg.content}\n`;
        })
        .join('\n---\n\n');
      
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: 'موفق',
        description: 'متن کپی شد',
      });
    } catch (error) {
      toast({
        title: 'خطا',
        description: 'خطا در کپی کردن',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateShareLink = async () => {
    try {
      setSharing(true);
      
      // Save conversation if not already saved
      let shareId = conversationId;
      
      if (!shareId) {
        const { data, error } = await supabase
          .from('chat_conversations')
          .insert({
            title: messages[0]?.content.substring(0, 50) || 'گفتگو',
          })
          .select()
          .single();
        
        if (error) throw error;
        shareId = data.id;
        
        // Save messages
        const messagesData = messages.map(msg => ({
          conversation_id: shareId,
          role: msg.role,
          content: msg.content,
          metadata: msg.structured_data || {},
        }));
        
        await supabase.from('chat_messages').insert(messagesData);
      }
      
      // Generate shareable URL
      const shareUrl = `${window.location.origin}/chat?conversation=${shareId}`;
      
      await navigator.clipboard.writeText(shareUrl);
      
      toast({
        title: 'موفق',
        description: 'لینک اشتراک‌گذاری کپی شد',
      });
    } catch (error) {
      console.error('Share link error:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ایجاد لینک اشتراک',
        variant: 'destructive',
      });
    } finally {
      setSharing(false);
    }
  };

  if (messages.length === 0) return null;

  return (
    <div className="flex items-center gap-2 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Export as PDF/HTML */}
      <button
        onClick={handleExportPDF}
        disabled={exporting}
        className="
          flex items-center gap-2 px-3 py-2
          text-sm font-medium
          bg-gray-100 dark:bg-gray-800
          hover:bg-gray-200 dark:hover:bg-gray-700
          rounded-lg transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        title="خروجی HTML/PDF"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">PDF</span>
      </button>

      {/* Export as Markdown */}
      <button
        onClick={handleExportMarkdown}
        className="
          flex items-center gap-2 px-3 py-2
          text-sm font-medium
          bg-gray-100 dark:bg-gray-800
          hover:bg-gray-200 dark:hover:bg-gray-700
          rounded-lg transition-colors
        "
        title="خروجی Markdown"
      >
        <FileText className="w-4 h-4" />
        <span className="hidden sm:inline">Markdown</span>
      </button>

      {/* Copy as Text */}
      <button
        onClick={handleCopyText}
        className="
          flex items-center gap-2 px-3 py-2
          text-sm font-medium
          bg-gray-100 dark:bg-gray-800
          hover:bg-gray-200 dark:hover:bg-gray-700
          rounded-lg transition-colors
        "
        title="کپی متن"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-green-600" />
            <span className="hidden sm:inline text-green-600">کپی شد</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            <span className="hidden sm:inline">کپی</span>
          </>
        )}
      </button>

      {/* Share Link */}
      <button
        onClick={handleGenerateShareLink}
        disabled={sharing}
        className="
          flex items-center gap-2 px-3 py-2
          text-sm font-medium
          bg-blue-600 hover:bg-blue-700
          text-white
          rounded-lg transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        title="اشتراک‌گذاری"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">اشتراک</span>
      </button>
    </div>
  );
}

// Generate Markdown content
function generateMarkdown(messages: Message[]): string {
  const timestamp = new Date().toLocaleString('fa-IR');
  
  let md = `# 📊 تحلیل عملیات روانی\n\n`;
  md += `**تاریخ:** ${timestamp}\n\n`;
  md += `---\n\n`;
  
  messages.forEach((msg, idx) => {
    if (msg.role === 'user') {
      md += `## ❓ سوال ${Math.floor(idx / 2) + 1}\n\n`;
      md += `${msg.content}\n\n`;
    } else {
      md += `### 💬 پاسخ\n\n`;
      
      // Add summary if exists
      if (msg.structured_data?.summary) {
        md += `> ${msg.structured_data.summary}\n\n`;
      }
      
      // Add main answer
      md += `${msg.content}\n\n`;
      
      // Add key stats if exists
      if (msg.structured_data?.key_stats) {
        md += `#### 📊 آمار کلیدی:\n\n`;
        Object.entries(msg.structured_data.key_stats).forEach(([key, value]) => {
          md += `- **${key}:** ${value}\n`;
        });
        md += `\n`;
      }
      
      // Add top targets if exists
      if (msg.structured_data?.top_targets?.length > 0) {
        md += `#### 🎯 اهداف اصلی:\n\n`;
        msg.structured_data.top_targets.forEach((target: any, i: number) => {
          md += `${i + 1}. ${target.entity} (${target.count} حمله)\n`;
        });
        md += `\n`;
      }
      
      // Add recommendations if exists
      if (msg.structured_data?.recommendations?.length > 0) {
        md += `#### ✅ توصیه‌های عملیاتی:\n\n`;
        msg.structured_data.recommendations.forEach((rec: string, i: number) => {
          md += `${i + 1}. ${rec}\n`;
        });
        md += `\n`;
      }
      
      md += `---\n\n`;
    }
  });
  
  md += `\n_تولید شده توسط سیستم تحلیل عملیات روانی_\n`;
  
  return md;
}

// Generate HTML for PDF printing
function generatePDFHTML(messages: Message[]): string {
  const timestamp = new Date().toLocaleString('fa-IR');
  
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تحلیل عملیات روانی</title>
  <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v30.1.0/dist/font-face.css" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Vazir, Tahoma, sans-serif;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: white;
    }
    
    .header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 40px;
    }
    
    .header h1 {
      font-size: 28px;
      color: #1e40af;
      margin-bottom: 10px;
    }
    
    .header .date {
      color: #6b7280;
      font-size: 14px;
    }
    
    .message {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    
    .message.user {
      background: #eff6ff;
      border-right: 4px solid #2563eb;
      padding: 15px;
      border-radius: 8px;
    }
    
    .message.assistant {
      background: #f9fafb;
      border-right: 4px solid #10b981;
      padding: 15px;
      border-radius: 8px;
    }
    
    .message-label {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 10px;
      color: #374151;
    }
    
    .message.user .message-label {
      color: #1e40af;
    }
    
    .message.assistant .message-label {
      color: #059669;
    }
    
    .message-content {
      font-size: 14px;
      white-space: pre-wrap;
      line-height: 1.6;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 15px 0;
    }
    
    .stat-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 10px;
      text-align: center;
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #1e40af;
    }
    
    .stat-label {
      font-size: 12px;
      color: #6b7280;
      margin-top: 5px;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: bold;
      margin: 20px 0 10px;
      color: #1f2937;
    }
    
    .list {
      margin-right: 20px;
    }
    
    .list-item {
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .footer {
      text-align: center;
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 12px;
    }
    
    .print-button {
      position: fixed;
      top: 20px;
      left: 20px;
      background: #2563eb;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-family: Vazir, Tahoma, sans-serif;
      font-size: 14px;
      font-weight: bold;
    }
    
    .print-button:hover {
      background: #1d4ed8;
    }
    
    @media print {
      body {
        padding: 20px;
      }
      
      .message {
        page-break-inside: avoid;
      }
      
      .print-button {
        display: none;
      }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ چاپ PDF</button>
  
  <div class="header">
    <h1>📊 تحلیل عملیات روانی</h1>
    <p class="date">تاریخ: ${timestamp}</p>
  </div>
  
  <div class="conversation">
    ${messages.map((msg) => `
      <div class="message ${msg.role}">
        <div class="message-label">
          ${msg.role === 'user' ? '❓ سوال' : '💬 پاسخ سیستم'}
        </div>
        <div class="message-content">${msg.content}</div>
        
        ${msg.structured_data?.key_stats ? `
          <div class="section-title">📊 آمار کلیدی:</div>
          <div class="stats-grid">
            ${Object.entries(msg.structured_data.key_stats).map(([key, value]) => `
              <div class="stat-card">
                <div class="stat-value">${value}</div>
                <div class="stat-label">${key}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${msg.structured_data?.top_targets?.length > 0 ? `
          <div class="section-title">🎯 اهداف اصلی:</div>
          <ul class="list">
            ${msg.structured_data.top_targets.map((t: any) => `
              <li class="list-item">${t.entity} (${t.count} حمله)</li>
            `).join('')}
          </ul>
        ` : ''}
        
        ${msg.structured_data?.recommendations?.length > 0 ? `
          <div class="section-title">✅ توصیه‌های عملیاتی:</div>
          <ul class="list">
            ${msg.structured_data.recommendations.map((rec: string) => `
              <li class="list-item">${rec}</li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    `).join('')}
  </div>
  
  <div class="footer">
    <p>تولید شده توسط سیستم تحلیل عملیات روانی</p>
    <p>محرمانه - فقط برای استفاده داخلی</p>
  </div>
</body>
</html>`;
}
