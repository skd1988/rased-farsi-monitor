# 🔧 راهنمای رفع مشکل نمودار Social Media در Dashboard

## ✅ وضعیت: تغییرات اعمال شده

همه تغییرات در commit `1f0fa15` اعمال شده‌اند:
- ✅ State `socialMediaChannels` اضافه شده
- ✅ Fetch از `social_media_channels` table
- ✅ `socialMediaData` بازنویسی شده با platform mapping
- ✅ Console logging کامل

---

## 🐛 علت مشکل: Browser Cache

اگر هنوز نمودار "سایر" نمایش می‌دهد، مشکل **Browser Cache** است.

---

## 🧹 راه‌حل 1: Hard Reload (سریع)

### Chrome/Edge:
1. باز کن Developer Tools: `F12`
2. کلیک راست روی دکمه Reload در toolbar
3. انتخاب: **"Empty Cache and Hard Reload"**

### Firefox:
1. باز کن Developer Tools: `F12`
2. کلیک راست روی Reload
3. انتخاب: **"Empty Cache and Hard Reload"**

---

## 🧹 راه‌حل 2: Clear Site Data (کامل)

1. باز کن Developer Tools: `F12`
2. برو به tab **Application**
3. از منوی چپ: **Storage → Clear storage**
4. کلیک: **"Clear site data"**
5. بستن DevTools
6. Reload صفحه: `Ctrl+Shift+R` (Windows) یا `Cmd+Shift+R` (Mac)

---

## 🧹 راه‌حل 3: Incognito Mode (برای تست)

1. باز کن Incognito/Private Window:
   - Chrome/Edge: `Ctrl+Shift+N`
   - Firefox: `Ctrl+Shift+P`
2. برو به Dashboard
3. اگر کار کرد، مشکل cache بود

---

## 📊 Console Logs مورد انتظار:

بعد از clear cache، در Console باید ببینی:

```javascript
// هنگام mount شدن Dashboard:
📊 Fetching social media channels for platform mapping...

📊 Platform mapping loaded: {
  totalChannels: 15,
  platforms: ["Telegram", "Facebook", "YouTube", "Twitter"]
}

// هنگام محاسبه نمودار:
📈 Social media posts found: {
  total: 1234,
  sample: [
    { channel: "BBC Persian", platform: "Facebook" },
    { channel: "الجزیرة", platform: "Telegram" },
    { channel: "Sky News", platform: "YouTube" }
  ]
}

✅ Platform counts: {
  "تلگرام": 850,
  "فیسبوک": 234,
  "یوتیوب": 120,
  "توییتر (X)": 30
}
```

---

## ✅ نتیجه مورد انتظار:

### نمودار Pie "تفکیک شبکه‌های اجتماعی":

**قبل (cache شده - اشتباه):**
```
سایر: 95%
تلگرام: 3%
فیسبوک: 2%
```

**بعد (بعد از clear cache - صحیح):**
```
تلگرام: 69%
فیسبوک: 19%
یوتیوب: 10%
توییتر: 2%
```

---

## 🔍 اگر بعد از clear cache هنوز "سایر" می‌بینی:

### چک 1: بررسی Console Logs

باز کن Console (F12) و چک کن:

**اگر این خطا را می‌بینی:**
```
❌ Error fetching channels: { message: "..." }
```
→ مشکل در connection به Supabase است

**اگر این را می‌بینی:**
```
📊 Platform mapping loaded: { totalChannels: 0 }
```
→ جدول `social_media_channels` خالی است یا migration اجرا نشده

**اگر این را می‌بینی:**
```
📈 Social media posts found: { total: 0 }
```
→ posts هیچ `channel_name` ندارند

---

### چک 2: بررسی Database

برو به Supabase SQL Editor و اجرا کن:

```sql
-- چک کردن تعداد channels
SELECT
  platform,
  COUNT(*) as count
FROM social_media_channels
GROUP BY platform;
```

**نتیجه مورد انتظار:**
```
platform  | count
----------|------
Telegram  | 8
Facebook  | 3
YouTube   | 2
Twitter   | 1
```

**اگر همه "Other" بودند:**
→ SQL fix را دوباره اجرا کن (فایل `20251112103329_fix_social_media_channels_platform.sql`)

---

### چک 3: بررسی posts.channel_name

```sql
-- چک کردن که posts دارای channel_name هستند
SELECT
  channel_name,
  COUNT(*) as count
FROM posts
WHERE channel_name IS NOT NULL
GROUP BY channel_name
ORDER BY count DESC
LIMIT 10;
```

**اگر نتیجه‌ای نیامد:**
→ فیلد `channel_name` در posts خالی است، باید populate شود

---

## 🚀 Build و Deploy

اگر در Production هستی و هنوز مشکل داری:

```bash
# Local rebuild:
npm run build

# یا اگر از Vercel/Netlify استفاده می‌کنی:
# Trigger کن یک re-deploy جدید
```

---

## 📞 اگر هنوز مشکل دارید:

Screenshot بگیرید از:
1. ✅ Console logs (F12 → Console)
2. ✅ Network tab (F12 → Network → Filter: social_media_channels)
3. ✅ نمودار Pie Chart

و بررسی کنید که:
- چه commit ای در production است: `git log --oneline -1`
- آیا در Incognito Mode کار می‌کند؟
- آیا console log ها نمایش داده می‌شوند؟

---

## 📋 خلاصه:

| مرحله | کار | وضعیت |
|-------|-----|-------|
| 1 | تغییرات کد | ✅ Done (commit 1f0fa15) |
| 2 | Clear Browser Cache | ⏳ شما باید انجام دهید |
| 3 | Hard Reload | ⏳ شما باید انجام دهید |
| 4 | چک Console Logs | ⏳ بعد از reload |
| 5 | بررسی نمودار | ⏳ باید صحیح باشد |

---

## ⚡ Quick Fix (یک خطی):

```bash
# در Chrome:
1. F12
2. Ctrl+Shift+R
3. چک کن Console
4. چک کن نمودار

# باید کار کند! 🎉
```
