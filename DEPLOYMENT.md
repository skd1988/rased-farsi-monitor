# Deployment Instructions

## Prerequisites

- Access to Supabase Dashboard
- Database admin privileges
- Git repository access
- Understanding of SQL migrations

## Step 1: Apply Database Migration

### Option A: Using Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **rased-farsi-monitor**
3. Navigate to **SQL Editor** (left sidebar)
4. Create a new query
5. Copy the entire contents of:
   ```
   supabase/migrations/20251108120000_optimize_login_with_user_details_function.sql
   ```
6. Paste into the SQL Editor
7. Click **RUN** button or press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac)
8. Verify you see success message: "Success. No rows returned"

### Option B: Using Supabase CLI

```bash
# Make sure you're in project directory
cd /path/to/rased-farsi-monitor

# Apply migration
supabase db push

# Or apply specific migration
supabase migration up --target 20251108120000
```

## Step 2: Test the Database Function

Run this test query in SQL Editor:

```sql
-- Replace 'YOUR-USER-ID-HERE' with an actual user UUID from your database
SELECT * FROM get_user_with_details('YOUR-USER-ID-HERE');
```

**Expected Result:**

Should return **1 row** with **4 columns**:

| Column | Type | Description |
|--------|------|-------------|
| `user_data` | JSONB | All user profile data (id, email, full_name, etc.) |
| `role_data` | TEXT | User role (super_admin, admin, analyst, viewer, guest) |
| `limits_data` | JSONB | Daily limits (ai_analysis, chat_messages, exports) |
| `usage_data` | JSONB | Today's usage counts (ai_analysis, chat_messages, exports) |

**Sample Output:**
```json
{
  "user_data": {
    "id": "uuid-here",
    "email": "user@example.com",
    "full_name": "John Doe",
    "status": "active",
    ...
  },
  "role_data": "admin",
  "limits_data": {
    "ai_analysis": 100,
    "chat_messages": 500,
    "exports": 50
  },
  "usage_data": {
    "ai_analysis": 5,
    "chat_messages": 23,
    "exports": 2,
    "usage_date": "2025-11-08"
  }
}
```

### Verify Function Permissions

Check that authenticated users can execute the function:

```sql
-- Should show 'authenticated' role has EXECUTE permission
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'get_user_with_details';
```

## Step 3: Merge Pull Request

1. Review all code changes in the PR
2. Ensure all checks pass (if you have CI/CD)
3. Get approval from team lead (if required)
4. Merge PR to `main` branch using GitHub UI
5. Verify merge was successful

```bash
# Or merge via command line
git checkout main
git merge claude/optimize-login-system-011CUvFXMrExss18RWvewnkL
git push origin main
```

## Step 4: Deploy Frontend

### If using Lovable (auto-deploy)
- Lovable automatically deploys from `main` branch
- Wait 2-5 minutes for deployment to complete
- Check deployment status in Lovable dashboard

### If using manual deployment
```bash
# Build the application
npm run build

# Deploy to your hosting platform
# (specific commands depend on your hosting provider)
```

## Step 5: Verify in Production

### 5.1 Clear Browser Cache

1. Open the application in browser
2. Open Developer Tools (`F12` or `Cmd+Option+I`)
3. Right-click refresh button → **Empty Cache and Hard Reload**
4. Or use keyboard: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)

### 5.2 Test Login Flow

1. Go to login page
2. Open **Console** tab in Developer Tools
3. Enter credentials and click login
4. Watch for these console logs in order:

```
[AuthContext] 🚀 fetchUserData START { email: "...", id: "...", retry: 0, skipSessionCheck: true }
[AuthContext] 📊 Calling get_user_with_details RPC...
[AuthContext] 📥 RPC Response: { hasData: true, dataType: "array", ... }
[AuthContext] ✅ User object created successfully { email: "...", role: "...", status: "active" }
```

### 5.3 Verify Performance

1. Open **Network** tab in Developer Tools
2. Login again (logout first if needed)
3. Filter by: `get_user_with_details`
4. Check response time - should be **<500ms**
5. Verify only **1 database call** is made (not 4)

