# 🔍 راهنمای استفاده از ابزارهای Debugging

## 🎯 هدف

این سیستم برای تشخیص و عیب‌یابی مشکل **freeze** و **navigation** در اپلیکیشن طراحی شده است.

---

## ✅ ابزارهای نصب شده

### 1. **debugHelper** (`src/utils/debugHelper.ts`)
- لاگ کردن تمام عملیات مهم
- اندازه‌گیری Performance عملیات‌ها
- Export و آنالیز لاگ‌ها

### 2. **networkMonitor** (`src/utils/networkMonitor.ts`)
- رصد تمام Network Requests
- تشخیص Request Loops
- شناسایی Slow Requests

### 3. **useRenderTracker** (`src/hooks/useRenderTracker.ts`)
- شمارش Render های components
- تشخیص Excessive Renders
- هشدار برای Render Loops

### 4. **App.tsx - Memory Monitor**
- رصد Memory Usage هر 10 ثانیه
- هشدار برای High Memory Usage

---

## 🚀 نحوه استفاده

### مرحله 1: باز کردن Browser Console

در مرورگر Chrome/Firefox:
- `F12` یا `Ctrl+Shift+J` (Windows/Linux)
- `Cmd+Option+J` (Mac)

---

### مرحله 2: دستورات Console

#### 📊 نمایش آمار کلی

```javascript
// آمار Network
showNetworkStats()

// آمار Render
showRenderStats()

// آمار عملیات‌ها (Debug Helper)
debugHelper.getStats()
```

#### 🔍 مشاهده لاگ‌های اخیر

```javascript
// آخرین 50 لاگ
debugHelper.getRecentLogs(50)

// آخرین 100 لاگ
debugHelper.getRecentLogs(100)

// همه لاگ‌ها (تا 1000 تا)
debugHelper.logs
```

#### 💾 Export کردن لاگ‌ها

```javascript
// Export به JSON
const logs = debugHelper.exportLogs()
console.log(logs)

// کپی مستقیم به Clipboard
copy(debugHelper.exportLogs())
```

#### 🌐 بررسی Network Requests

```javascript
// Pending Requests (در حال اجرا)
networkMonitor.getPendingRequests()

// آخرین 20 Request
networkMonitor.getCompletedRequests(20)

// آمار کامل
networkMonitor.getStats()
```

#### 🔄 بررسی Component Renders

```javascript
// آمار Render همه components
renderTracker.getStats()

// نمایش در جدول
showRenderStats()
```

#### 🗑️ پاک کردن لاگ‌ها

```javascript
// پاک کردن Debug Logs
debugHelper.clearLogs()

// پاک کردن Network History
networkMonitor.clear()

// پاک کردن Render Stats
renderTracker.clear()
```

---

## 🧪 سناریوی تست

### 1️⃣ شروع تست

```javascript
// پاک کردن لاگ‌های قبلی
debugHelper.clearLogs()
networkMonitor.clear()
renderTracker.clear()

console.log('🧪 Test started at:', new Date().toLocaleTimeString())
```

### 2️⃣ منتظر بمانید 5 دقیقه

هر دقیقه این دستورات را اجرا کنید:

```javascript
// بررسی Memory
// (خودکار توسط App.tsx لاگ می‌شود - فقط console را نگاه کنید)

// بررسی Network
showNetworkStats()

// بررسی Renders
showRenderStats()
```

### 3️⃣ Navigation بین صفحات

**قبل از Navigation:**
```javascript
debugHelper.log('Test', 'Before Navigation - Dashboard to Posts')
```

*حالا به صفحه دیگری navigate کنید*

**بعد از Navigation:**
```javascript
debugHelper.log('Test', 'After Navigation - Posts loaded')
debugHelper.getRecentLogs(30)
```

### 4️⃣ Export نتایج

```javascript
// Export همه چیز
const report = {
  timestamp: new Date().toISOString(),
  debugLogs: JSON.parse(debugHelper.exportLogs()),
  networkStats: networkMonitor.getStats(),
  renderStats: renderTracker.getStats(),
  pendingRequests: networkMonitor.getPendingRequests()
}

// کپی به Clipboard
copy(JSON.stringify(report, null, 2))

// یا فقط لاگ‌ها
copy(debugHelper.exportLogs())
```

---

## 🚨 علائم مشکل

### ❌ Memory Leak

```
💾 [Memory] 150MB / 2048MB
💾 [Memory] 180MB / 2048MB
💾 [Memory] 210MB / 2048MB  ← بالا می‌رود
⚠️ [Memory] HIGH USAGE: 250MB
```

**راه حل:** بررسی کنید کدام component cleanup نمی‌کند

---

### ❌ Request Loop

```
🌐 [Network] POST /api/users - STARTED
🌐 [Network] POST /api/users - STARTED  ← تکراری
🌐 [Network] POST /api/users - STARTED  ← تکراری
```

**چک کنید:**
```javascript
// تعداد Pending Requests
networkMonitor.getPendingRequests().length  // اگر > 5 مشکل است

// آخرین requestها
networkMonitor.getCompletedRequests(10)
```

---

### ❌ Excessive Renders

```
🔄 [Dashboard] Render #15
🔄 [Dashboard] Render #16  ← خیلی زیاد
🔄 [Dashboard] Render #17
⚠️ [Render] Dashboard has rendered 20 times!
```

