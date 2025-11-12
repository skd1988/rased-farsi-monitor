# 🔧 راهنمای رفع مشکل Cache در Channel Analytics

## مشکل:
UI هنوز platform = "Other" نمایش می‌دهد در حالی که database صحیح است (Facebook, Telegram, YouTube)

## تغییرات اعمال شده:
✅ Logging کامل اضافه شد
✅ .limit(1000) برای جلوگیری از cache
✅ Platform distribution در console
✅ Error tracking بهبود یافت

---

## 🧪 مراحل تست و رفع مشکل:

### مرحله 1: Clear Browser Cache

#### روش A: در Chrome/Edge
1. باز کن Developer Tools: `F12` یا `Ctrl+Shift+I`
2. کلیک راست روی دکمه Reload
3. انتخاب: **"Empty Cache and Hard Reload"**

#### روش B: Clear Site Data
1. باز کن Developer Tools: `F12`
2. برو به tab **Application**
3. از منوی چپ، **Clear storage** را انتخاب کن
4. کلیک کن: **"Clear site data"**
5. صفحه را Reload کن

#### روش C: Incognito Mode
1. باز کن Incognito/Private Window: `Ctrl+Shift+N`
2. برو به صفحه Channel Analytics
3. چک کن که platform ها صحیح نمایش داده می‌شوند

---

### مرحله 2: بررسی Console Logs

بعد از باز کردن صفحه، در Console باید ببینی:

```
🔄 Channel Analytics mounted at: 2025-11-12T15:03:29.123Z
📡 Fetching channels from social_media_channels table...
📊 Received channels: {
  total: 15,
  platforms: {
    "Telegram": 8,
    "Facebook": 3,
    "YouTube": 2,
    "Twitter": 1,
    "Other": 1
  },
  first3: [
    { name: "BBC Persian", platform: "Facebook" },
    { name: "الجزیرة", platform: "Telegram" },
    { name: "Sky News", platform: "YouTube" }
  ]
}
✅ Channels loaded successfully: 15
```

---

### مرحله 3: اگر هنوز "Other" می‌بینی

#### چک کن که آیا داده از DB درست می‌آید:

1. باز کن Console
2. اگر در لاگ `platforms` می‌بینی که همه "Other" هستند:
   ```javascript
   platforms: { "Other": 15 }  ← مشکل در database است
   ```

   👉 **راه‌حل:** SQL query fix را دوباره در Supabase اجرا کن

3. اگر در لاگ `platforms` صحیح است اما UI "Other" نمایش می‌دهد:
   ```javascript
   platforms: { "Telegram": 8, "Facebook": 3 }  ← database درست است
   ```

   👉 **راه‌حل:** مشکل در render است، Supabase Realtime را چک کن

---

### مرحله 4: Force Rebuild

اگر هیچ کدام کار نکرد:

```bash
# حذف node_modules و rebuild
rm -rf node_modules
rm -rf .next
npm install
npm run build
```

---

## 🔍 Troubleshooting

### خطای "Error fetching channels"
```
❌ Error fetching channels: { message: "..." }
```
- چک کن که Supabase connection کار می‌کند
- چک کن که جدول social_media_channels وجود دارد
- چک کن که RLS policies صحیح است

### Platform ها null هستند
```javascript
platforms: { "null": 15 }
```
- SQL query fix را اجرا نکرده‌ای
- برو به Supabase SQL Editor
- Query fix را از فایل migration اجرا کن

### Platform ها mixed هستند
```javascript
platforms: { "Other": 5, "Telegram": 3, "Facebook": 7 }
```
- بعضی رکوردها به‌روز نشده‌اند
- SQL query را با WHERE platform = 'Other' دوباره اجرا کن

---

## ✅ نتیجه مورد انتظار:

بعد از clear cache باید ببینی:

- **Pie Chart**: Facebook (3), Telegram (8), YouTube (2), Twitter (1)
- **Table**: ستون Platform با مقادیر صحیح
- **Filter**: dropdown platform کار می‌کند
- **Console**: لاگ های کامل با emoji ها

---

## 📞 اگر هنوز مشکل دارید:

1. Screenshot از Console را بگیرید
2. Screenshot از Network tab (filter: social_media_channels)
3. بررسی کنید که کدام commit در production است:
   ```bash
   git log --oneline -1
   ```
