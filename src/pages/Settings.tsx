import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Papa from "papaparse";

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
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      // Field separator
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
};

const Settings = () => {
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

  // Initialize settings from localStorage
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("appSettings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing settings:", e);
      }
    }

    // Default settings
    return {
      deepseek_api_key: "",
      google_sheet_id: localStorage.getItem("sheetId") || "11VzLIg5-evMkdGBUPzFgGXiv6nTgEL4r1wc4FDn2TKQ",
      google_sheet_name: localStorage.getItem("sheetName") || "Sheet1",
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

  // Save settings function
  const saveSettings = (updates: Partial<typeof settings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);

    // Save to localStorage
    localStorage.setItem("appSettings", JSON.stringify(newSettings));

    // Also save individual keys for backward compatibility
    if (updates.theme) localStorage.setItem("theme", updates.theme);
    if (updates.dark_mode !== undefined) localStorage.setItem("darkMode", String(updates.dark_mode));
    if (updates.google_sheet_id) localStorage.setItem("sheetId", updates.google_sheet_id);
    if (updates.google_sheet_name) localStorage.setItem("sheetName", updates.google_sheet_name);
    if (updates.auto_sync !== undefined) localStorage.setItem("autoSyncEnabled", String(updates.auto_sync));
    if (updates.sync_interval) localStorage.setItem("syncInterval", updates.sync_interval);
    if (updates.auto_analysis !== undefined) localStorage.setItem("autoAnalysis", String(updates.auto_analysis));

    toast({
      title: "تنظیمات ذخیره شد",
      description: "تغییرات با موفقیت اعمال شد",
    });

    // Apply theme changes immediately
    if (updates.theme) {
      document.documentElement.setAttribute("data-theme", updates.theme);
    }

    if (updates.dark_mode !== undefined) {
      document.documentElement.classList.toggle("dark", updates.dark_mode);
    }
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

  // Check sync status
  const checkSyncStatus = async () => {
    if (!settings.google_sheet_id || !settings.google_sheet_name) return;

    try {
      // Get sheet row count
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${settings.google_sheet_id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(settings.google_sheet_name)}`;
      const response = await fetch(sheetUrl);
      const csvText = await response.text();

      // Count only non-empty lines
      const allLines = csvText.split("\n");
      const nonEmptyLines = allLines.filter((line) => {
        const cleaned = line.replace(/"/g, "").trim();
        return cleaned && !cleaned.match(/^,+$/) && cleaned.split(",").some((v) => v.trim().length > 0);
      });

      const sheetRows = nonEmptyLines.length - 1; // Exclude header

      console.log(`📊 Total CSV lines: ${allLines.length}, Non-empty: ${nonEmptyLines.length}`);

      // Get database post count
      const { count: dbPosts } = await supabase.from("posts").select("*", { count: "exact", head: true });

      // Get last synced from localStorage
      const lastSynced = parseInt(localStorage.getItem("lastSyncedRow") || "0");

      // Calculate pending
      const pendingRows = sheetRows - Math.max(lastSynced, dbPosts || 0);

      setSyncStats({
        sheetRows,
        dbPosts: dbPosts || 0,
        lastSynced,
        pendingRows: Math.max(0, pendingRows),
      });

      console.log("📊 Sync Status:", {
        sheetRows,
        dbPosts,
        lastSynced,
        pendingRows,
      });
    } catch (error) {
      console.error("Error checking sync status:", error);
    }
  };

  // Call on mount and when sheet settings change
  useEffect(() => {
    if (settings.google_sheet_id) {
      checkSyncStatus();
    }
  }, [settings.google_sheet_id, settings.google_sheet_name]);

  // Check for empty posts on mount
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

      // Test DeepSeek API
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

  // Inspect table schema
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

  // Check for empty posts
  const checkEmptyPosts = async () => {
    try {
      const { data: allPosts, error } = await supabase.from("posts").select("*");

      if (error) throw error;

      // A post is "empty" if it has very few meaningful values
      const emptyPosts = (allPosts || []).filter((post) => {
        // Get all values
        const allValues = Object.entries(post);

        // Filter out system fields and empty values
        const meaningfulValues = allValues.filter(([key, value]) => {
          // Skip system fields
          if (["id", "created_at", "updated_at"].includes(key)) return false;

          // Skip empty/null
          if (value === null || value === "" || value === undefined) return false;

          // Skip if it looks like a UUID
          if (typeof value === "string" && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}/i)) return false;

          return true;
        });

        // Empty if has 2 or fewer meaningful fields
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

  // Delete empty posts
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

      // Get all posts
      const { data: allPosts, error: fetchError } = await supabase.from("posts").select("*");

      if (fetchError) throw fetchError;

      // Find empty posts
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

      // Delete in batches of 100
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

      // Refresh stats
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

  const previewNextRows = async () => {
    if (!settings.google_sheet_id || !settings.google_sheet_name) {
      toast({
        title: "اطلاعات ناقص",
        description: "لطفا Sheet ID و نام Sheet را وارد کنید",
        variant: "destructive",
      });
      return;
    }
  };

  const deleteAllPosts = async () => {
    const confirmMsg = `آیا مطمئن هستید که می‌خواهید همه ${syncStats.dbPosts} مطلب را حذف کنید؟\n\nاین عملیات قابل بازگشت نیست.`;

    if (!confirm(confirmMsg)) return;

    try {
      setCleaning(true);

      toast({
        title: "شروع حذف...",
        description: "لطفاً صبر کنید",
      });

      // Delete all in batches
      let deletedTotal = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch } = await supabase.from("posts").select("id").limit(100);

        if (!batch || batch.length === 0) {
          hasMore = false;
          break;
        }

        const ids = batch.map((p) => p.id);
        await supabase.from("posts").delete().in("id", ids);

        deletedTotal += batch.length;
        console.log(`🗑️ Deleted ${deletedTotal}...`);
      }

      localStorage.setItem("lastSyncedRow", "0");

      toast({
        title: "✅ حذف کامل شد",
        description: `${deletedTotal} مطلب حذف شد`,
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

  const handleManualSync = async () => {
    try {
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${settings.google_sheet_id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(settings.google_sheet_name)}`;

      const response = await fetch(sheetUrl);
      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data;

          // Get current DB count
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

      // Fetch Google Sheet data
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${settings.google_sheet_id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(settings.google_sheet_name)}`;

      console.log("🔗 Fetching from:", sheetUrl);
      setSyncProgress(30);

      const response = await fetch(sheetUrl);

      if (!response.ok) {
        throw new Error("خطا در دریافت داده‌ها. لطفا Sheet ID و دسترسی عمومی را بررسی کنید");
      }

      const csvText = await response.text();
      console.log("📄 CSV fetched, raw size:", csvText.length);
      setSyncProgress(50);

      // ✅ CRITICAL: Filter out empty lines BEFORE processing
      const allLines = csvText.split("\n");
      const dataLines = allLines.filter((line) => {
        // Remove quotes and trim
        const cleaned = line.replace(/"/g, "").trim();

        // Skip if line is empty or only commas
        if (!cleaned || cleaned.match(/^,+$/)) {
          return false;
        }

        // Check if line has at least one non-empty value
        const values = cleaned.split(",");
        const hasContent = values.some((v) => v.trim().length > 0);

        return hasContent;
      });

      console.log(`📊 Total CSV lines: ${allLines.length}, Non-empty lines: ${dataLines.length}`);

      // Get database post count to determine where to start
      const { count: dbPostCount } = await supabase.from("posts").select("*", { count: "exact", head: true });

      const lastSyncedRow = dbPostCount || 0;
      console.log(`📊 Database has ${dbPostCount} posts, syncing from row ${lastSyncedRow + 1}`);

      // Parse CSV with Papa Parse using filtered lines
      const filteredCSV = dataLines.join("\n");

      // Parse CSV manually with proper parsing
      const allLinesRaw = csvText.split("\n");
      const headers = parseCSVLine(allLinesRaw[0]).map((h) => h.replace(/"/g, "").trim());

      console.log("📋 Headers found:", headers);
      console.log("📋 Total headers:", headers.length);

      // Parse data rows
      const rows: any[] = [];
      for (let i = 1; i < dataLines.length; i++) {
        const line = dataLines[i];
        const values = parseCSVLine(line).map((v) => v.replace(/"/g, "").trim());

        // Debug first few rows
        if (i <= 3) {
          console.log(`\n🔍 Row ${i}:`);
          console.log("Values count:", values.length, "Headers count:", headers.length);

          if (values.length !== headers.length) {
            console.warn(`⚠️ Column mismatch: ${values.length} values vs ${headers.length} headers`);
          }
        }

        // Create row object
        const row: any = {};
        headers.forEach((header, index) => {
          const key = header.toLowerCase().trim();
          row[key] = values[index] || "";
        });

        // Debug first few rows
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

      // Only sync rows after lastSyncedRow
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

      console.log(`🔄 Syncing ${rowsToSync.length} new rows...`);

      let importedCount = 0;
      let errorCount = 0;

      // Track validation skip reasons
      const validationSkips = {
        noTitle: 0,
        placeholderTitle: 0,
        duplicate: 0,
      };

      for (let i = 0; i < rowsToSync.length; i++) {
        const row = rowsToSync[i];

        // Update progress
        setSyncProgress(50 + ((i + 1) / rowsToSync.length) * 40);

        try {
          // Extract fields
          const title = (row["title"] || row["عنوان"] || row["headline"] || "").trim();
          const contents = (row["contents"] || row["محتوا"] || row["content"] || "").trim();
          const source = (row["source"] || row["منبع"] || row["publisher"] || "").trim();

          // Debug first few rows
          if (i < 3) {
            console.log(`\n📋 Row ${lastSyncedRow + i + 1} sample:`, {
              title: title.substring(0, 50),
              contents: contents.substring(0, 50),
              source: source.substring(0, 30),
              hasTitle: !!title,
              titleLength: title.length,
            });

            console.log("Extracted title:", {
              title: title.substring(0, 50) || "EMPTY",
              hasTitle: !!title,
              titleLength: title.length,
            });
          }

          // Validation
          if (!title || title.trim().length === 0) {
            validationSkips.noTitle++;
            if (i < 5) console.log(`⚠️ Row ${lastSyncedRow + i + 1}: No title`);
            continue;
          }

          if (title === "بدون عنوان" || title === "undefined" || title === "null") {
            validationSkips.placeholderTitle++;
            if (i < 5) console.log(`⚠️ Row ${lastSyncedRow + i + 1}: Placeholder title`);
            continue;
          }

          // Create post
          const post = {
            title: title,
            contents: contents || "محتوا موجود نیست",
            source: source || "نامشخص",
            author: (row["author"] || row["نویسنده"] || "").trim() || null,
            published_at: row["date"] || row["تاریخ"] || row["published_at"] || new Date().toISOString(),
            source_url: (row["url"] || row["لینک"] || row["source_url"] || "").trim() || null,
            language: row["language"] || row["زبان"] || "فارسی",
            status: "جدید",
          };

          // Check duplicates
          const { data: existingPost } = await supabase
            .from("posts")
            .select("id")
            .eq("title", post.title)
            .eq("published_at", post.published_at)
            .maybeSingle();

          if (existingPost) {
            validationSkips.duplicate++;
            if (i < 5) console.log(`⚠️ Duplicate: ${post.title.substring(0, 40)}`);
            continue;
          }

          // Insert
          const { error } = await supabase.from("posts").insert([post]);

          if (error) {
            console.error(`❌ Insert error:`, error.message);
            errorCount++;
            if (errorCount <= 3) console.error("Failed post:", post);
          } else {
            importedCount++;
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

      const totalSkipped = validationSkips.noTitle + validationSkips.placeholderTitle + validationSkips.duplicate;

      console.log("📊 Validation Summary:", {
        totalRows: rowsToSync.length,
        imported: importedCount,
        skipped: totalSkipped,
        errors: errorCount,
        skipReasons: validationSkips,
      });

      // Update localStorage
      const actualRowCount = lastSyncedRow + importedCount;
      localStorage.setItem("lastSyncedRow", String(actualRowCount));
      localStorage.setItem("totalRowsInSheet", String(totalRows));

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
      });
      localStorage.setItem("syncHistory", JSON.stringify(syncHistory.slice(-10)));

      setSyncProgress(100);

      await checkSyncStatus();

      toast({
        title: "✅ همگام‌سازی کامل شد",
        description: `✅ ${importedCount} مطلب وارد شد${totalSkipped > 0 ? `\n⚠️ ${totalSkipped} ردیف رد شد` : ""}${errorCount > 0 ? `\n❌ ${errorCount} خطا` : ""}`,
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
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">تنظیمات</h1>
          <p className="text-muted-foreground mt-2">پیکربندی سیستم و تنظیمات پیشرفته</p>
        </div>

        {/* Emergency Cleanup Alert */}
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

        {/* Tabs */}
        <Tabs defaultValue="data-sources" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
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
          </TabsList>

          {/* Tab 1: Data Sources */}
          <TabsContent value="data-sources" className="space-y-6">
            {/* API Keys Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  کلیدهای API
                </CardTitle>
                <CardDescription>پیکربندی کلیدهای API برای سرویس‌های خارجی</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* DeepSeek API */}
                <div className="space-y-3">
                  <Label htmlFor="deepseek-key">کلید API دیپ‌سیک</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="deepseek-key"
                        type={showApiKey ? "text" : "password"}
                        value={settings.deepseek_api_key}
                        onChange={(e) => setSettings({ ...settings, deepseek_api_key: e.target.value })}
                        placeholder="sk-..."
                        dir="ltr"
                        className="text-left"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute left-2 top-1/2 -translate-y-1/2"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button onClick={handleTestConnection} disabled={isSaving || !settings.deepseek_api_key}>
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "تست اتصال"}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {apiKeyStatus === "connected" ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span className="text-success">متصل</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">عدم اتصال</span>
                      </>
                    )}
                    {lastTestedTime && (
                      <span className="text-muted-foreground">
                        • آخرین تست: {new Date(lastTestedTime).toLocaleString("fa-IR")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Future APIs (Coming Soon) */}
                <div className="space-y-3 opacity-50">
                  <Label>کلید OpenAI API</Label>
                  <div className="flex gap-2">
                    <Input disabled placeholder="به زودی..." dir="ltr" />
                    <Button disabled>تست اتصال</Button>
                  </div>
                  <span className="text-xs text-muted-foreground">این قابلیت در نسخه بعدی فعال خواهد شد</span>
                </div>

                <Button onClick={handleSaveApiKey} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                  ذخیره کلیدهای API
                </Button>
              </CardContent>
            </Card>

            {/* Google Sheets Integration */}
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

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      saveSettings({
                        google_sheet_id: settings.google_sheet_id,
                        google_sheet_name: settings.google_sheet_name,
                      })
                    }
                  >
                    ذخیره
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sync Status Dashboard */}
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

                {/* Sync Progress */}
                {isSyncing && (
                  <div className="space-y-2">
                    <Progress value={syncProgress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>در حال پردازش...</span>
                      <span>{Math.round(syncProgress)}%</span>
                    </div>
                  </div>
                )}

                {/* Sync Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  {/* Incremental Sync - Default */}
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

                  {/* Fix localStorage */}
                  <Button
                    variant="outline"
                    onClick={() => {
                      localStorage.setItem("lastSyncedRow", String(syncStats.dbPosts));
                      localStorage.setItem("totalRowsInSheet", String(syncStats.sheetRows));
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

                  {/* Full Resync - Dangerous */}
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
              </CardContent>
            </Card>

            {/* Connection Status */}
            <Card>
              <CardHeader>
                <CardTitle>وضعیت اتصالات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="font-medium">DeepSeek API</span>
                    <div className="flex items-center gap-2">
                      {apiKeyStatus === "connected" ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-success" />
                          <span className="text-sm text-success">متصل</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">عدم اتصال</span>
                        </>
                      )}
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

          {/* Tab 2: Monitoring Rules */}
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

          {/* Tab 3: Team Management */}
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
          </TabsContent>

          {/* Tab 4: Appearance */}
          <TabsContent value="appearance" className="space-y-6">
            {/* Theme */}
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

            {/* Display Settings */}
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

            {/* Dashboard Preferences */}
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

          {/* Tab 5: Automation */}
          <TabsContent value="automation" className="space-y-6">
            {/* Auto Analysis */}
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

            {/* Auto Sync */}
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

            {/* Backup & Export */}
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
        </Tabs>
      </div>

      {/* Preview Dialog */}
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