**چک کنید:**
```javascript
renderTracker.getStats()  // کدام component بیشترین render را دارد
```

---

### ❌ Duplicate fetchUserData

```
[AuthContext] fetchUserData START
[AuthContext] fetchUserData START  ← نباید تکرار شود
```

**چک کنید:**
```javascript
debugHelper.getRecentLogs(50).filter(log =>
  log.component === 'AuthContext' && log.action.includes('fetchUserData')
)
```

---

## 📈 تفسیر نتایج

### Memory Usage (عادی)
- **< 100MB**: عالی ✅
- **100-200MB**: خوب ✅
- **200-300MB**: قابل قبول ⚠️
- **> 300MB**: مشکل ❌

### Network Requests (عادی)
- **Pending**: معمولاً 0-2 (حداکثر 5)
- **Avg Duration**: < 1000ms
- **Failed**: 0

### Component Renders (عادی)
- **Initial Load**: 2-5 renders
- **After Navigation**: 3-7 renders
- **> 20 renders**: مشکل احتمالی ❌

---

## 🎯 چیزهایی که باید دنبال کنید

1. **Memory Leak**
   - آیا memory مدام بالا می‌رود؟
   - آیا بعد از navigation حافظه آزاد می‌شود؟

2. **Request Loop**
   - آیا requestهای تکراری به یک endpoint می‌رود؟
   - آیا تعداد pending requests بالای 5 می‌رود؟

3. **Excessive Renders**
   - کدام component بیشترین render را دارد?
   - آیا componentها در loop render می‌شوند؟

4. **Slow Operations**
   - کدام عملیات بیش از 2-3 ثانیه طول می‌کشد?
   - آیا fetchUserData در هر navigation فراخوانی می‌شود?

---

## 💡 نکات مهم

1. **هر بار که مشکل رخ داد:**
   ```javascript
   debugHelper.log('Issue', 'Freeze detected')
   ```

2. **قبل از بستن browser:**
   ```javascript
   copy(debugHelper.exportLogs())
   ```

3. **اگر freeze شد:**
   - **نبندید** browser را
   - Console را باز کنید
   - لاگ‌ها را export کنید
   - Screenshot بگیرید

---

## 📞 ارسال نتایج

بعد از تست کامل، این موارد را ارسال کنید:

1. ✅ **لاگ‌های کامل:**
   ```javascript
   copy(debugHelper.exportLogs())
   ```

2. ✅ **آمار Network:**
   ```javascript
   copy(JSON.stringify(networkMonitor.getStats(), null, 2))
   ```

3. ✅ **آمار Render:**
   ```javascript
   copy(JSON.stringify(renderTracker.getStats(), null, 2))
   ```

4. ✅ **Screenshot از Console** در لحظه freeze

5. ✅ **توضیح دقیق:**
   - چه کاری انجام دادید؟
   - چقدر طول کشید تا freeze شود؟
   - در چه صفحه‌ای بودید؟

---

## 🔧 حل مشکلات رایج

### مشکل: "debugHelper is not defined"

**راه حل:**
1. Refresh کنید صفحه را
2. مطمئن شوید که App.tsx اجرا شده
3. چک کنید که import ها درست هستند

### مشکل: Console پر از لاگ شده

**راه حل:**
```javascript
// فیلتر کردن فقط لاگ‌های مهم
console.clear()
debugHelper.getRecentLogs(20)
```

### مشکل: نمی‌توانم لاگ‌ها را export کنم

**راه حل:**
```javascript
// در console بزنید:
const logs = debugHelper.exportLogs()
console.log(logs)
// سپس manually کپی کنید
```

---

## 🎓 مثال‌های کاربردی

### مثال 1: تست Navigation

```javascript
// 1. شروع
debugHelper.clearLogs()

// 2. قبل از navigation
debugHelper.log('Test', 'Starting navigation to Posts page')

// 3. Navigate به صفحه Posts

// 4. بعد از navigation
debugHelper.log('Test', 'Posts page loaded')

// 5. چک کردن
debugHelper.getRecentLogs(20)
showNetworkStats()
```

### مثال 2: بررسی Memory Leak

```javascript
// 1. ثبت Memory اولیه
const initialMem = performance.memory.usedJSHeapSize / 1048576
console.log('Initial Memory:', initialMem, 'MB')

// 2. منتظر بمانید 5 دقیقه

// 3. چک مجدد
const finalMem = performance.memory.usedJSHeapSize / 1048576
console.log('Final Memory:', finalMem, 'MB')
console.log('Increase:', finalMem - initialMem, 'MB')
```

### مثال 3: پیدا کردن Request Loop

```javascript
// چک کردن آخرین 20 request
const requests = networkMonitor.getCompletedRequests(20)

// گروه‌بندی بر اساس URL
const grouped = requests.reduce((acc, req) => {
  acc[req.url] = (acc[req.url] || 0) + 1
  return acc
}, {})

console.table(grouped)
// اگر یک URL بیش از 5 بار تکرار شده، مشکل است
```

---

با این ابزارها می‌توانیم دقیقاً علت مشکل freeze را پیدا کنیم! 🎯

در صورت بروز هر مشکلی در استفاده، لطفاً لاگ‌های console را ارسال کنید.
