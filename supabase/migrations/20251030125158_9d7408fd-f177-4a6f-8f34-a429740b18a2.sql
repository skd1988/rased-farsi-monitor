-- Create posts table for media monitoring
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  contents TEXT,
  author TEXT,
  article_url TEXT,
  source TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'فارسی',
  status TEXT NOT NULL DEFAULT 'جدید',
  keywords TEXT[] DEFAULT '{}',
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view all posts" 
ON public.posts 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert posts" 
ON public.posts 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update posts" 
ON public.posts 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete posts" 
ON public.posts 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create indexes for better query performance
CREATE INDEX idx_posts_source ON public.posts(source);
CREATE INDEX idx_posts_language ON public.posts(language);
CREATE INDEX idx_posts_status ON public.posts(status);
CREATE INDEX idx_posts_published_at ON public.posts(published_at DESC);
CREATE INDEX idx_posts_keywords ON public.posts USING GIN(keywords);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.update_posts_updated_at();

-- Insert mock data
INSERT INTO public.posts (title, contents, author, article_url, source, language, status, keywords, published_at)
SELECT 
  CASE 
    WHEN i % 10 = 0 THEN 'تحلیل جنگ روانی در رسانه‌های غربی علیه محور مقاومت'
    WHEN i % 10 = 1 THEN 'گزارش الجزیره از تحولات منطقه و واکنش‌های بین‌المللی'
    WHEN i % 10 = 2 THEN 'ایسنا: بررسی شبهات مطرح شده در فضای مجازی'
    WHEN i % 10 = 3 THEN 'کمپین جدید رسانه‌ای برای اتهام‌زنی به کشورهای منطقه'
    WHEN i % 10 = 4 THEN 'Analysis of media bias in Middle East coverage'
    WHEN i % 10 = 5 THEN 'مهر: گزارش تحلیلی از وضعیت رسانه‌ای منطقه'
    WHEN i % 10 = 6 THEN 'تحلیل محتوای شبکه‌های اجتماعی و تاثیر آن بر افکار عمومی'
    WHEN i % 10 = 7 THEN 'تقرير الجزيرة عن التطورات الإقليمية والحرب النفسية'
    WHEN i % 10 = 8 THEN 'BBC Persian coverage and its impact on public opinion'
    ELSE 'فارس: بررسی روند‌های رسانه‌ای و کمپین‌های اتهام‌زنی'
  END,
  'محتوای کامل این مطلب شامل تحلیل‌های جامع از وضعیت رسانه‌ای، بررسی جنگ روانی، و ارزیابی کمپین‌های اطلاع‌رسانی در منطقه می‌باشد. این گزارش با استفاده از منابع متعدد و تحلیل داده‌های جمع‌آوری شده تهیه شده است.',
  CASE 
    WHEN i % 5 = 0 THEN 'احمد محمدی'
    WHEN i % 5 = 1 THEN 'محمد کریمی'
    WHEN i % 5 = 2 THEN 'John Smith'
    WHEN i % 5 = 3 THEN 'علی رضایی'
    ELSE 'Sarah Johnson'
  END,
  'https://example.com/article/' || i,
  CASE 
    WHEN i % 9 = 0 THEN 'الجزیرة'
    WHEN i % 9 = 1 THEN 'ایسنا'
    WHEN i % 9 = 2 THEN 'مهر'
    WHEN i % 9 = 3 THEN 'تسنیم'
    WHEN i % 9 = 4 THEN 'فارس'
    WHEN i % 9 = 5 THEN 'ایرنا'
    WHEN i % 9 = 6 THEN 'RT Arabic'
    WHEN i % 9 = 7 THEN 'BBC Persian'
    ELSE 'نامشخص'
  END,
  CASE 
    WHEN i % 3 = 0 THEN 'فارسی'
    WHEN i % 3 = 1 THEN 'عربی'
    ELSE 'English'
  END,
  CASE 
    WHEN i % 4 = 0 THEN 'جدید'
    WHEN i % 4 = 1 THEN 'در حال تحلیل'
    WHEN i % 4 = 2 THEN 'تحلیل شده'
    ELSE 'آرشیو شده'
  END,
  CASE 
    WHEN i % 7 = 0 THEN ARRAY['جنگ روانی', 'محور مقاومت']
    WHEN i % 7 = 1 THEN ARRAY['اتهام', 'کمپین']
    WHEN i % 7 = 2 THEN ARRAY['شبهه', 'جنگ روانی']
    WHEN i % 7 = 3 THEN ARRAY['محور مقاومت', 'اتهام']
    WHEN i % 7 = 4 THEN ARRAY['کمپین']
    WHEN i % 7 = 5 THEN ARRAY['جنگ روانی', 'شبهه', 'اتهام']
    ELSE ARRAY['محور مقاومت']
  END,
  now() - (i || ' hours')::interval
FROM generate_series(1, 100) AS i;