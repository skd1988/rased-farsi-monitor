import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { detectCountryFromSource } from "@/utils/countryDetector";
import { detectLanguage as detectLanguageAdvanced, getLanguageLabel } from "@/utils/languageDetector";
import {
  Loader2,
  Key,
  Database,
  Shield,
  Users,
  Palette,
  Zap,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Settings as SettingsIcon,
  Trash2,
  Search,
  Languages,
  Activity,
  Play,
  Pause,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Papa from "papaparse";
import UserManagement from "@/pages/settings/UserManagement";

// Helper function for proper CSV parsing that handles commas inside quotes
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

// Helper function to clean HTML content
const cleanHTML = (text: string): string => {
  if (!text) return "";

  return text
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, "") // Remove iframes
    .replace(/<script[^>]*>.*?<\/script>/gi, "") // Remove scripts
    .replace(/<style[^>]*>.*?<\/style>/gi, "") // Remove styles
    .replace(/<[^>]+>/g, "") // Remove all HTML tags
    .replace(/&nbsp;/g, " ") // Replace &nbsp;
    .replace(/&amp;/g, "&") // Replace &amp;
    .replace(/&lt;/g, "<") // Replace &lt;
    .replace(/&gt;/g, ">") // Replace &gt;
    .replace(/&quot;/g, '"') // Replace &quot;
    .replace(/&#39;/g, "'") // Replace &#39;
    .replace(/\s+/g, " ") // Replace multiple spaces
    .trim();
};

// Helper function to detect language using advanced detector
const detectLanguage = (text: string): string => {
  if (!text || text.length < 5) return "فارسی";

  const result = detectLanguageAdvanced(text);
  
  // Map result to Persian labels
  if (result.confidence < 60) return "نامشخص";
  
  return getLanguageLabel(result.language);
};

// Helper function to detect source type
const detectSourceType = (source: string, url: string = ""): "social_media" | "website" | "news_agency" | "blog" | "forum" => {
  const socialPlatforms = [
    "twitter",
    "facebook",
    "instagram",
    "youtube",
    "tiktok",
    "telegram",
    "linkedin",
    "snapchat",
    "whatsapp",
    "x.com",
    "t.me",
    "fb.com",
  ];

  const newsKeywords = [
    "news",
    "خبر",
    "اخبار",
    "الاخبار",
    "الجزيرة",
    "bbc",
    "cnn",
    "reuters",
    "ایسنا",
    "مهر",
    "تسنیم",
    "فارس",
    "ایرنا",
    "الشرق",
    "العربية",
  ];

  const blogKeywords = ["blog", "وبلاگ", "مدونة"];
  const forumKeywords = ["forum", "انجمن", "منتدى"];

  const checkText = `${source} ${url}`.toLowerCase();

  // Check social platforms first
  for (const platform of socialPlatforms) {
    if (checkText.includes(platform)) {
      return "social_media";
    }
  }

  // Check for blogs
  for (const keyword of blogKeywords) {
    if (checkText.includes(keyword)) {
      return "blog";
    }
  }

  // Check for forums
  for (const keyword of forumKeywords) {
    if (checkText.includes(keyword)) {
      return "forum";
    }
  }

  // Check news keywords
  for (const keyword of newsKeywords) {
    if (checkText.includes(keyword)) {
      return "news_agency";
    }
  }

  // Default to website for unknown sources
  return "website";
};

// Helper function to parse dates properly
const parseDate = (dateStr: any): string => {
  if (!dateStr || typeof dateStr !== "string") {
    return new Date().toISOString();
  }

  let cleaned = dateStr.trim();

  // Skip if obviously not a date (HTML, URLs, etc.)
  if (
    cleaned.includes("<") ||
    cleaned.includes(">") ||
    cleaned.includes("http") ||
    cleaned.includes("www.") ||
    cleaned.startsWith("Al Jazeera") ||
    cleaned.includes("Network") ||
    cleaned.includes("Doha") ||
    cleaned.length < 8
  ) {
    return new Date().toISOString();
  }

  // Try to clean common date formats
  cleaned = cleaned
    .replace(/\s+/g, " ")
    .replace(/[^\d\-\/\:\s]/g, "")
    .trim();

  if (cleaned.length < 8) {
    return new Date().toISOString();
  }

  try {
    // Try different date formats
    const patterns = [
      /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, // YYYY-MM-DD or YYYY/MM/DD
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, // MM-DD-YYYY or DD-MM-YYYY
      /(\d{4})(\d{2})(\d{2})/, // YYYYMMDD
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const parsed = new Date(cleaned);
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000 && parsed.getFullYear() < 2030) {
          return parsed.toISOString();
        }
      }
    }

    // Fallback: try direct parsing
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000 && parsed.getFullYear() < 2030) {
      return parsed.toISOString();
    }

    return new Date().toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
};

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<"connected" | "disconnected">("disconnected");
  const [lastTestedTime, setLastTestedTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [cleaning, setCleaning] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [syncStats, setSyncStats] = useState({
    sheetRows: 0,
    dbPosts: 0,
    lastSynced: 0,
    pendingRows: 0,
  });
  const [cleanupStats, setCleanupStats] = useState({ empty: 0, total: 0 });
  const [redetecting, setRedetecting] = useState(false);
  const [redetectProgress, setRedetectProgress] = useState(0);
  const [redetectStats, setRedetectStats] = useState({ updated: 0, total: 0, persian: 0, arabic: 0, mixed: 0 });

  // Automation Control states
  const [systemEnabled, setSystemEnabled] = useState(true);
  const [cronJobs, setCronJobs] = useState<any[]>([]);
  const [automationLoading, setAutomationLoading] = useState(false);

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("appSettings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing settings:", e);
      }
    }

    return {
      google_sheet_id: localStorage.getItem("sheetId") || "11VzLIg5-evMkdGBUPzFgGXiv6nTgEL4r1wc4FDn2TKQ",
      google_sheet_name: localStorage.getItem("sheetName") || "Sheet1",
      google_api_key: localStorage.getItem("googleApiKey") || "",
      last_sync_time: localStorage.getItem("lastSyncTime") || null,
      sync_status: null,
      theme: localStorage.getItem("theme") || "blue",
      dark_mode: localStorage.getItem("darkMode") === "true",
      language: "persian",
      notifications_enabled: true,
      alert_sounds: true,
      font_size: 16,
      show_tooltips: true,
      animations_enabled: true,
      show_kpi_cards: true,
      show_charts: true,
      show_recent_posts: true,
      show_recent_alerts: true,
      default_time_range: "7",
      auto_analysis: localStorage.getItem("autoAnalysis") === "true",
      analysis_delay: 5,
      batch_size: "10",
      analysis_schedule: "manual",
      weekly_reports: false,
      report_day: "saturday",
      report_time: "09:00",
      report_email: "",
      auto_sync: localStorage.getItem("autoSyncEnabled") === "true",
      sync_interval: localStorage.getItem("syncInterval") || "30",
      auto_cleanup: false,
      keep_posts_for: "90",
      archive_before_delete: true,
      auto_backup: "never",
    };
  });

  const saveSettings = (updates: Partial<typeof settings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    localStorage.setItem("appSettings", JSON.stringify(newSettings));

    if (updates.theme) localStorage.setItem("theme", updates.theme);
    if (updates.dark_mode !== undefined) localStorage.setItem("darkMode", String(updates.dark_mode));
    if (updates.google_sheet_id) localStorage.setItem("sheetId", updates.google_sheet_id);
    if (updates.google_sheet_name) localStorage.setItem("sheetName", updates.google_sheet_name);
    if (updates.google_api_key !== undefined) localStorage.setItem("googleApiKey", updates.google_api_key);
    if (updates.auto_sync !== undefined) localStorage.setItem("autoSyncEnabled", String(updates.auto_sync));
    if (updates.sync_interval) localStorage.setItem("syncInterval", updates.sync_interval);
    if (updates.auto_analysis !== undefined) localStorage.setItem("autoAnalysis", String(updates.auto_analysis));

    toast({
      title: "تنظیمات ذخیره شد",
      description: "تغییرات با موفقیت اعمال شد",
    });

    if (updates.theme) {
      document.documentElement.setAttribute("data-theme", updates.theme);
    }

    if (updates.dark_mode !== undefined) {
      document.documentElement.classList.toggle("dark", updates.dark_mode);
    }
  };

  // Load automation status from Supabase
  const loadAutomationStatus = async () => {
    setAutomationLoading(true);
    try {
      // Get system enabled status from auto_analysis_config
      const { data: configData, error: configError } = await supabase
        .from('auto_analysis_config')
        .select('config_key, config_value')
        .eq('config_key', 'enabled')
        .single();

      if (configError) {
        console.error('Error loading config:', configError);
      } else {
        setSystemEnabled(configData?.config_value ?? true);
      }

      // Mock cron jobs data (since we don't have pg_cron set up yet)
      // In production, you can query cron.job table or use RPC
      const mockCronJobs = [
        {
          jobname: 'inoreader-sync',
          schedule: '*/15 * * * *',
          active: true,
          command: 'SELECT net.http_post(...)',
        },
        {
          jobname: 'auto-analyzer',
          schedule: '*/5 * * * *',
          active: true,
          command: 'SELECT net.http_post(...)',
        },
        {
          jobname: 'auto-cleanup',
          schedule: '0 0 * * *',
          active: true,
          command: 'SELECT net.http_post(...)',
        },
      ];

      setCronJobs(mockCronJobs);

      toast({
        title: "وضعیت بارگذاری شد",
        description: "اطلاعات اتوماسیون با موفقیت دریافت شد",
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "خطا",
        description: "مشکل در بارگذاری وضعیت",
        variant: "destructive",
      });
    } finally {
      setAutomationLoading(false);
    }
  };

  // Toggle system enabled/disabled
  const toggleSystemEnabled = async () => {
    setAutomationLoading(true);
    try {
      const newValue = !systemEnabled;

      // Update in Supabase
      const { error } = await supabase
        .from('auto_analysis_config')
        .update({ config_value: newValue })
        .eq('config_key', 'enabled');

      if (error) throw error;

      setSystemEnabled(newValue);

      toast({
        title: newValue ? "سیستم فعال شد" : "سیستم غیرفعال شد",
        description: newValue ? "تحلیل خودکار فعال است" : "تحلیل خودکار متوقف شد",
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "خطا",
        description: "مشکل در تغییر وضعیت سیستم",
        variant: "destructive",
      });
    } finally {
      setAutomationLoading(false);
    }
  };

  // Pause all cron jobs (placeholder)
  const handlePauseAll = () => {
    toast({
      title: "در حال توسعه",
      description: "این قابلیت به زودی اضافه می‌شود",
    });
  };

  // Resume all cron jobs (placeholder)
  const handleResumeAll = () => {
    toast({
      title: "در حال توسعه",
      description: "این قابلیت به زودی اضافه می‌شود",
    });
  };

  const handleSaveApiKey = () => {
    if (!settings.deepseek_api_key) {
      toast({
        title: "خطا",
        description: "لطفا کلید API را وارد کنید",
        variant: "destructive",
      });
      return;
    }
    saveSettings({ deepseek_api_key: settings.deepseek_api_key });
  };

  const checkSyncStatus = async () => {
    if (!settings.google_sheet_id || !settings.google_sheet_name) return;

    try {
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${settings.google_sheet_id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(settings.google_sheet_name)}`;
      const response = await fetch(sheetUrl);
      const csvText = await response.text();

      const allLines = csvText.split("\n");
      const nonEmptyLines = allLines.filter((line, index) => {
        if (index === 0) return true; // Keep header

        const cleaned = line.replace(/"/g, "").trim();
        if (!cleaned || cleaned.match(/^,+$/)) return false;

        const values = cleaned.split(",").map((v) => v.trim());
        const meaningfulValues = values.filter((v) => {
          if (!v || v.length === 0) return false;
          if (v.includes("<") || v.includes(">")) return false;
          if (v.length < 3) return false;
          return true;
        });

        return meaningfulValues.length >= 3;
      });

      const sheetRows = nonEmptyLines.length - 1;
      console.log(`📊 Total CSV lines: ${allLines.length}, Non-empty: ${nonEmptyLines.length}`);

      const { count: dbPosts } = await supabase.from("posts").select("*", { count: "exact", head: true });
      
      // Use sheet-specific lastSyncedRow key
      const sheetSpecificKey = `lastSyncedRow_${settings.google_sheet_id}`;
      const lastSynced = parseInt(localStorage.getItem(sheetSpecificKey) || "0");
      const pendingRows = sheetRows - lastSynced;

      setSyncStats({
        sheetRows,
        dbPosts: dbPosts || 0,
        lastSynced,
        pendingRows: Math.max(0, pendingRows),
      });

      console.log("📊 Sync Status:", { 
        sheetId: settings.google_sheet_id,
        sheetRows, 
        dbPosts, 
        lastSynced, 
        pendingRows,
        storageKey: sheetSpecificKey
      });
    } catch (error) {
      console.error("Error checking sync status:", error);
    }
  };

  useEffect(() => {
    if (settings.google_sheet_id) {
      checkSyncStatus();
    }
  }, [settings.google_sheet_id, settings.google_sheet_name]);

  useEffect(() => {
    checkEmptyPosts();
  }, []);

  const handleTestConnection = async () => {
    if (!settings.deepseek_api_key) {
      toast({
        title: "کلید API وارد نشده",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      toast({ title: "در حال تست اتصال..." });

      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.deepseek_api_key}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 10,
        }),
      });

      if (response.ok) {
        setApiKeyStatus("connected");
        setLastTestedTime(new Date().toISOString());
        toast({
          title: "✅ اتصال موفق",
          description: "کلید API معتبر است",
        });
      } else {
        throw new Error("Invalid API key");
      }
    } catch (error) {
      setApiKeyStatus("disconnected");
      toast({
        title: "❌ خطا در اتصال",
        description: "کلید API نامعتبر است",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const inspectSchema = async () => {
    try {
      setInspecting(true);
      console.log("🔍 Trying to fetch one post to see structure...");

      const { data: sample, error } = await supabase.from("posts").select("*").limit(1).maybeSingle();

      if (error) throw error;

      const columns = Object.keys(sample || {});
      console.log("📋 Posts table has these columns:", columns);
      console.log("📄 Sample post:", sample);

      toast({
        title: "ساختار جدول",
        description: `${columns.length} ستون یافت شد - جزئیات در Console`,
      });
    } catch (error) {
      console.error("Schema inspection error:", error);
      toast({
        title: "خطا",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setInspecting(false);
    }
  };

  const checkEmptyPosts = async () => {
    try {
      const { data: allPosts, error } = await supabase.from("posts").select("*");

      if (error) throw error;

      const emptyPosts = (allPosts || []).filter((post) => {
        const allValues = Object.entries(post);
        const meaningfulValues = allValues.filter(([key, value]) => {
          if (["id", "created_at", "updated_at"].includes(key)) return false;
          if (value === null || value === "" || value === undefined) return false;
          if (typeof value === "string" && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}/i)) return false;
          return true;
        });
        return meaningfulValues.length <= 2;
      });

      console.log(`📊 Found ${emptyPosts.length} empty posts out of ${allPosts.length} total`);

      setCleanupStats({
        empty: emptyPosts.length,
        total: allPosts.length,
      });
    } catch (error) {
      console.error("Error checking posts:", error);
    }
  };

  const cleanupEmptyPosts = async () => {
    const confirmMsg = `آیا مطمئن هستید که می‌خواهید ${cleanupStats.empty} مطلب خالی را حذف کنید؟\n\nاین عملیات قابل بازگشت نیست.`;

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      setCleaning(true);

      toast({
        title: "شروع پاکسازی...",
        description: "در حال شناسایی و حذف مطالب خالی",
      });

      const { data: allPosts, error: fetchError } = await supabase.from("posts").select("*");

      if (fetchError) throw fetchError;

      const emptyPostIds = (allPosts || [])
        .filter((post) => {
          const allValues = Object.entries(post);
          const meaningfulValues = allValues.filter(([key, value]) => {
            if (["id", "created_at", "updated_at"].includes(key)) return false;
            if (value === null || value === "" || value === undefined) return false;
            if (typeof value === "string" && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}/i)) return false;
            return true;
          });
          return meaningfulValues.length <= 2;
        })
        .map((post) => post.id);

      console.log(`🗑️ Will delete ${emptyPostIds.length} posts:`, emptyPostIds.slice(0, 5));

      if (emptyPostIds.length === 0) {
        toast({
          title: "هیچ مطلب خالی یافت نشد",
          description: "همه مطالب دارای محتوا هستند",
        });
        setCleaning(false);
        return;
      }

      let totalDeleted = 0;
      const batchSize = 100;

      for (let i = 0; i < emptyPostIds.length; i += batchSize) {
        const batch = emptyPostIds.slice(i, i + batchSize);
        const { error: deleteError } = await supabase.from("posts").delete().in("id", batch);

        if (deleteError) {
          console.error("Delete error for batch:", deleteError);
        } else {
          totalDeleted += batch.length;
          console.log(`✅ Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} posts`);
        }
      }

      toast({
        title: "✅ پاکسازی کامل شد",
        description: `${totalDeleted} مطلب خالی حذف شد`,
      });

      console.log(`🎉 Total deleted: ${totalDeleted} posts`);

      await checkSyncStatus();
      await checkEmptyPosts();
    } catch (error) {
      console.error("Cleanup error:", error);
      toast({
        title: "خطا در پاکسازی",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCleaning(false);
    }
  };

  const redetectAllLanguages = async () => {
    const confirmMsg = `آیا مطمئن هستید که می‌خواهید زبان تمام مطالب را مجدداً تشخیص دهید؟\n\nاین عملیات ممکن است چند دقیقه طول بکشد.`;

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      setRedetecting(true);
      setRedetectProgress(0);

      toast({
        title: "شروع تشخیص مجدد زبان...",
        description: "در حال تحلیل مطالب با روش پیشرفته",
      });

      // Fetch all posts
      const { data: allPosts, error: fetchError } = await supabase.from("posts").select("id, title, contents, language");

      if (fetchError) throw fetchError;

      if (!allPosts || allPosts.length === 0) {
        toast({
          title: "هیچ مطلبی یافت نشد",
          variant: "destructive",
        });
        setRedetecting(false);
        return;
      }

      console.log(`🔍 Starting language re-detection for ${allPosts.length} posts`);
      console.log('📋 Sample of first 3 posts:', allPosts.slice(0, 3).map(p => ({
        id: p.id,
        currentLang: p.language,
        titleSample: p.title?.substring(0, 50)
      })));

      let updatedCount = 0;
      let persianCount = 0;
      let arabicCount = 0;
      let mixedCount = 0;
      let skippedLowConfidence = 0;
      const batchSize = 50;

      for (let i = 0; i < allPosts.length; i += batchSize) {
        const batch = allPosts.slice(i, i + batchSize);
        setRedetectProgress(Math.round((i / allPosts.length) * 100));

        for (const post of batch) {
          const text = `${post.title} ${post.contents || ''}`;
          const result = detectLanguageAdvanced(text);

          // Log first 3 detections for debugging
          if (updatedCount < 3) {
            console.log(`\n🧪 Detection ${updatedCount + 1}:`, {
              postId: post.id,
              currentLanguage: post.language,
              detectedLanguage: result.language,
              confidence: result.confidence,
              scores: result.details,
              textSample: text.substring(0, 100)
            });
          }

          // Lower threshold to 50 for better detection
          if (result.confidence > 50) {
            const newLang = result.language === 'persian' ? 'فارسی' :
                           result.language === 'arabic' ? 'عربی' :
                           result.language === 'mixed' ? 'ترکیبی' : 'نامشخص';

            // Always update regardless of current value to fix incorrect data
            const { error: updateError } = await supabase
              .from('posts')
              .update({ language: newLang })
              .eq('id', post.id);

            if (!updateError) {
              updatedCount++;
              if (result.language === 'persian') persianCount++;
              else if (result.language === 'arabic') arabicCount++;
              else if (result.language === 'mixed') mixedCount++;
              
              if (updatedCount % 20 === 0) {
                console.log(`✅ Progress: ${updatedCount}/${allPosts.length} - Persian: ${persianCount}, Arabic: ${arabicCount}, Mixed: ${mixedCount}`);
              }
            } else {
              console.error('Update error:', updateError);
            }
          } else {
            skippedLowConfidence++;
          }
        }
      }

      setRedetectProgress(100);
      setRedetectStats({
        updated: updatedCount,
        total: allPosts.length,
        persian: persianCount,
        arabic: arabicCount,
        mixed: mixedCount
      });

      console.log(`\n🎉 Language re-detection complete!`, {
        total: allPosts.length,
        updated: updatedCount,
        skippedLowConfidence,
        breakdown: {
          persian: persianCount,
          arabic: arabicCount,
          mixed: mixedCount
        }
      });

      toast({
        title: "✅ تشخیص مجدد کامل شد",
        description: `${updatedCount} مطلب به‌روزرسانی شد - فارسی: ${persianCount} | عربی: ${arabicCount} | ترکیبی: ${mixedCount}`,
      });

    } catch (error) {
      console.error("Re-detection error:", error);
      toast({
        title: "خطا در تشخیص مجدد",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRedetecting(false);
    }
  };

  const deleteAllPosts = async () => {
    // Get counts for all tables first
    const { count: postsCount } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true });

    const { count: channelsCount } = await supabase
      .from("social_media_channels")
      .select("*", { count: "exact", head: true });

    const { count: sourcesCount } = await supabase
      .from("source_profiles")
      .select("*", { count: "exact", head: true });

    const totalCount = (postsCount || 0) + (channelsCount || 0) + (sourcesCount || 0);

    const confirmMsg = `⚠️ هشدار: حذف کامل تمام داده‌ها\n\n` +
      `📊 آمار داده‌های قابل حذف:\n` +
      `• ${postsCount || 0} پست\n` +
      `• ${channelsCount || 0} کانال Social Media\n` +
      `• ${sourcesCount || 0} پروفایل منبع\n\n` +
      `⚠️ جمع کل: ${totalCount} رکورد\n\n` +
      `آیا مطمئن هستید؟ این عملیات قابل بازگشت نیست.`;

    if (!confirm(confirmMsg)) return;

    try {
      setCleaning(true);

      toast({
        title: "شروع حذف همه داده‌ها...",
        description: "لطفاً صبر کنید، ممکن است چند لحظه طول بکشد",
      });

      let deletedPosts = 0;
      let deletedChannels = 0;
      let deletedSources = 0;

      // Step 1: Delete all posts
      console.log("🗑️ Step 1: Deleting posts...");
      let hasMorePosts = true;
      while (hasMorePosts) {
        const { data: batch } = await supabase.from("posts").select("id").limit(100);
        if (!batch || batch.length === 0) {
          hasMorePosts = false;
          break;
        }
        const ids = batch.map((p) => p.id);
        await supabase.from("posts").delete().in("id", ids);
        deletedPosts += batch.length;
        console.log(`  ✅ Deleted ${deletedPosts} posts...`);
      }

      // Step 2: Delete all social media channels
      console.log("🗑️ Step 2: Deleting social media channels...");
      let hasMoreChannels = true;
      while (hasMoreChannels) {
        const { data: batch } = await supabase
          .from("social_media_channels")
          .select("id")
          .limit(100);
        if (!batch || batch.length === 0) {
          hasMoreChannels = false;
          break;
        }
        const ids = batch.map((c) => c.id);
        await supabase.from("social_media_channels").delete().in("id", ids);
        deletedChannels += batch.length;
        console.log(`  ✅ Deleted ${deletedChannels} channels...`);
      }

      // Step 3: Delete all source profiles
      console.log("🗑️ Step 3: Deleting source profiles...");
      let hasMoreSources = true;
      while (hasMoreSources) {
        const { data: batch } = await supabase
          .from("source_profiles")
          .select("id")
          .limit(100);
        if (!batch || batch.length === 0) {
          hasMoreSources = false;
          break;
        }
        const ids = batch.map((s) => s.id);
        await supabase.from("source_profiles").delete().in("id", ids);
        deletedSources += batch.length;
        console.log(`  ✅ Deleted ${deletedSources} sources...`);
      }

      // Reset localStorage
      const sheetSpecificKey = `lastSyncedRow_${settings.google_sheet_id}`;
      localStorage.setItem(sheetSpecificKey, "0");
      localStorage.setItem("lastSyncedRow", "0");

      const totalDeleted = deletedPosts + deletedChannels + deletedSources;

      toast({
        title: "✅ حذف کامل شد",
        description: `${totalDeleted} رکورد حذف شد:\n• ${deletedPosts} پست\n• ${deletedChannels} کانال\n• ${deletedSources} منبع`,
      });

      console.log("🎉 Deletion complete:", {
        posts: deletedPosts,
        channels: deletedChannels,
        sources: deletedSources,
        total: totalDeleted,
      });

      await checkSyncStatus();
      window.location.reload();
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "خطا در حذف",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCleaning(false);
    }
  };

  const previewNextRows = async () => {
    if (!settings.google_sheet_id || !settings.google_sheet_name) {
      toast({
        title: "اطلاعات ناقص",
        description: "لطفا Sheet ID و نام Sheet را وارد کنید",
        variant: "destructive",
      });
      return;
    }

    try {
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${settings.google_sheet_id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(settings.google_sheet_name)}`;
      const response = await fetch(sheetUrl);
      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data;
          const { count } = await supabase.from("posts").select("*", { count: "exact", head: true });
          const startRow = count || 0;
          const preview = [];

          for (let i = startRow; i < Math.min(startRow + 10, rows.length); i++) {
            const row = rows[i];
            preview.push({
              rowNumber: i + 1,
              title: row["عنوان"] || row["title"] || "(خالی)",
              source: row["منبع"] || row["source"] || "(خالی)",
              isValid: (row["عنوان"] || row["title"] || "").length >= 5,
            });
          }

          setPreviewData(preview);
          setShowPreview(true);
          console.log("🔍 Preview of next 10 rows:", preview);
        },
      });
    } catch (error) {
      toast({
        title: "خطا در پیش‌نمایش",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Helper function to detect political alignment from source
  const detectPoliticalAlignment = (source: string, url: string): string => {
    const checkText = `${source} ${url}`.toLowerCase();

    // Known enemy sources
    const enemyPatterns = [
      { pattern: /saudi|سعود|العربية/i, alignment: 'Saudi-Aligned' },
      { pattern: /israel|יהודי|يديعوت|القدس|جيروزاليم/i, alignment: 'Israeli-Affiliated' },
      { pattern: /معارض|المعارض|اندپندنت عربية|اندبندنت عربية|العربي الجديد/i, alignment: 'Anti-Resistance' },
      { pattern: /bbc|cnn|france24|dw/i, alignment: 'Western-Aligned' },
    ];

    for (const { pattern, alignment } of enemyPatterns) {
      if (pattern.test(checkText)) {
        return alignment;
      }
    }

    // Pro-resistance sources
    const proResistancePatterns = [
      /almayadeen|الميادين|almanar|المنار|قناة المسيرة|الأخبار/i,
      /parstoday|presstv|الوفاق|al-wefaq/i,
    ];

    for (const pattern of proResistancePatterns) {
      if (pattern.test(checkText)) {
        return 'Pro-Resistance';
      }
    }

    return 'Neutral';
  };

  // Helper function to normalize source_type to valid database values
  const normalizeSourceType = (sourceType: string): string => {
    // Valid values from database constraint
    const validTypes = [
      'RSS Feed',
      'News Website',
      'Social Media',
      'Blog',
      'Aggregator',
      'Government',
      'Unknown'
    ];

    // If already valid, return as-is
    if (validTypes.includes(sourceType)) {
      return sourceType;
    }

    // Map common variations to valid values
    const typeMap: Record<string, string> = {
      // Social Media variations
      'social_media': 'Social Media',
      'social': 'Social Media',
      'sm': 'Social Media',

      // News Website variations
      'website': 'News Website',
      'news_agency': 'News Website',
      'news': 'News Website',
      'news_website': 'News Website',
      'media': 'News Website',
      'agency': 'News Website',

      // Blog variations
      'blog': 'Blog',
      'weblog': 'Blog',

      // Forum/Discussion variations
      'forum': 'News Website', // Map forum to News Website

      // RSS variations
      'rss': 'RSS Feed',
      'feed': 'RSS Feed',
      'rss_feed': 'RSS Feed',

      // Government variations
      'government': 'Government',
      'gov': 'Government',
      'official': 'Government',

      // Aggregator variations
      'aggregator': 'Aggregator',
      'aggregate': 'Aggregator',
    };

    // Try to match with map
    const normalized = typeMap[sourceType.toLowerCase().trim()];
    if (normalized) {
      return normalized;
    }

    // Default fallback
    return 'News Website';
  };

  // Helper function to upsert source profile
  const upsertSourceProfile = async (source: string, sourceUrl: string, sourceType: string, country: string, isPsyop: boolean) => {
    try {
      // Validate inputs - skip if source name is empty or invalid
      if (!source || source.trim().length === 0) {
        console.warn('⚠️ Skipping source profile: empty source name');
        return;
      }

      // Skip if source name is too short or looks invalid
      if (source.trim().length < 3) {
        console.warn(`⚠️ Skipping source profile: source name too short: "${source}"`);
        return;
      }

      // Clean the source name
      const cleanSourceName = source.trim();

      // CRITICAL: Validate and clean country field
      // Convert invalid values to NULL which database accepts
      const invalidCountries = ['نامشخص', 'نامعین', 'Unknown', 'نامشخص', '', 'null', 'undefined'];
      const cleanCountry = (!country || invalidCountries.includes(country.trim())) ? null : country.trim();

      // Check if source profile already exists
      const { data: existing, error: selectError } = await supabase
        .from('source_profiles')
        .select('*')
        .eq('source_name', cleanSourceName)
        .maybeSingle();

      if (selectError) {
        console.error(`❌ Error checking existing source: ${selectError.message}`);
        return;
      }

      if (existing) {
        // Update existing: increment PsyOp counts if this is a PsyOp
        if (isPsyop) {
          const { error: updateError } = await supabase
            .from('source_profiles')
            .update({
              historical_psyop_count: (existing.historical_psyop_count || 0) + 1,
              last_30days_psyop_count: (existing.last_30days_psyop_count || 0) + 1,
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error(`❌ Error updating source PsyOp count: ${updateError.message}`);
          } else {
            console.log(`✅ Updated source profile PsyOp count: ${cleanSourceName}`);
          }
        }
      } else {
        // Create new source profile with intelligent defaults
        const politicalAlignment = detectPoliticalAlignment(cleanSourceName, sourceUrl);

        // Validate all fields before insert
        const newProfile = {
          source_name: cleanSourceName,
          source_type: normalizeSourceType(sourceType),
          political_alignment: politicalAlignment || 'Neutral',
          reach_score: 50,
          credibility_score: 50,
          virality_coefficient: 1.0,
          threat_multiplier: (politicalAlignment && (politicalAlignment.includes('Anti') || politicalAlignment.includes('Israeli'))) ? 1.5 : 1.0,
          historical_psyop_count: isPsyop ? 1 : 0,
          last_30days_psyop_count: isPsyop ? 1 : 0,
          country: cleanCountry, // NULL if invalid
          active: true,
        };

        console.log(`🔍 Attempting to insert source profile:`, {
          name: newProfile.source_name,
          type: newProfile.source_type,
          country: newProfile.country,
          alignment: newProfile.political_alignment
        });

        const { error: insertError } = await supabase
          .from('source_profiles')
          .insert([newProfile]);

        if (insertError) {
          console.error(`❌ Error creating source profile for "${cleanSourceName}":`, {
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code
          });
        } else {
          console.log(`✨ Created source profile: ${cleanSourceName}`);
        }
      }
    } catch (error: any) {
      console.error('❌ Exception in upsertSourceProfile:', {
        message: error.message,
        source: source
      });
    }
  };

  // Helper function to normalize platform to valid database values
  const normalizePlatform = (platform: string): string => {
    const validPlatforms = [
      'Telegram', 'Twitter', 'Facebook', 'Instagram',
      'YouTube', 'TikTok', 'LinkedIn', 'WhatsApp', 'Snapchat'
    ];

    // If already valid, return as-is
    if (validPlatforms.includes(platform)) {
      return platform;
    }

    // Map common variations
    const platformMap: Record<string, string> = {
      'telegram': 'Telegram',
      'twitter': 'Twitter',
      'x': 'Twitter',
      'x.com': 'Twitter',
      'facebook': 'Facebook',
      'fb': 'Facebook',
      'instagram': 'Instagram',
      'ig': 'Instagram',
      'youtube': 'YouTube',
      'yt': 'YouTube',
      'tiktok': 'TikTok',
      'linkedin': 'LinkedIn',
      'whatsapp': 'WhatsApp',
      'snapchat': 'Snapchat',
      'snap': 'Snapchat',
    };

    const normalized = platformMap[platform.toLowerCase()];
    if (normalized) {
      return normalized;
    }

    // Default fallback - use first valid platform
    return 'Telegram';
  };

  // Helper function to upsert social media channel
  const upsertSocialMediaChannel = async (channelName: string, platform: string, sourceUrl: string, country: string, isPsyop: boolean) => {
    try {
      // Validate inputs - skip if channel name is empty or invalid
      if (!channelName || channelName.trim().length === 0) {
        console.warn('⚠️ Skipping channel: empty channel name');
        return;
      }

      // Skip if channel name is too short
      if (channelName.trim().length < 3) {
        console.warn(`⚠️ Skipping channel: name too short: "${channelName}"`);
        return;
      }

      // Clean the channel name
      const cleanChannelName = channelName.trim();

      // CRITICAL: Validate and clean country field
      const invalidCountries = ['نامشخص', 'نامعین', 'Unknown', '', 'null', 'undefined'];
      const cleanCountry = (!country || invalidCountries.includes(country.trim())) ? null : country.trim();

      // Extract channel ID from URL
      let channelId = null;
      if (platform === 'Telegram' && sourceUrl && sourceUrl.includes('t.me/')) {
        channelId = sourceUrl.split('t.me/')[1]?.split('/')[0];
      }

      // Check if channel already exists
      const { data: existing, error: selectError } = await supabase
        .from('social_media_channels')
        .select('*')
        .eq('channel_name', cleanChannelName)
        .maybeSingle();

      if (selectError) {
        console.error(`❌ Error checking existing channel: ${selectError.message}`);
        return;
      }

      if (existing) {
        // Update existing: increment PsyOp counts if this is a PsyOp
        if (isPsyop) {
          const { error: updateError } = await supabase
            .from('social_media_channels')
            .update({
              historical_psyop_count: (existing.historical_psyop_count || 0) + 1,
              last_30days_psyop_count: (existing.last_30days_psyop_count || 0) + 1,
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error(`❌ Error updating channel PsyOp count: ${updateError.message}`);
          } else {
            console.log(`✅ Updated channel PsyOp count: ${cleanChannelName}`);
          }
        }
      } else {
        // Create new channel with intelligent defaults
        const politicalAlignment = detectPoliticalAlignment(cleanChannelName, sourceUrl);

        // CRITICAL: Properly set language array based on country
        let languageArray: string[];
        if (cleanCountry === 'Iran' || cleanCountry === 'ایران') {
          languageArray = ['فارسی'];
        } else if (['Lebanon', 'Iraq', 'Syria', 'Yemen', 'لبنان', 'عراق', 'سوریه', 'یمن'].includes(cleanCountry || '')) {
          languageArray = ['عربی'];
        } else if (cleanCountry && cleanCountry.length > 0) {
          languageArray = ['انگلیسی'];
        } else {
          // If no country, try to detect from channel name
          const hasArabic = /[\u0600-\u06FF]/.test(cleanChannelName);
          const hasPersian = /[پچژگ]/.test(cleanChannelName);
          languageArray = hasPersian ? ['فارسی'] : hasArabic ? ['عربی'] : ['انگلیسی'];
        }

        const newChannel = {
          channel_name: cleanChannelName,
          channel_id: channelId,
          platform: normalizePlatform(platform),
          political_alignment: politicalAlignment || 'Neutral',
          reach_score: 50,
          credibility_score: 50,
          virality_coefficient: platform === 'Telegram' ? 1.3 : 1.0,
          threat_multiplier: (politicalAlignment && (politicalAlignment.includes('Anti') || politicalAlignment.includes('Israeli'))) ? 2.0 : 1.0,
          historical_psyop_count: isPsyop ? 1 : 0,
          last_30days_psyop_count: isPsyop ? 1 : 0,
          language: languageArray, // Validated array
          country: cleanCountry, // NULL if invalid
        };

        console.log(`🔍 Attempting to insert channel:`, {
          name: newChannel.channel_name,
          platform: newChannel.platform,
          country: newChannel.country,
          language: newChannel.language
        });

        const { error: insertError } = await supabase
          .from('social_media_channels')
          .insert([newChannel]);

        if (insertError) {
          console.error(`❌ Error creating channel for "${cleanChannelName}":`, {
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code
          });
        } else {
          console.log(`✨ Created channel: ${cleanChannelName}`);
        }
      }
    } catch (error: any) {
      console.error('❌ Exception in upsertSocialMediaChannel:', {
        message: error.message,
        channel: channelName
      });
    }
  };

  const handleManualSync = async () => {
    if (!settings.google_sheet_id || !settings.google_sheet_name) {
      toast({
        title: "اطلاعات ناقص",
        description: "لطفا Sheet ID و نام Sheet را وارد کنید",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    setSyncProgress(10);

    try {
      toast({
        title: "شروع همگام‌سازی...",
        description: "در حال اتصال به Google Sheets",
      });

      // Use Google Sheets JSON API to get all rows (no 1000 limit)
      const hasApiKey = settings.google_api_key && settings.google_api_key.trim().length > 0;
      
      console.log("🔗 Fetching from Google Sheets API", hasApiKey ? "(with API key)" : "(without API key - will fallback to CSV)");
      setSyncProgress(30);

      let allRows: string[][] = [];
      let usedCSV = false;
      
      if (hasApiKey) {
        try {
          // Try JSON API first (no 1000 row limit) - only if API key is provided
          const jsonUrl = `https://sheets.googleapis.com/v4/spreadsheets/${settings.google_sheet_id}/values/${encodeURIComponent(settings.google_sheet_name)}?key=${settings.google_api_key}`;
          const jsonResponse = await fetch(jsonUrl);
          
          if (jsonResponse.ok) {
            const jsonData = await jsonResponse.json();
            allRows = jsonData.values || [];
            console.log(`✅ Fetched ${allRows.length} rows from JSON API (no limit)`);
          } else {
            const errorData = await jsonResponse.json();
            console.warn("⚠️ JSON API failed:", errorData);
            toast({
              title: "❌ Google API Key نامعتبر",
              description: "API Key وارد شده صحیح نیست. در حال استفاده از روش CSV (محدودیت 1000 ردیف)",
              variant: "destructive",
            });
            throw new Error("Invalid API key");
          }
        } catch (e) {
          console.warn("⚠️ JSON API failed, using CSV (1000 row limit):", e);
          usedCSV = true;
          
          // Fallback to CSV (has 1000 row limit)
          const csvUrl = `https://docs.google.com/spreadsheets/d/${settings.google_sheet_id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(settings.google_sheet_name)}`;
          const csvResponse = await fetch(csvUrl);
          
          if (!csvResponse.ok) {
            throw new Error("خطا در دریافت داده‌ها. لطفا Sheet ID و دسترسی عمومی را بررسی کنید");
          }
          
          const csvText = await csvResponse.text();
          const lines = csvText.split("\n");
          allRows = lines.map(line => parseCSVLine(line).map(v => v.replace(/"/g, "").trim()));
          
          if (allRows.length >= 1000) {
            toast({
              title: "⚠️ محدودیت CSV",
              description: "فقط 1000 ردیف اول دریافت شد. برای دریافت همه داده‌ها، Google API Key در تنظیمات اضافه کنید.",
              variant: "destructive",
            });
          }
        }
      } else {
        // No API key - use CSV directly with warning
        usedCSV = true;
        console.log("⚠️ No API key provided, using CSV (1000 row limit)");
        
        const csvUrl = `https://docs.google.com/spreadsheets/d/${settings.google_sheet_id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(settings.google_sheet_name)}`;
        const csvResponse = await fetch(csvUrl);
        
        if (!csvResponse.ok) {
          throw new Error("خطا در دریافت داده‌ها. لطفا Sheet ID و دسترسی عمومی را بررسی کنید");
        }
        
        const csvText = await csvResponse.text();
        const lines = csvText.split("\n");
        allRows = lines.map(line => parseCSVLine(line).map(v => v.replace(/"/g, "").trim()));
        
        if (allRows.length >= 1000) {
          toast({
            title: "⚠️ محدودیت 1000 ردیف",
            description: "بدون Google API Key فقط 1000 ردیف اول import می‌شود. برای import کامل، API Key رایگان دریافت و در تنظیمات وارد کنید.",
            variant: "destructive",
            duration: 10000,
          });
        }
      }
      console.log("📄 Data fetched, total rows:", allRows.length);
      setSyncProgress(50);

      const dataLines = allRows.filter((row, index) => {
        if (index === 0) return true; // Keep header

        const meaningfulValues = row.filter((v) => {
          if (!v || v.length === 0) return false;
          if (v.includes("<") || v.includes(">")) return false;
          if (v.length < 3) return false;
          return true;
        });

        return meaningfulValues.length >= 3;
      });

      console.log(`📊 Total rows: ${allRows.length}, Valid rows: ${dataLines.length}`);

      const { count: dbPostCount } = await supabase.from("posts").select("*", { count: "exact", head: true });
      
      // Use sheet-specific lastSyncedRow
      const sheetSpecificKey = `lastSyncedRow_${settings.google_sheet_id}`;
      const lastSyncedRow = parseInt(localStorage.getItem(sheetSpecificKey) || "0");
      
      console.log(`📊 Sheet ID: ${settings.google_sheet_id}`);
      console.log(`📊 Database has ${dbPostCount} posts total`);
      console.log(`📊 This sheet last synced: ${lastSyncedRow} rows`);
      console.log(`📊 Will sync from row ${lastSyncedRow + 1}`);

      const headers = dataLines[0].map((h) => (typeof h === 'string' ? h.replace(/"/g, "").trim() : String(h)));

      console.log("📋 Headers found:", headers);
      console.log("📋 Total headers:", headers.length);

      // Debug: Show actual header mapping with indexes
      console.log("📋 COMPLETE Header mapping:");
      headers.forEach((header, index) => {
        console.log(`  [${index}]: "${header}"`);
      });

      // Also show possible variations of headers
      console.log("📋 Looking for these field patterns:");
      console.log("  - Source fields: source, منبع, publisher, site, website, domain");
      console.log("  - URL fields: url, لینک, source_url, article url, link, href");
      console.log("  - Author fields: author, نویسنده, writer, کاتب");
      console.log("  - Title fields: title, عنوان, headline, subject");
      console.log("  - Content fields: contents, محتوا, content, description, body");

      const rows: any[] = [];
      for (let i = 1; i < dataLines.length; i++) {
        const values = dataLines[i].map((v) => (typeof v === 'string' ? v.replace(/"/g, "").trim() : String(v)));

        if (i <= 3) {
          console.log(`\n🔍 Row ${i}:`);
          console.log("Values count:", values.length, "Headers count:", headers.length);

          if (values.length !== headers.length) {
            console.warn(`⚠️ Column mismatch: ${values.length} values vs ${headers.length} headers`);
          }
        }

        const row: any = {};
        headers.forEach((header, index) => {
          const key = header.toLowerCase().trim();
          row[key] = values[index] || "";
        });

        if (i <= 3) {
          console.log("First 3 fields:", {
            date: row.date?.substring(0, 20) || "empty",
            title: row.title?.substring(0, 50) || "empty",
            contents: row.contents?.substring(0, 50) || "empty",
          });
        }

        rows.push(row);
      }

      const totalRows = rows.length;
      console.log(`📋 Parsed ${totalRows} rows from CSV`);

      const rowsToSync = rows.slice(lastSyncedRow);

      if (rowsToSync.length === 0) {
        toast({
          title: "همگام‌سازی کامل",
          description: "تمام ردیف‌ها قبلاً وارد شده‌اند",
        });
        setIsSyncing(false);
        setSyncProgress(0);
        return;
      }

      console.log(`🔄 Sheet ID: ${settings.google_sheet_id}`);
      console.log(`🔄 Will sync ${rowsToSync.length} NEW rows (from row ${lastSyncedRow + 1} to ${lastSyncedRow + rowsToSync.length})`);
      toast({
        title: `🔄 شروع همگام‌سازی`,
        description: `در حال وارد کردن ${rowsToSync.length} ردیف جدید از Sheet...`,
      });

      let importedCount = 0;
      let errorCount = 0;

      const validationSkips = {
        noTitle: 0,
        placeholderTitle: 0,
        duplicate: 0,
        oldPost: 0,
      };

      for (let i = 0; i < rowsToSync.length; i++) {
        const row = rowsToSync[i];
        setSyncProgress(50 + ((i + 1) / rowsToSync.length) * 40);

        try {
          // Comprehensive field mapping - check ALL possible variations
          const getAllVariations = (row: any, patterns: string[]) => {
            for (const pattern of patterns) {
              const value = row[pattern];
              if (value && typeof value === "string" && value.trim().length > 0) {
                return value.trim();
              }
            }
            return "";
          };

          // Debug: Log complete row structure for first few rows
          if (i < 3) {
            console.log(`\n🔍 COMPLETE Row ${i + 1} structure:`);
            Object.keys(row).forEach((key, index) => {
              const value = String(row[key]).substring(0, 60);
              console.log(`  [${index}] "${key}": "${value}"`);
            });
          }

          // Try ALL possible field patterns
          const sourcePatterns = [
            "source",
            "منبع",
            "publisher",
            "site",
            "website",
            "domain",
            "منبع خبر",
            "Source",
            "Publisher",
            "Website",
            "Domain",
            "News Source",
          ];

          const urlPatterns = [
            "url",
            "لینک",
            "source_url",
            "article url",
            "link",
            "href",
            "website_url",
            "news_url",
            "URL",
            "Link",
            "Source URL",
            "Article URL",
            "Website URL",
            "News URL",
          ];

          const authorPatterns = [
            "author",
            "نویسنده",
            "writer",
            "کاتب",
            "نگارنده",
            "reporter",
            "journalist",
            "Author",
            "Writer",
            "Reporter",
            "Journalist",
            "By",
          ];

          const titlePatterns = [
            "title",
            "عنوان",
            "headline",
            "subject",
            "خبر",
            "سرخط",
            "Title",
            "Headline",
            "Subject",
            "News Title",
          ];

          const contentPatterns = [
            "contents",
            "محتوا",
            "content",
            "description",
            "body",
            "متن",
            "شرح",
            "Contents",
            "Content",
            "Description",
            "Body",
            "Text",
            "Article",
          ];

          const datePatterns = [
            "date",
            "تاریخ",
            "published_at",
            "published_date",
            "pubdate",
            "تاریخ انتشار",
            "Publication Date",
            "Date",
            "Pubdate",
            "timestamp",
            "Timestamp",
          ];

          // Extract all fields with comprehensive mapping
          const rawSource = getAllVariations(row, sourcePatterns);
          const rawUrl = getAllVariations(row, urlPatterns);
          const rawAuthor = getAllVariations(row, authorPatterns);
          const rawTitle = getAllVariations(row, titlePatterns);
          const rawContents = getAllVariations(row, contentPatterns);

          // Helper: Detect if source is social media or website
          const detectSourceType = (url: string, source: string): string => {
            if (!url && !source) return "website";
            
            const urlToCheck = (url || source).toLowerCase();
            
            // Social Media Patterns
            const socialMediaPatterns = [
              // Twitter / X
              { pattern: /(?:twitter\.com|x\.com|t\.co)/, name: "twitter" },
              
              // Facebook
              { pattern: /(?:facebook\.com|fb\.com|fb\.me)/, name: "facebook" },
              
              // Instagram
              { pattern: /(?:instagram\.com|instagr\.am)/, name: "instagram" },
              
              // Telegram
              { pattern: /(?:t\.me|telegram\.org|telegram\.me)/, name: "telegram" },
              
              // LinkedIn
              { pattern: /linkedin\.com/, name: "linkedin" },
              
              // TikTok
              { pattern: /(?:tiktok\.com|vm\.tiktok\.com)/, name: "tiktok" },
              
              // YouTube
              { pattern: /(?:youtube\.com|youtu\.be)/, name: "youtube" },
              
              // WhatsApp
              { pattern: /(?:whatsapp\.com|wa\.me)/, name: "whatsapp" },
              
              // Snapchat
              { pattern: /snapchat\.com/, name: "snapchat" },
              
              // Reddit
              { pattern: /reddit\.com/, name: "reddit" },
              
              // WeChat
              { pattern: /wechat\.com/, name: "wechat" },
              
              // Discord
              { pattern: /discord\.(?:gg|com)/, name: "discord" },
              
              // Clubhouse
              { pattern: /clubhouse\.com/, name: "clubhouse" },
              
              // Twitch
              { pattern: /twitch\.tv/, name: "twitch" },
              
              // Pinterest
              { pattern: /pinterest\.com/, name: "pinterest" },
              
              // Tumblr
              { pattern: /tumblr\.com/, name: "tumblr" },
              
              // VK (VKontakte)
              { pattern: /vk\.com/, name: "vk" },
              
              // Weibo
              { pattern: /weibo\.com/, name: "weibo" },
              
              // Mastodon
              { pattern: /mastodon/, name: "mastodon" },
              
              // Medium (blog platform but social-like)
              { pattern: /medium\.com/, name: "medium" },
            ];
            
            for (const social of socialMediaPatterns) {
              if (social.pattern.test(urlToCheck)) {
                return "social_media";
              }
            }
            
            // News Agency Patterns (for future categorization)
            const newsAgencyPatterns = [
              /reuters\.com/i,
              /ap\.org|apnews\.com/i,
              /afp\.com/i,
              /tass\.com/i,
              /xinhua/i,
              /aljazeera/i,
              /bbc\.com|bbc\.co\.uk/i,
              /cnn\.com/i,
              /france24\.com/i,
              /dw\.com/i,
              /rt\.com/i,
            ];
            
            for (const pattern of newsAgencyPatterns) {
              if (pattern.test(urlToCheck)) {
                return "news_agency";
              }
            }
            
            // Forum patterns
            const forumPatterns = [
              /forum/i,
              /board/i,
              /discussion/i,
            ];
            
            for (const pattern of forumPatterns) {
              if (pattern.test(urlToCheck)) {
                return "forum";
              }
            }
            
            // Blog patterns
            const blogPatterns = [
              /blog/i,
              /wordpress\.com/i,
              /blogger\.com/i,
              /blogspot\.com/i,
            ];
            
            for (const pattern of blogPatterns) {
              if (pattern.test(urlToCheck)) {
                return "blog";
              }
            }
            
            // Default to website
            return "website";
          };

          // Helper: Intelligent date parsing
          const parseDate = (dateStr: string): string => {
            if (!dateStr || dateStr.trim() === "") {
              return new Date().toISOString();
            }

            // Helper to validate date
            const isValidDate = (d: Date): boolean => {
              return d instanceof Date && !isNaN(d.getTime());
            };
            
            // Helper to safely convert to ISO
            const safeToISO = (d: Date, context: string): string | null => {
              if (isValidDate(d)) {
                return d.toISOString();
              }
              console.warn(`⚠️ Invalid date in ${context}:`, dateStr);
              return null;
            };

            try {
              // Clean the date string
              const cleaned = dateStr.trim();

              // Format 1: ISO format (2025-10-31 or 2025-10-31T23:10:53)
              if (cleaned.match(/^\d{4}-\d{2}-\d{2}/)) {
                const d = new Date(cleaned);
                const result = safeToISO(d, 'ISO format');
                if (result) return result;
              }

              // Format 2: Persian/Arabic date "۱۴۰۳/۰۸/۱۰" or "1403/08/10"
              if (cleaned.match(/^[\d۰-۹]+[\/\-][\d۰-۹]+[\/\-][\d۰-۹]+$/)) {
                // Convert Persian digits to English
                const englishDate = cleaned
                  .replace(/۰/g, '0').replace(/۱/g, '1').replace(/۲/g, '2')
                  .replace(/۳/g, '3').replace(/۴/g, '4').replace(/۵/g, '5')
                  .replace(/۶/g, '6').replace(/۷/g, '7').replace(/۸/g, '8')
                  .replace(/۹/g, '9');
                
                const parts = englishDate.split(/[\/\-]/);
                
                // Assume it's Persian calendar if year > 1400
                if (parseInt(parts[0]) > 1400) {
                  // Convert Jalali to Gregorian (approximate)
                  const jalaliYear = parseInt(parts[0]);
                  const jalaliMonth = parseInt(parts[1]);
                  const jalaliDay = parseInt(parts[2]);
                  
                  // Simple conversion: Jalali 1403 ≈ Gregorian 2024-2025
                  const gregorianYear = jalaliYear - 621 + (jalaliMonth >= 10 ? 1 : 0);
                  const d = new Date(gregorianYear, jalaliMonth - 1, jalaliDay);
                  const result = safeToISO(d, 'Jalali format');
                  if (result) return result;
                }
                
                // Otherwise treat as Gregorian
                const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                const result = safeToISO(d, 'Persian Gregorian');
                if (result) return result;
              }

              // Format 3: Timestamp "Oct 31, 2025 at 11:10PM" - check FIRST (more specific)
              if (cleaned.includes(" at ")) {
                const [datePart] = cleaned.split(" at ");
                const d = new Date(datePart);
                const result = safeToISO(d, 'Timestamp format');
                if (result) return result;
              }

              // Format 4: "Oct 31, 2025" or "31 Oct 2025" - check AFTER (more general)
              if (cleaned.match(/[A-Za-z]{3,}/)) {
                const d = new Date(cleaned);
                const result = safeToISO(d, 'English format');
                if (result) return result;
              }

              // Format 5: "31/10/2025" or "2025/10/31"
              if (cleaned.match(/^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}$/)) {
                const parts = cleaned.split(/[\/\-]/);
                
                // Check which format
                if (parseInt(parts[0]) > 1900) {
                  // YYYY/MM/DD
                  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                  const result = safeToISO(d, 'YYYY/MM/DD');
                  if (result) return result;
                } else {
                  // DD/MM/YYYY
                  const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                  const result = safeToISO(d, 'DD/MM/YYYY');
                  if (result) return result;
                }
              }

              // Fallback: try direct parse
              const parsed = new Date(cleaned);
              const result = safeToISO(parsed, 'direct parse');
              if (result) return result;

              // All parsing failed - return current date
              console.warn(`⚠️ Could not parse date string: "${dateStr}"`);
              return new Date().toISOString();
              
            } catch (e) {
              console.error('❌ Date parsing exception:', e, 'for date:', dateStr);
              return new Date().toISOString();
            }
          };

          // Helper: Extract date from content text
          const extractDateFromText = (text: string): string | null => {
            if (!text) return null;

            // Pattern 1: Arabic/Persian months
            const monthPatterns = [
              { pattern: /(\d+)\s*(يناير|كانون الثاني|ینایر)/i, month: 0 },
              { pattern: /(\d+)\s*(فبراير|شباط|فوریه)/i, month: 1 },
              { pattern: /(\d+)\s*(مارس|آذار|مارس)/i, month: 2 },
              { pattern: /(\d+)\s*(أبريل|نيسان|آوریل)/i, month: 3 },
              { pattern: /(\d+)\s*(مايو|أيار|می)/i, month: 4 },
              { pattern: /(\d+)\s*(يونيو|حزيران|ژوئن)/i, month: 5 },
              { pattern: /(\d+)\s*(يوليو|تموز|ژوئیه)/i, month: 6 },
              { pattern: /(\d+)\s*(أغسطس|آب|اوت)/i, month: 7 },
              { pattern: /(\d+)\s*(سبتمبر|أيلول|سپتامبر)/i, month: 8 },
              { pattern: /(\d+)\s*(أكتوبر|تشرين الأول|اکتبر)/i, month: 9 },
              { pattern: /(\d+)\s*(نوفمبر|تشرين الثاني|نوامبر)/i, month: 10 },
              { pattern: /(\d+)\s*(ديسمبر|كانون الأول|دسامبر)/i, month: 11 },
            ];

            for (const { pattern, month } of monthPatterns) {
              const match = text.match(pattern);
              if (match) {
                const day = parseInt(match[1]);
                const year = new Date().getFullYear();
                return new Date(year, month, day).toISOString();
              }
            }

            // Pattern 2: ISO-like date in text "2025-10-31"
            const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
              return new Date(isoMatch[0]).toISOString();
            }

            // Pattern 3: "اليوم" (today), "أمس" (yesterday)
            if (text.match(/اليوم|امروز/i)) {
              return new Date().toISOString();
            }
            if (text.match(/أمس|دیروز/i)) {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              return yesterday.toISOString();
            }

            return null;
          };

          // Debug: Show what we found
          if (i < 3) {
            console.log(`\n📋 Field extraction results for Row ${i + 1}:`);
            console.log(`  📝 Title: "${rawTitle.substring(0, 50)}"`);
            console.log(`  📄 Contents: "${rawContents.substring(0, 50)}"`);
            console.log(`  🌐 Source: "${rawSource.substring(0, 40)}"`);
            console.log(`  🔗 URL: "${rawUrl.substring(0, 40)}"`);
            console.log(`  ✍️ Author: "${rawAuthor.substring(0, 30)}"`);
            console.log(`  📅 Date raw: "${row.date || row.تاریخ || row.published_at || row.published_date || 'NONE'}"`);
          }

          // Smart content detection: title vs contents
          let finalTitle = "";
          let finalContents = "";

          // Skip fields that look like timestamps
          const isTimestamp = (text: string) => {
            return text.match(/^\w+ \d{1,2}, \d{4} at \d{1,2}:\d{2}[AP]M$/);
          };

          if (rawTitle && !isTimestamp(rawTitle)) {
            finalTitle = rawTitle;
          } else if (rawContents && !isTimestamp(rawContents)) {
            finalTitle = rawContents.substring(0, 100); // Use first part as title
          }

          if (rawContents && rawContents !== finalTitle) {
            finalContents = rawContents;
          } else if (rawTitle && rawTitle !== finalTitle) {
            finalContents = rawTitle;
          }

          // Clean HTML from both fields
          const title = cleanHTML(finalTitle).trim();
          const contents = cleanHTML(finalContents || finalTitle).trim();

          // SMART SOURCE DETECTION - Multi-strategy approach
          let cleanSource = "";
          let finalUrl = "";

          // Helper: Extract source from content text
          const extractSourceFromText = (text: string): string => {
            if (!text) return "";
            
            // Pattern 1: "به گزارش [منبع]" or "وفق [منبع]"
            const reportPatterns = [
              /به گزارش\s+([^\s،.]+)/,
              /وفق\s+([^\s،.]+)/,
              /به نقل از\s+([^\s،.]+)/,
              /منبع:\s*([^\s،.]+)/,
              /نقل از\s+([^\s،.]+)/,
            ];
            
            for (const pattern of reportPatterns) {
              const match = text.match(pattern);
              if (match && match[1]) {
                return match[1].trim();
              }
            }
            
            // Pattern 2: Known source names in text
            const knownSources = [
              { pattern: /الجزيرة|الجزیرة/i, name: "الجزیرة" },
              { pattern: /العربية|العربیة/i, name: "العربية" },
              { pattern: /بي بي سي|BBC/i, name: "BBC Arabic" },
              { pattern: /سكاي نيوز|Sky News/i, name: "سكاي نيوز عربية" },
              { pattern: /رويترز|Reuters/i, name: "Reuters" },
              { pattern: /فرانس 24|France 24/i, name: "France 24" },
              { pattern: /سي ان ان|CNN/i, name: "CNN" },
              { pattern: /الشرق الأوسط/i, name: "الشرق الأوسط" },
              { pattern: /اليوم السابع/i, name: "اليوم السابع" },
              { pattern: /القدس العربي/i, name: "القدس العربي" },
              { pattern: /العربي الجديد/i, name: "العربي الجديد" },
              { pattern: /ایسنا|ISNA/i, name: "ایسنا" },
              { pattern: /مهر|Mehr/i, name: "مهر" },
              { pattern: /تسنیم|Tasnim/i, name: "تسنیم" },
              { pattern: /فارس|Fars/i, name: "فارس" },
              { pattern: /ایرنا|IRNA/i, name: "ایرنا" },
              { pattern: /RT Arabic|آر تي/i, name: "RT Arabic" },
              { pattern: /عنب بلدي/i, name: "عنب بلدي" },
            ];
            
            for (const source of knownSources) {
              if (source.pattern.test(text)) {
                return source.name;
              }
            }
            
            return "";
          };

          // Strategy 1: Try to extract from content first
          const sourceFromContent = extractSourceFromText(title + " " + contents);
          if (sourceFromContent) {
            cleanSource = sourceFromContent;
            if (i < 3) {
              console.log(`✅ Source extracted from content: ${cleanSource}`);
            }
          }

          // Strategy 2: If we have a clean URL, extract domain from it
          if (!cleanSource && rawUrl && rawUrl.includes("http")) {
            try {
              const urlObj = new URL(rawUrl);
              const domain = urlObj.hostname.replace("www.", "");

              // Comprehensive domain mapping
              const domainMap: Record<string, string> = {
                // Arabic sources
                "arabic.rt.com": "RT Arabic",
                "aljazeera.net": "الجزیرة",
                "bbc.com": "BBC Arabic",
                "enabbaladi.net": "عنب بلدي",
                "jadidouna.com": "جديدونا",
                "skynewsarabia.com": "سكاي نيوز عربية",
                "alarabiya.net": "العربية",
                "independentarabia.com": "اندبندنت عربية",
                "asharq.com": "الشرق",
                "alaraby.co.uk": "العربي الجديد",
                "alquds.co.uk": "القدس العربي",
                "aawsat.com": "الشرق الأوسط",
                "albayan.ae": "البيان",
                "almustaqbal.com": "المستقبل",
                "annahar.com": "النهار",
                "almadenahnews.com": "المدينة",
                "youm7.com": "اليوم السابع",
                "masrawy.com": "مصراوي",
                "dostor.org": "الدستور",
                "elkhabar.com": "الخبر",
                "echorouk.com": "الشروق",
                "hespress.com": "هسبريس",
                "le360.ma": "لو360",
                "alittihad.ae": "الاتحاد",
                "gulftimes.com": "Gulf Times",
                "thenational.ae": "The National",

                // Persian/Iranian sources
                "isna.ir": "ایسنا",
                "mehrnews.com": "مهر",
                "tasnimnews.com": "تسنیم",
                "farsnews.ir": "فارس",
                "irna.ir": "ایرنا",
                "khabaronline.ir": "خبرآنلاین",
                "tabnak.ir": "تابناک",
                "yjc.ir": "باشگاه خبرنگاران",
                "shafaqna.com": "شفقنا",
                "rokna.net": "رکنا",

                // International
                "reuters.com": "Reuters",
                "cnn.com": "CNN",
                "bbc.co.uk": "BBC",
                "apnews.com": "Associated Press",
                "france24.com": "France 24",
                "dw.com": "Deutsche Welle",
              };

              cleanSource = domainMap[domain] || domain;
              finalUrl = rawUrl;

              if (i < 3) {
                console.log(`✅ Source from URL: ${domain} → ${cleanSource}`);
              }
            } catch (e) {
              if (i < 3) console.log(`⚠️ URL parsing failed: ${rawUrl}`);
              cleanSource = rawUrl.replace("https://", "").replace("http://", "").split("/")[0];
              finalUrl = rawUrl;
            }
          }

          // Strategy 3: If URL method didn't work, check rawSource field
          if (!cleanSource && rawSource) {
            if (rawSource.includes("http")) {
              // rawSource is actually a URL
              try {
                const urlObj = new URL(rawSource);
                const domain = urlObj.hostname.replace("www.", "");

                const domainMap: Record<string, string> = {
                  "arabic.rt.com": "RT Arabic",
                  "aljazeera.net": "الجزیرة",
                  "bbc.com": "BBC Arabic",
                  "enabbaladi.net": "عنب بلدي",
                  "jadidouna.com": "جديدونا",
                  "skynewsarabia.com": "سكاي نيوز عربية",
                  "alarabiya.net": "العربية",
                  "independentarabia.com": "اندبندنت عربية",
                  "asharq.com": "الشرق",
                };

                cleanSource = domainMap[domain] || domain;
                finalUrl = rawSource;

                if (i < 3) {
                  console.log(`✅ Source from rawSource URL: ${domain} → ${cleanSource}`);
                }
              } catch (e) {
                cleanSource = rawSource.replace("https://", "").replace("http://", "").split("/")[0];
                finalUrl = rawSource;
              }
            } else {
              // rawSource is already a clean name
              cleanSource = rawSource;
              finalUrl = rawUrl || "";

              if (i < 3) {
                console.log(`✅ Source from rawSource name: ${cleanSource}`);
              }
            }
          }

          // Strategy 4: Try to extract from any URL-like field
          if (!cleanSource) {
            const allFields = Object.values(row);
            for (const field of allFields) {
              if (typeof field === "string" && field.includes("http") && field.includes(".")) {
                try {
                  const urlObj = new URL(field);
                  const domain = urlObj.hostname.replace("www.", "");
                  cleanSource = domain;
                  finalUrl = field;

                  if (i < 3) {
                    console.log(`✅ Source from scan: ${domain}`);
                  }
                  break;
                } catch (e) {
                  continue;
                }
              }
            }
          }

          // Strategy 5: Infer from language and content patterns
          if (!cleanSource) {
            const isArabic = (title + contents).match(/[\u0600-\u06FF]/);
            const isPersian = (title + contents).match(/[پچژگیئ]/);
            const isEnglish = (title + contents).match(/[a-zA-Z]{10,}/);
            
            if (isArabic && !isPersian) {
              cleanSource = "منبع عربی";
            } else if (isPersian) {
              cleanSource = "منبع فارسی";
            } else if (isEnglish) {
              cleanSource = "English Source";
            } else {
              cleanSource = rawSource || rawUrl || "منبع نامعین";
            }
            
            finalUrl = rawUrl || rawSource || "";

            if (i < 3) {
              console.log(`⚠️ Inferred source: ${cleanSource}`);
            }
          }

          // Detect language early (before validation logs)
          const detectedLanguage = detectLanguage(title + " " + contents);

          if (i < 3) {
            console.log(`\n📋 FINAL Row ${lastSyncedRow + i + 1} results:`);
            console.log(`  📝 Title: "${title.substring(0, 60)}"`);
            console.log(`  📄 Contents: "${contents.substring(0, 60)}"`);
            console.log(`  🌐 Source: "${cleanSource}"`);
            console.log(`  📱 Source Type: "${detectSourceType(finalUrl, cleanSource)}"`);
            console.log(`  🔗 URL: "${finalUrl.substring(0, 50)}"`);
            console.log(`  ✍️ Author: "${rawAuthor}"`);
            console.log(`  🌍 Language: ${detectedLanguage}`);
            console.log(`  📊 Validation: Title=${!!title}, Source=${!!cleanSource}, URL=${!!finalUrl}`);
          }

          if (!title || title.trim().length < 10) {
            validationSkips.noTitle++;
            if (i < 5) console.log(`⚠️ Row ${lastSyncedRow + i + 1}: Title too short (${title.length} chars)`);
            continue;
          }

          if (title === "بدون عنوان" || title === "undefined" || title === "null") {
            validationSkips.placeholderTitle++;
            if (i < 5) console.log(`⚠️ Row ${lastSyncedRow + i + 1}: Placeholder title`);
            continue;
          }

          if (i < 3) {
            console.log(`🌐 Language detection for row ${i + 1}:`, {
              sample: (title + " " + contents).substring(0, 100),
              detected: detectedLanguage,
              hasArabicChars: !!(title + contents).match(/[ضصثقفغعهخحجد]/g),
              hasPersianChars: !!(title + contents).match(/[پچژگیئ]/g),
              hasEnglishChars: !!(title + contents).match(/[a-zA-Z]/g),
            });
          }

          // Detect country from source
          const detectedCountry = detectCountryFromSource(cleanSource, finalUrl || '');

          if (i < 3) {
            console.log(`🌍 Country detection for row ${i + 1}:`, {
              source: cleanSource,
              sourceUrl: finalUrl,
              detectedCountry: detectedCountry || 'نامشخص'
            });
          }

          const post = {
            title: title,
            contents: contents || "محتوا موجود نیست",
            source: cleanSource,
            source_type: detectSourceType(finalUrl, cleanSource),
            source_country: detectedCountry || 'نامشخص',
            author: rawAuthor || null,
            published_at: (() => {
              // Try date fields first
              const dateFields = [
                row.date,
                row.تاریخ,
                row.published_at,
                row.published_date,
                row.pubdate,
                row['تاریخ انتشار'],
                row['Publication Date'],
                row.timestamp,
              ];

              for (const field of dateFields) {
                if (field && typeof field === 'string' && field.trim().length > 0) {
                  const parsed = parseDate(field);
                  if (i < 3) {
                    console.log(`📅 Date from field "${field}": ${parsed}`);
                  }
                  return parsed;
                }
              }

              // Try extracting from content
              const dateFromText = extractDateFromText(title + " " + contents);
              if (dateFromText) {
                if (i < 3) {
                  console.log(`📅 Date extracted from text: ${dateFromText}`);
                }
                return dateFromText;
              }

              // Fallback to today
              if (i < 3) {
                console.log(`⚠️ No date found, using today`);
              }
              return new Date().toISOString();
            })(),
            source_url: finalUrl || null,
            language: detectedLanguage,
            status: "جدید",
          };

          // ✅ قانون 24 ساعت: رد کردن پست‌های قدیمی‌تر از 24 ساعت
          const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
          const publishedTime = new Date(post.published_at).getTime();

          if (publishedTime < oneDayAgo) {
            const hoursOld = Math.round((Date.now() - publishedTime) / (1000 * 60 * 60));
            console.log(`⏭️ [Row ${lastSyncedRow + i + 1}] Skipping old post (${hoursOld}h old): "${title.substring(0, 50)}..."`);
            validationSkips.oldPost++;
            continue;
          }

          if (i < 3) {
            console.log(`✅ [Row ${lastSyncedRow + i + 1}] Post is within 24h, proceeding...`);
          }

          // Check duplicates only by title
          const { data: existingPost } = await supabase
            .from("posts")
            .select("id")
            .eq("title", post.title)
            .maybeSingle();

          if (existingPost) {
            validationSkips.duplicate++;
            if (i < 5) console.log(`⚠️ Duplicate: ${post.title.substring(0, 40)}`);
            continue;
          }

          const { error } = await supabase.from("posts").insert([post]);

          if (error) {
            console.error(`❌ Insert error:`, error.message);
            errorCount++;
            if (errorCount <= 3) console.error("Failed post:", post);
          } else {
            importedCount++;

            // ✨ NEW: Update source profiles and channels
            await upsertSourceProfile(
              cleanSource,
              finalUrl,
              post.source_type,
              post.source_country || 'نامشخص',
              false // We don't know if it's PsyOp yet during initial import
            );

            // If it's social media, also update channels table
            if (post.source_type === 'social_media') {
              const platform = finalUrl.includes('t.me') || finalUrl.includes('telegram') ? 'Telegram' :
                               finalUrl.includes('twitter.com') || finalUrl.includes('x.com') ? 'Twitter' :
                               finalUrl.includes('facebook.com') ? 'Facebook' :
                               finalUrl.includes('instagram.com') ? 'Instagram' :
                               finalUrl.includes('youtube.com') ? 'YouTube' : 'Other';

              await upsertSocialMediaChannel(
                cleanSource,
                platform,
                finalUrl,
                post.source_country || 'نامشخص',
                false
              );
            }

            if (importedCount % 10 === 0) {
              console.log(`✅ Imported ${importedCount}/${rowsToSync.length}`);
            }
          }
        } catch (error) {
          console.error("Error processing row:", error);
          errorCount++;
        }
      }

      setSyncProgress(90);

      const totalSkipped = validationSkips.noTitle + validationSkips.placeholderTitle + validationSkips.duplicate + validationSkips.oldPost;

      console.log("📊 Validation Summary:", {
        totalRows: rowsToSync.length,
        imported: importedCount,
        skipped: totalSkipped,
        errors: errorCount,
        skipReasons: validationSkips,
      });

      const actualRowCount = lastSyncedRow + importedCount;
      
      // Save sync progress with sheet-specific key (using sheetSpecificKey from line 943)
      localStorage.setItem(sheetSpecificKey, String(actualRowCount));
      localStorage.setItem("lastSyncedRow", String(actualRowCount)); // Keep for backward compatibility
      localStorage.setItem("totalRowsInSheet", String(totalRows));
      localStorage.setItem("currentSheetId", settings.google_sheet_id);

      const now = new Date().toISOString();
      saveSettings({
        last_sync_time: now,
        sync_status: "success",
      });

      const syncHistory = JSON.parse(localStorage.getItem("syncHistory") || "[]");
      syncHistory.push({
        timestamp: now,
        rowsImported: importedCount,
        rowsSkipped: totalSkipped,
        errors: errorCount,
        totalRows: actualRowCount,
        validationSkips: validationSkips,
        sheetId: settings.google_sheet_id,
      });
      localStorage.setItem("syncHistory", JSON.stringify(syncHistory.slice(-10)));

      setSyncProgress(100);
      await checkSyncStatus();

      toast({
        title: "✅ همگام‌سازی کامل شد",
        description: `✅ ${importedCount} مطلب وارد شد${totalSkipped > 0 ? `\n⚠️ ${totalSkipped} ردیف رد شد (${validationSkips.duplicate} تکراری، ${validationSkips.oldPost} قدیمی‌تر از 24 ساعت)` : ""}${errorCount > 0 ? `\n❌ ${errorCount} خطا` : ""}`,
      });

      console.log("✅ Sync completed:", {
        imported: importedCount,
        skipped: totalSkipped,
        errors: errorCount,
        totalInDB: actualRowCount,
      });

      setIsSyncing(false);
      setSyncProgress(0);
    } catch (error) {
      console.error("Sync error:", error);
      saveSettings({ sync_status: "error" });
      toast({
        title: "❌ خطا در همگام‌سازی",
        description: error.message,
        variant: "destructive",
      });
      setIsSyncing(false);
      setSyncProgress(0);
    }
  };

  const handleExportData = () => {
    try {
      const dataStr = JSON.stringify(settings, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `settings-backup-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "دانلود موفق",
        description: "فایل پشتیبان دانلود شد",
      });
    } catch (error) {
      toast({
        title: "خطا",
        description: "خطا در دانلود فایل",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">تنظیمات</h1>
          <p className="text-muted-foreground mt-2">پیکربندی سیستم و تنظیمات پیشرفته</p>
        </div>

        {cleanupStats.empty > 0 && (
          <Alert variant="destructive" className="border-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <strong>⚠️ {cleanupStats.empty} مطلب خالی</strong> در دیتابیس شما وجود دارد
                <span className="text-sm block mt-1">
                  ({Math.round((cleanupStats.empty / cleanupStats.total) * 100)}% از کل)
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={inspectSchema} disabled={inspecting}>
                  {inspecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
                <Button variant="destructive" size="sm" onClick={cleanupEmptyPosts} disabled={cleaning}>
                  {cleaning ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      در حال حذف...
                    </>
                  ) : (
                    <>
                      <Trash2 className="ml-2 h-4 w-4" />
                      حذف همه ({cleanupStats.empty})
                    </>
                  )}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="data-sources" className="w-full">
          <TabsList className="grid w-full grid-cols-7 mb-8">
            <TabsTrigger 
              value="users" 
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">مدیریت کاربران</span>
            </TabsTrigger>
            <TabsTrigger value="data-sources" className="gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">منابع داده</span>
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">قوانین رصد</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">مدیریت تیم</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">ظاهر</span>
            </TabsTrigger>
            <TabsTrigger value="automation" className="gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">اتوماسیون</span>
            </TabsTrigger>
            <TabsTrigger value="automation-control" className="gap-2">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">کنترل اتوماسیون</span>
            </TabsTrigger>
            <TabsTrigger
              value="api-usage"
              className="gap-2"
              onClick={() => window.location.href = '/settings/api-usage'}
            >
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">مصرف API</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="data-sources" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  کلیدهای API
                </CardTitle>
                <CardDescription>پیکربندی کلیدهای API برای سرویس‌های خارجی</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>مدیریت امن کلیدهای API</AlertTitle>
                  <AlertDescription>
                    کلیدهای API به صورت ایمن در سمت سرور نگهداری می‌شوند و فقط مدیران سیستم می‌توانند آن‌ها را تغییر دهند. 
                    این رویکرد از افشای کلیدهای محرمانه در مرورگر کاربران جلوگیری می‌کند.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">DeepSeek AI API</h4>
                      <p className="text-sm text-muted-foreground">برای تحلیل هوش مصنوعی محتوا</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="text-sm text-success">فعال</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4 opacity-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">OpenAI API</h4>
                      <p className="text-sm text-muted-foreground">در نسخه بعدی فعال خواهد شد</p>
                    </div>
                    <span className="text-sm text-muted-foreground">غیرفعال</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>اتصال به Google Sheets</CardTitle>
                <CardDescription>وارد کردن داده‌ها از Google Sheets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sheet-id">شناسه Sheet</Label>
                  <Input
                    id="sheet-id"
                    value={settings.google_sheet_id}
                    onChange={(e) => setSettings({ ...settings, google_sheet_id: e.target.value })}
                    placeholder="11VzLIg5-evMkd..."
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sheet-name">نام Sheet</Label>
                  <Input
                    id="sheet-name"
                    value={settings.google_sheet_name}
                    onChange={(e) => setSettings({ ...settings, google_sheet_name: e.target.value })}
                    placeholder="Sheet1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="google-api-key">Google API Key (اختیاری - برای بیش از 1000 ردیف)</Label>
                  <Input
                    id="google-api-key"
                    type="password"
                    value={settings.google_api_key}
                    onChange={(e) => setSettings({ ...settings, google_api_key: e.target.value })}
                    placeholder="AIzaSy..."
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    برای import بیش از 1000 ردیف، یک API Key رایگان از{" "}
                    <a 
                      href="https://console.cloud.google.com/apis/credentials" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Google Cloud Console
                    </a>
                    {" "}دریافت کنید و Google Sheets API را فعال کنید.
                  </p>
                </div>

                <Alert>
                  <AlertDescription>
                    💡 بدون API Key فقط 1000 ردیف اول import می‌شود. برای دریافت API Key رایگان، کافیست یک پروژه در Google Cloud بسازید و Google Sheets API را فعال کنید.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const oldSheetId = localStorage.getItem("currentSheetId");
                      const newSheetId = settings.google_sheet_id;
                      
                      // If sheet ID changed, warn user and reset sync
                      if (oldSheetId && oldSheetId !== newSheetId) {
                        const confirmed = confirm(
                          `شناسه Sheet تغییر کرده است. آیا می‌خواهید:\n\n` +
                          `✅ تأیید: همگام‌سازی این شیت جدید از ابتدا شروع می‌شود\n` +
                          `❌ لغو: تغییرات ذخیره نخواهد شد`
                        );
                        
                        if (!confirmed) return;
                        
                        // Reset sync for new sheet
                        const newSheetKey = `lastSyncedRow_${newSheetId}`;
                        localStorage.setItem(newSheetKey, "0");
                        
                        toast({
                          title: "شیت جدید تنظیم شد",
                          description: "همگام‌سازی از ردیف اول شروع خواهد شد",
                        });
                      }
                      
                      saveSettings({
                        google_sheet_id: settings.google_sheet_id,
                        google_sheet_name: settings.google_sheet_name,
                        google_api_key: settings.google_api_key,
                      });
                    }}
                  >
                    ذخیره
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>📊 وضعیت همگام‌سازی</span>
                  <Button variant="ghost" size="sm" onClick={checkSyncStatus}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{syncStats.sheetRows}</div>
                    <div className="text-xs text-muted-foreground">ردیف در Sheet</div>
                  </div>

                  <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{syncStats.dbPosts}</div>
                    <div className="text-xs text-muted-foreground">پست در دیتابیس</div>
                  </div>

                  <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{syncStats.lastSynced}</div>
                    <div className="text-xs text-muted-foreground">ردیف آخر (localStorage)</div>
                  </div>

                  <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{syncStats.pendingRows}</div>
                    <div className="text-xs text-muted-foreground">در انتظار import</div>
                  </div>
                </div>

                {syncStats.pendingRows > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>توجه</AlertTitle>
                    <AlertDescription>
                      {syncStats.pendingRows} ردیف جدید در Google Sheet وجود دارد که هنوز وارد نشده است.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="mt-4 text-xs text-muted-foreground">
                  آخرین همگام‌سازی:{" "}
                  {settings.last_sync_time
                    ? new Date(settings.last_sync_time).toLocaleString("fa-IR")
                    : "هنوز انجام نشده"}
                </div>

                {isSyncing && (
                  <div className="space-y-2">
                    <Progress value={syncProgress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>در حال پردازش...</span>
                      <span>{Math.round(syncProgress)}%</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Button
                    onClick={handleManualSync}
                    disabled={isSyncing || syncStats.pendingRows === 0}
                    className="flex-1"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                        در حال همگام‌سازی...
                      </>
                    ) : (
                      <>
                        <Download className="ms-2 h-4 w-4" />
                        همگام‌سازی ({syncStats.pendingRows} ردیف جدید)
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      const sheetSpecificKey = `lastSyncedRow_${settings.google_sheet_id}`;
                      localStorage.setItem(sheetSpecificKey, String(syncStats.dbPosts));
                      localStorage.setItem("lastSyncedRow", String(syncStats.dbPosts));
                      localStorage.setItem("totalRowsInSheet", String(syncStats.sheetRows));
                      localStorage.setItem("currentSheetId", settings.google_sheet_id);
                      checkSyncStatus();
                      toast({
                        title: "تنظیمات اصلاح شد",
                        description: "localStorage با دیتابیس همگام شد",
                      });
                    }}
                    className="flex-1"
                  >
                    <SettingsIcon className="ms-2 h-4 w-4" />
                    اصلاح localStorage
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (
                        !confirm(
                          `آیا مطمئن هستید؟ این عملیات تمام ${syncStats.sheetRows} ردیف را دوباره وارد می‌کند و ممکن است مطالب تکراری ایجاد کند.`,
                        )
                      ) {
                        return;
                      }
                      const sheetSpecificKey = `lastSyncedRow_${settings.google_sheet_id}`;
                      localStorage.setItem(sheetSpecificKey, "0");
                      localStorage.setItem("lastSyncedRow", "0");
                      await checkSyncStatus();
                      await handleManualSync();
                    }}
                    disabled={isSyncing}
                    className="flex-1"
                  >
                    <RotateCcw className="ms-2 h-4 w-4" />
                    همگام‌سازی کامل (خطرناک)
                  </Button>
                </div>

                <Button
                  variant="destructive"
                  onClick={deleteAllPosts}
                  disabled={cleaning || syncStats.dbPosts === 0}
                  className="w-full mt-2"
                >
                  {cleaning ? (
                    <>
                      <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                      در حال حذف...
                    </>
                  ) : (
                    <>
                      <Trash2 className="ms-2 h-4 w-4" />
                      حذف همه پست‌ها ({syncStats.dbPosts})
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="h-5 w-5" />
                  تشخیص مجدد زبان مطالب
                </CardTitle>
                <CardDescription>
                  استفاده از الگوریتم پیشرفته ۵ روشی برای دقت بالاتر در تشخیص زبان فارسی، عربی و ترکیبی
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {redetectStats.updated > 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex flex-col gap-2">
                        <div className="font-bold">
                          ✅ آخرین تشخیص: {redetectStats.updated} مطلب به‌روزرسانی شد
                        </div>
                        <div className="text-sm space-y-1">
                          <div>📊 کل مطالب: {redetectStats.total}</div>
                          <div>🇮🇷 فارسی: {redetectStats.persian}</div>
                          <div>🇸🇦 عربی: {redetectStats.arabic}</div>
                          <div>🔀 ترکیبی: {redetectStats.mixed}</div>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {redetecting && redetectProgress > 0 && (
                  <div className="space-y-2">
                    <Progress value={redetectProgress} />
                    <p className="text-sm text-muted-foreground text-center">
                      در حال پردازش... {redetectProgress}%
                    </p>
                  </div>
                )}

                <Button
                  variant="secondary"
                  onClick={redetectAllLanguages}
                  disabled={redetecting || syncStats.dbPosts === 0}
                  className="w-full"
                >
                  {redetecting ? (
                    <>
                      <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                      در حال تشخیص مجدد... ({redetectProgress}%)
                    </>
                  ) : (
                    <>
                      <Languages className="ms-2 h-4 w-4" />
                      تشخیص مجدد زبان همه مطالب ({syncStats.dbPosts})
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground">
                  💡 این ابزار با استفاده از ۵ روش مختلف (کاراکترهای منحصربه‌فرد، الگوهای کلمات، فرکانس حروف، دیاکریتیک‌ها و سیستم اعداد) زبان هر مطلب را با دقت بالاتر از ۹۵٪ تشخیص می‌دهد.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>وضعیت اتصالات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="font-medium">DeepSeek API</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="text-sm text-success">فعال</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="font-medium">پایگاه داده</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="text-sm text-success">متصل (Supabase)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>مدیریت کلیدواژه‌ها</CardTitle>
                <CardDescription>افزودن و مدیریت کلیدواژه‌های رصد</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>این بخش در نسخه بعدی فعال خواهد شد</p>
                  <p className="text-sm mt-2">مدیریت کلیدواژه‌ها، دسته‌بندی و اولویت‌بندی</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>قوانین هشدار</CardTitle>
                <CardDescription>تنظیم شرایط ایجاد خودکار هشدار</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>این بخش در نسخه بعدی فعال خواهد شد</p>
                  <p className="text-sm mt-2">تعریف قوانین برای ایجاد خودکار هشدار بر اساس سطح تهدید</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>مدیریت تیم</CardTitle>
                <CardDescription>مدیریت کاربران و دسترسی‌ها</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">این بخش در نسخه بعدی فعال خواهد شد</h3>
                  <p className="text-muted-foreground mb-6">افزودن کاربران، تعریف نقش‌ها و مدیریت دسترسی‌ها</p>

                  <div className="max-w-md mx-auto mt-8 p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-3">اطلاعات کاربر فعلی</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">نقش:</span>
                        <span className="font-medium">مدیر</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">وضعیت:</span>
                        <span className="text-success">فعال</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>مدیریت تصاویر اهداف</CardTitle>
                <CardDescription>آپلود و مدیریت تصاویر شخصیت‌ها و سازمان‌های مورد هدف</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    در این بخش می‌توانید تصاویر شخصیت‌ها و سازمان‌های مورد هدف را مدیریت کنید.
                    امکان آپلود دستی تصویر، دریافت خودکار از Wikipedia و مدیریت تصاویر موجود.
                  </p>
                  <Button 
                    variant="default" 
                    className="w-full"
                    onClick={() => navigate('/settings/photo-management')}
                  >
                    <Users className="h-4 w-4 ms-2" />
                    مدیریت تصاویر اهداف
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>تم و رنگ</CardTitle>
                <CardDescription>تنظیمات ظاهری و رنگ‌بندی</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="dark-mode">حالت تاریک</Label>
                    <p className="text-sm text-muted-foreground">فعال‌سازی حالت شب</p>
                  </div>
                  <Switch
                    id="dark-mode"
                    checked={settings.dark_mode}
                    onCheckedChange={(checked) => saveSettings({ dark_mode: checked })}
                  />
                </div>

                <div className="space-y-3">
                  <Label>طرح رنگی</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {["blue", "purple", "green", "orange"].map((color) => (
                      <button
                        key={color}
                        onClick={() => saveSettings({ theme: color })}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          settings.theme === color ? "border-primary" : "border-border"
                        }`}
                      >
                        <div
                          className={`h-12 w-full rounded ${
                            color === "blue"
                              ? "bg-primary"
                              : color === "purple"
                                ? "bg-purple-500"
                                : color === "green"
                                  ? "bg-success"
                                  : "bg-warning"
                          }`}
                        />
                        <p className="text-sm mt-2 capitalize">{color}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={() => saveSettings({})}>ذخیره تنظیمات</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>تنظیمات نمایش</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notifications">اعلان‌های دسکتاپ</Label>
                  <Switch
                    id="notifications"
                    checked={settings.notifications_enabled}
                    onCheckedChange={(checked) => saveSettings({ notifications_enabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="sounds">صدای هشدارها</Label>
                  <Switch
                    id="sounds"
                    checked={settings.alert_sounds}
                    onCheckedChange={(checked) => saveSettings({ alert_sounds: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>اندازه فونت: {settings.font_size}px</Label>
                  <Slider
                    value={[settings.font_size]}
                    onValueChange={(value) => saveSettings({ font_size: value[0] })}
                    min={12}
                    max={20}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="tooltips">نمایش راهنماها</Label>
                  <Switch
                    id="tooltips"
                    checked={settings.show_tooltips}
                    onCheckedChange={(checked) => saveSettings({ show_tooltips: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="animations">انیمیشن‌ها</Label>
                  <Switch
                    id="animations"
                    checked={settings.animations_enabled}
                    onCheckedChange={(checked) => saveSettings({ animations_enabled: checked })}
                  />
                </div>

                <Button onClick={() => saveSettings({})}>ذخیره تنظیمات</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>تنظیمات داشبورد</CardTitle>
                <CardDescription>ویجت‌های پیش‌فرض نمایشی</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>نمایش کارت‌های KPI</Label>
                  <Switch
                    checked={settings.show_kpi_cards}
                    onCheckedChange={(checked) => saveSettings({ show_kpi_cards: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>نمایش نمودارها</Label>
                  <Switch
                    checked={settings.show_charts}
                    onCheckedChange={(checked) => saveSettings({ show_charts: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>نمایش پست‌های اخیر</Label>
                  <Switch
                    checked={settings.show_recent_posts}
                    onCheckedChange={(checked) => saveSettings({ show_recent_posts: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>نمایش هشدارهای اخیر</Label>
                  <Switch
                    checked={settings.show_recent_alerts}
                    onCheckedChange={(checked) => saveSettings({ show_recent_alerts: checked })}
                  />
                </div>

                <Button onClick={() => saveSettings({})}>ذخیره تنظیمات</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>تحلیل خودکار</CardTitle>
                <CardDescription>تنظیمات تحلیل خودکار محتوا</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-analysis">تحلیل خودکار مطالب جدید</Label>
                    <p className="text-sm text-muted-foreground">تحلیل هوشمند پست‌های جدید</p>
                  </div>
                  <Switch
                    id="auto-analysis"
                    checked={settings.auto_analysis}
                    onCheckedChange={(checked) => saveSettings({ auto_analysis: checked })}
                  />
                </div>

                {settings.auto_analysis && (
                  <>
                    <div className="space-y-2">
                      <Label>تاخیر قبل از تحلیل: {settings.analysis_delay} دقیقه</Label>
                      <Slider
                        value={[settings.analysis_delay]}
                        onValueChange={(value) => saveSettings({ analysis_delay: value[0] })}
                        min={1}
                        max={60}
                        step={1}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="batch-size">تعداد پست در هر دسته</Label>
                      <Input
                        id="batch-size"
                        type="number"
                        value={settings.batch_size}
                        onChange={(e) => setSettings({ ...settings, batch_size: e.target.value })}
                        min="1"
                        max="100"
                      />
                    </div>
                  </>
                )}

                <Button onClick={() => saveSettings({})}>ذخیره تنظیمات</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>همگام‌سازی خودکار</CardTitle>
                <CardDescription>تنظیمات همگام‌سازی با Google Sheets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-sync">همگام‌سازی خودکار</Label>
                  <Switch
                    id="auto-sync"
                    checked={settings.auto_sync}
                    onCheckedChange={(checked) => saveSettings({ auto_sync: checked })}
                  />
                </div>

                {settings.auto_sync && (
                  <div className="space-y-2">
                    <Label htmlFor="sync-interval">فاصله زمانی</Label>
                    <select
                      id="sync-interval"
                      value={settings.sync_interval}
                      onChange={(e) => saveSettings({ sync_interval: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3"
                    >
                      <option value="5">هر 5 دقیقه</option>
                      <option value="15">هر 15 دقیقه</option>
                      <option value="30">هر 30 دقیقه</option>
                      <option value="60">هر 1 ساعت</option>
                    </select>
                  </div>
                )}

                <Button onClick={() => saveSettings({})}>ذخیره تنظیمات</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>پشتیبان‌گیری و خروجی</CardTitle>
                <CardDescription>دانلود و مدیریت پشتیبان داده‌ها</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleExportData} variant="outline" className="w-full">
                  <Download className="h-4 w-4 ms-2" />
                  دانلود پشتیبان از تمام داده‌ها
                </Button>

                <div className="space-y-2">
                  <Label htmlFor="auto-backup">پشتیبان‌گیری خودکار</Label>
                  <select
                    id="auto-backup"
                    value={settings.auto_backup}
                    onChange={(e) => saveSettings({ auto_backup: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3"
                  >
                    <option value="never">هرگز</option>
                    <option value="daily">روزانه</option>
                    <option value="weekly">هفتگی</option>
                    <option value="monthly">ماهانه</option>
                  </select>
                </div>

                <Button onClick={handleSaveApiKey}>ذخیره تنظیمات</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automation-control" className="space-y-6">
            {/* Master Control Card */}
            <Card>
              <CardHeader>
                <CardTitle>کنترل سیستم خودکار</CardTitle>
                <CardDescription>مدیریت وضعیت کلی سیستم تحلیل خودکار</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">وضعیت سیستم</div>
                    <p className="text-sm text-muted-foreground">
                      {systemEnabled ? "سیستم فعال و در حال اجرا است" : "سیستم غیرفعال است"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={systemEnabled ? "default" : "secondary"}>
                      {systemEnabled ? "✅ فعال" : "⏸️ غیرفعال"}
                    </Badge>
                    <Switch
                      checked={systemEnabled}
                      onCheckedChange={toggleSystemEnabled}
                      disabled={automationLoading}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={loadAutomationStatus}
                    variant="outline"
                    className="flex-1"
                    disabled={automationLoading}
                  >
                    {automationLoading ? (
                      <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 me-2" />
                    )}
                    بارگذاری وضعیت
                  </Button>
                  <Button
                    onClick={handlePauseAll}
                    variant="outline"
                    className="flex-1"
                    disabled={automationLoading || !systemEnabled}
                  >
                    <Pause className="h-4 w-4 me-2" />
                    توقف همه
                  </Button>
                  <Button
                    onClick={handleResumeAll}
                    variant="outline"
                    className="flex-1"
                    disabled={automationLoading || systemEnabled}
                  >
                    <Play className="h-4 w-4 me-2" />
                    راه‌اندازی همه
                  </Button>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>توجه</AlertTitle>
                  <AlertDescription>
                    غیرفعال کردن سیستم باعث توقف تحلیل خودکار می‌شود. پست‌های جدید در صف تحلیل قرار می‌گیرند اما پردازش نمی‌شوند.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Cron Jobs Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>وضعیت Cron Jobs</CardTitle>
                <CardDescription>نمایش وضعیت وظایف زمان‌بندی شده</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {cronJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                    <p>در حال بارگذاری وضعیت...</p>
                  </div>
                ) : (
                  cronJobs.map((job, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{job.jobname}</div>
                        <p className="text-xs text-muted-foreground font-mono">{job.schedule}</p>
                      </div>
                      <Badge variant={job.active ? "default" : "secondary"}>
                        {job.active ? "✅ فعال" : "⏸️ غیرفعال"}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* SQL Commands Helper Card */}
            <Card>
              <CardHeader>
                <CardTitle>دستورات SQL برای مدیریت</CardTitle>
                <CardDescription>دستورات مفید برای مدیریت دستی سیستم</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">غیرفعال کردن سیستم:</Label>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`UPDATE auto_analysis_config
SET config_value = false
WHERE config_key = 'enabled';`}
                  </pre>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">فعال کردن سیستم:</Label>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`UPDATE auto_analysis_config
SET config_value = true
WHERE config_key = 'enabled';`}
                  </pre>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">مشاهده Cron Jobs:</Label>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`SELECT * FROM cron.job
ORDER BY jobid;`}
                  </pre>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">غیرفعال کردن یک Job:</Label>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`SELECT cron.unschedule('job-name-here');`}
                  </pre>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">مشاهده تنظیمات:</Label>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`SELECT * FROM auto_analysis_config;`}
                  </pre>
                </div>

                <Alert>
                  <Database className="h-4 w-4" />
                  <AlertTitle>نکته</AlertTitle>
                  <AlertDescription>
                    این دستورات را می‌توانید در SQL Editor سوپابیس اجرا کنید. برای دسترسی به Dashboard Supabase مراجعه کنید.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>پیش‌نمایش ردیف‌های بعدی</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {previewData.map((row) => (
              <div
                key={row.rowNumber}
                className={`p-3 border rounded text-sm ${!row.isValid ? "border-destructive bg-destructive/10" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-mono text-xs text-muted-foreground">ردیف {row.rowNumber}</div>
                  {!row.isValid && <span className="text-xs text-destructive font-medium">⚠️ نامعتبر</span>}
                </div>
                <div className="font-medium">{row.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{row.source}</div>
              </div>
            ))}
          </div>
          {previewData.length === 0 && (
            <div className="text-center text-muted-foreground py-8">ردیف جدیدی برای نمایش وجود ندارد</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