### 5.4 Verify Functionality

Test these features:
- [ ] Login completes successfully
- [ ] User role is displayed correctly
- [ ] Dashboard loads with correct permissions
- [ ] Daily limits are shown in user profile
- [ ] Usage tracking works (try AI analysis or chat)
- [ ] Session timeout works (wait 8 hours or test manually)
- [ ] Logout works correctly
- [ ] Retry button works on loading screen

## Step 6: Monitor for Issues

### Check Application Logs

Monitor for errors in:
1. **Browser Console** - Frontend errors
2. **Supabase Logs** - Database errors
3. **Network Tab** - API failures

### Monitor Performance

Track these metrics:
- **Login duration** - Should be <1 second
- **Error rate** - Should not increase
- **User complaints** - Monitor support channels

### Set up Alerts (Optional)

```sql
-- Monitor function execution time
SELECT
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE query LIKE '%get_user_with_details%'
ORDER BY mean_exec_time DESC;
```

## Rollback Procedure

### If issues occur during deployment:

### 1. Rollback Frontend

**Option A: Revert Git Commits**
```bash
git checkout main
git revert 2a5be60  # Revert ProtectedRoute changes
git revert 8b40131  # Revert NewAuthContext changes
git push origin main
```

**Option B: Reset to Previous Commit**
```bash
git checkout main
git reset --hard HEAD~3  # Go back 3 commits
git push --force origin main  # Force push (use with caution!)
```

### 2. Rollback Database

Run in Supabase SQL Editor:

```sql
-- Remove the optimized function
DROP FUNCTION IF EXISTS get_user_with_details(UUID);

-- Verify it's removed
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'get_user_with_details';
-- Should return 0 rows
```

### 3. Verify Rollback

1. Clear browser cache
2. Test login - should work with old method
3. Check console logs - should NOT show emoji logs
4. Verify 4 separate database queries are made

## Troubleshooting

### Issue: Function doesn't exist

**Error:** `function get_user_with_details(uuid) does not exist`

**Solution:**
1. Re-run migration SQL
2. Verify function exists: `\df get_user_with_details` (psql)
3. Check function permissions

### Issue: Permission denied

**Error:** `permission denied for function get_user_with_details`

**Solution:**
```sql
GRANT EXECUTE ON FUNCTION get_user_with_details(UUID) TO authenticated;
```

### Issue: Login takes longer than expected

**Check:**
1. Database query performance
2. Network latency
3. Supabase region vs user location
4. Database indexes

**Debug:**
```sql
EXPLAIN ANALYZE
SELECT * FROM get_user_with_details('user-id-here');
```

### Issue: Data not returned correctly

**Check:**
1. User exists in `users` table
2. User has role in `user_roles` table
3. User has limits in `user_daily_limits` table
4. JSONB parsing in frontend

**Debug:**
```sql
-- Check user data directly
SELECT * FROM users WHERE id = 'user-id-here';
SELECT * FROM user_roles WHERE user_id = 'user-id-here';
SELECT * FROM user_daily_limits WHERE user_id = 'user-id-here';
SELECT * FROM user_daily_usage WHERE user_id = 'user-id-here' AND usage_date = CURRENT_DATE;
```

## Post-Deployment Checklist

- [ ] Migration applied successfully
- [ ] Function returns correct data
- [ ] Frontend deployed
- [ ] Login works in production
- [ ] Performance improved (<1s login)
- [ ] No errors in console
- [ ] All permissions work
- [ ] Session management works
- [ ] Team notified of changes
- [ ] Documentation updated
- [ ] Monitoring enabled

## Support

If you encounter issues:
1. Check this deployment guide
2. Review CHANGES.md for details
3. Check git commit history
4. Contact development team
5. Create issue in repository

## Notes

- **Backup recommendation:** Always backup database before migrations
- **Testing:** Test in development/staging environment first
- **Timing:** Deploy during low-traffic period if possible
- **Communication:** Notify users of expected downtime (if any)
- **Rollback plan:** Always have rollback plan ready
