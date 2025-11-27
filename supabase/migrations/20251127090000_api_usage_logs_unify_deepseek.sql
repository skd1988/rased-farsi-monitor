-- ===========================================
--  DeepSeek API Usage Normalization
--  هدف: یکپارچه‌سازی لاگ مصرف DeepSeek
--  با داشبورد رسمی (Input: 0.14$/M , Output: 0.28$/M)
-- ===========================================

-- 1) ایجاد جدول اگر از قبل وجود نداشته باشد
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'api_usage_logs'
  ) THEN
    CREATE TABLE public.api_usage_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),

      -- مشخصات کلی
      endpoint text,
      function_name text,
      model_used text NOT NULL DEFAULT 'deepseek-chat',
      post_id uuid,
      status text NOT NULL DEFAULT 'success',

      -- توکن‌ها
      input_tokens integer NOT NULL DEFAULT 0,
      output_tokens integer NOT NULL DEFAULT 0,
      total_tokens integer NOT NULL DEFAULT 0,

      -- هزینه‌ها (دلار)
      cost_input_usd numeric(12,6) NOT NULL DEFAULT 0,
      cost_output_usd numeric(12,6) NOT NULL DEFAULT 0,
      cost_usd numeric(12,6) NOT NULL DEFAULT 0,

      -- متفرقه
      response_time_ms integer,
      question text,
      meta jsonb
    );
  END IF;
END $$;

-- 2) اطمینان از وجود ستون‌های کلیدی (اگر جدول قبلاً ساخته شده باشد)
DO $$
BEGIN
  -- ستون‌های توکن
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_usage_logs' AND column_name = 'input_tokens'
  ) THEN
    ALTER TABLE public.api_usage_logs ADD COLUMN input_tokens integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_usage_logs' AND column_name = 'output_tokens'
  ) THEN
    ALTER TABLE public.api_usage_logs ADD COLUMN output_tokens integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_usage_logs' AND column_name = 'total_tokens'
  ) THEN
    ALTER TABLE public.api_usage_logs ADD COLUMN total_tokens integer NOT NULL DEFAULT 0;
  END IF;

  -- اگر قبلاً ستونی به نام tokens_used وجود داشته باشد، آن را به total_tokens هم‌تراز می‌کنیم
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_usage_logs' AND column_name = 'tokens_used'
  ) THEN
    UPDATE public.api_usage_logs
    SET total_tokens = COALESCE(total_tokens, 0) + COALESCE(tokens_used, 0)
    WHERE total_tokens = 0;

    -- می‌توانی در صورت تمایل بعداً ستون tokens_used را حذف کنی
    -- ALTER TABLE public.api_usage_logs DROP COLUMN tokens_used;
  END IF;

  -- ستون‌های هزینه
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_usage_logs' AND column_name = 'cost_input_usd'
  ) THEN
    ALTER TABLE public.api_usage_logs ADD COLUMN cost_input_usd numeric(12,6) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_usage_logs' AND column_name = 'cost_output_usd'
  ) THEN
    ALTER TABLE public.api_usage_logs ADD COLUMN cost_output_usd numeric(12,6) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_usage_logs' AND column_name = 'cost_usd'
  ) THEN
    ALTER TABLE public.api_usage_logs ADD COLUMN cost_usd numeric(12,6) NOT NULL DEFAULT 0;
  END IF;

  -- ستون‌های عمومی در صورت نیاز
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_usage_logs' AND column_name = 'model_used'
  ) THEN
    ALTER TABLE public.api_usage_logs ADD COLUMN model_used text NOT NULL DEFAULT 'deepseek-chat';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_usage_logs' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.api_usage_logs ADD COLUMN status text NOT NULL DEFAULT 'success';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_usage_logs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.api_usage_logs ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- 3) بازمحاسبه هزینه‌ها بر اساس قیمت رسمی DeepSeek
--    Input Tokens:  0.14$ / 1M
--    Output Tokens: 0.28$ / 1M
UPDATE public.api_usage_logs
SET
  cost_input_usd  = (COALESCE(input_tokens, 0) * 0.14) / 1000000.0,
  cost_output_usd = (COALESCE(output_tokens, 0) * 0.28) / 1000000.0,
  cost_usd        = ((COALESCE(input_tokens, 0) * 0.14) + (COALESCE(output_tokens, 0) * 0.28)) / 1000000.0;

-- 4) ایندکس‌ها برای کوئری‌های زمانی و آماری
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at
  ON public.api_usage_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_model_used
  ON public.api_usage_logs (model_used);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint
  ON public.api_usage_logs (endpoint);
