# راهنمای اجرای Migrations برای رفع مشکلات چت

## مشکلات شناسایی شده:

1. ✅ نمایش داده‌های ساختاریافته (اصلاح شد در کد)
2. ✅ ایجاد گفتگوی جدید (اصلاح شد در کد)
3. ⚠️ گفتگوهای قدیمی بدون user_id (نیاز به migration دارد)
4. ⚠️ RLS Policy خیلی Permissive (نیاز به migration دارد)

## Migrations ساخته شده:

### 1. `20251109180000_assign_user_to_old_conversations.sql`
**هدف:** Assign کردن user_id به conversation های قدیمی که NULL دارند

```sql
-- این migration همه conversation های قدیمی رو به اولین کاربر سیستم assign می‌کنه
```

### 2. `20251109180100_fix_chat_conversations_select_policy.sql`
**هدف:** اصلاح RLS Policy برای امنیت بهتر

```sql
-- Policy قبلی: همه کاربران لاگین‌شده می‌تونستن همه conversation ها رو ببینن
-- Policy جدید: فقط conversation های خودت یا conversation های بدون user_id (قدیمی)
```

---

## نحوه اجرای Migrations:

### روش 1: استفاده از Supabase CLI (Local Development)

اگر از Supabase local استفاده می‌کنی:

```bash
# Reset کردن کل database (تمام migrations اجرا می‌شن)
supabase db reset

# یا فقط migration های جدید:
supabase migration up
```

### روش 2: Supabase Cloud Dashboard

اگر روی Supabase Cloud کار می‌کنی:

1. برو به **Supabase Dashboard**
2. انتخاب کن **Database** → **Migrations**
3. Migration های جدید رو manually اجرا کن
4. یا اگر CI/CD داری، migrations به صورت خودکار با deployment اجرا می‌شن

### روش 3: Manual Execution (اگر Supabase CLI نداری)

می‌تونی مستقیماً از SQL Editor در Supabase Dashboard استفاده کنی:

1. برو به **SQL Editor** در Supabase Dashboard
2. محتویات فایل `20251109180000_assign_user_to_old_conversations.sql` رو کپی کن
3. Paste و اجرا کن
4. همین کار رو برای `20251109180100_fix_chat_conversations_select_policy.sql` تکرار کن

---

## بررسی موفقیت‌آمیز بودن Migrations:

بعد از اجرای migrations:

1. **Console رو باز کن** (F12 در browser)
2. به صفحه **Chat** برو
3. چک کن که این log ها رو می‌بینی:

```
=== Loading conversations ===
Auth user: <user-id>
Loaded X conversations
```

اگه `Loaded 0 conversations` نشون داد، یعنی هنوز مشکل داره.

---

## Debugging

اگه بعد از اجرای migrations هنوز کار نکرد:

### 1. چک کن که migrations اجرا شدن:

```sql
-- در SQL Editor بزن:
SELECT * FROM supabase_migrations.schema_migrations
WHERE version IN ('20251109180000', '20251109180100');
```

### 2. چک کن که conversation ها user_id دارن:

```sql
-- تعداد conversation های بدون user_id:
SELECT COUNT(*) FROM chat_conversations WHERE user_id IS NULL;

-- باید 0 باشه!
```

### 3. چک کن که RLS Policy درست است:

```sql
-- لیست policy ها:
SELECT * FROM pg_policies WHERE tablename = 'chat_conversations';
```

### 4. Console Logs رو چک کن:

در browser console دنبال این errors بگرد:
- `Error loading conversations`
- `Error details: ...`

---

## تماس با پشتیبانی

اگه مشکل همچنان ادامه داره، این اطلاعات رو بفرست:

1. Console logs کامل
2. نتیجه query های debugging بالا
3. نسخه Supabase که استفاده می‌کنی (local یا cloud)

---

**تاریخ ایجاد:** 2025-11-09
**آخرین بروزرسانی:** 2025-11-09
