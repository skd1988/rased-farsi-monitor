// Mock data generator for 100 realistic posts
export interface RawPost {
  date: string;
  title: string;
  contents: string;
  author: string;
  articleURL: string;
}

export interface EnrichedPost extends RawPost {
  id: string;
  source: string;
  sourceURL?: string;
  language: string;
  status: string;
  keywords: string[];
  source_country?: string | null;
  psyop_risk_score?: number | null;
  threat_level?: string | null;
  sentiment?: string | null;
  stance_type?: string | null;
  psyop_category?: string | null;
  psyop_techniques?: string[] | null;
}

// Utility functions for data derivation
export function deriveSource(articleURL: string): string {
  try {
    const url = new URL(articleURL);
    const hostname = url.hostname.replace('www.', '');
    
    const sourceMap: Record<string, string> = {
      'aljazeera.net': 'الجزیرة',
      'isna.ir': 'ایسنا',
      'mehrnews.com': 'مهر',
      'tasnimnews.com': 'تسنیم',
      'farsnews.ir': 'فارس',
      'irna.ir': 'ایرنا',
      'rt.com': 'RT Arabic',
      'bbc.com': 'BBC Persian',
      'presstv.ir': 'Press TV',
      'tehrantimes.com': 'Tehran Times',
    };
    
    return sourceMap[hostname] || 'نامشخص';
  } catch {
    return 'نامشخص';
  }
}

export function detectLanguage(contents: string): string {
  if (!contents) return 'English';
  
  // Persian-specific characters
  const persianChars = /[پچژگ]/;
  // Arabic-specific characters  
  const arabicChars = /[\u0600-\u06FF]/;
  
  if (persianChars.test(contents)) return 'فارسی';
  if (arabicChars.test(contents)) return 'عربی';
  return 'English';
}

export function extractKeywords(contents: string): string[] {
  if (!contents) return [];
  
  const keywords = [
    'جنگ روانی',
    'جنگ‌روانی',
    'محور مقاومت',
    'محور‌مقاومت',
    'اتهام',
    'متهم',
    'شبهه',
    'شبهات',
    'کمپین',
    'کمپین‌های',
  ];
  
  return keywords.filter(kw => contents.includes(kw));
}

export function enrichPost(post: RawPost, id: string): EnrichedPost {
  return {
    ...post,
    id,
    source: deriveSource(post.articleURL),
    language: detectLanguage(post.contents),
    status: 'جدید',
    keywords: extractKeywords(post.contents),
  };
}

// Generate 100 mock posts
function generateMockPosts(): RawPost[] {
  const posts: RawPost[] = [];
  const now = new Date();
  
  const persianTitles = [
    'تحولات جدید در عراق و واکنش محور مقاومت به تحریم‌های اخیر',
    'کمپین جدید رسانه‌ای علیه حشد شعبی و نیروهای مقاومت',
    'اتهامات بی‌اساس غرب علیه ایران در خصوص دخالت در منطقه',
    'جنگ روانی رسانه‌های غربی علیه محور مقاومت تشدید شد',
    'واکنش مقامات عراقی به شبهات مطرح شده درباره حشد شعبی',
    'تحلیل کارشناسان: جنگ‌روانی جدید علیه محور مقاومت',
    'کمپین‌های رسانه‌ای غرب برای تضعیف جایگاه محور مقاومت',
    'متهم کردن ایران بدون ارائه مدرک از سوی رسانه‌های غربی',
  ];
  
  const arabicTitles = [
    'الجزيرة: اتهامات جديدة ضد الحشد الشعبي في العراق',
    'تطورات جديدة في المنطقة ومحور المقاومة يرد على الاتهامات',
    'حملة إعلامية جديدة ضد قوات الحشد الشعبي',
    'الحرب النفسية الإعلامية ضد محور المقاومة تتصاعد',
    'مسؤولون عراقيون يردون على الشبهات حول الحشد الشعبي',
    'تحليل: الحرب النفسية الجديدة ضد محور المقاومة',
    'حملات إعلامية غربية لإضعاف محور المقاومة',
    'اتهام إيران دون تقديم أدلة من قبل وسائل الإعلام الغربية',
  ];
  
  const englishTitles = [
    'Iran denies involvement in recent regional attacks',
    'New developments in Iraq resistance axis response',
    'Media campaign against Iraqi Popular Mobilization Forces',
    'Western media psychological warfare against resistance axis',
    'Iraqi officials respond to allegations about PMF',
    'Analysis: New psychological warfare against resistance',
    'Western media campaigns to weaken resistance axis',
    'Accusations against Iran without evidence by Western media',
  ];
  
  const persianContents = [
    'در پی تحولات اخیر منطقه، محور مقاومت موضع خود را در قبال اتهامات مطرح شده از سوی رسانه‌های غربی تشریح کرد. کارشناسان معتقدند که این اتهامات بخشی از یک کمپین جنگ روانی گسترده علیه نیروهای مقاومت در منطقه است.\n\nبر اساس گزارش‌های میدانی، این کمپین رسانه‌ای با هدف تضعیف جایگاه محور مقاومت در افکار عمومی منطقه طراحی شده است. متهم کردن کشورها و نیروهای مقاومت بدون ارائه مدرک معتبر از ویژگی‌های بارز این جنگ‌روانی است.\n\nمقامات عراقی نیز به این شبهات واکنش نشان داده و آن‌ها را بی‌اساس خواندند.',
    'گزارش‌های رسیده حاکی از آن است که رسانه‌های غربی کمپین گسترده‌ای را علیه حشد شعبی عراق آغاز کرده‌اند. این کمپین با استفاده از تکنیک‌های جنگ روانی سعی در ایجاد شبهه درباره عملکرد نیروهای مقاومت دارد.\n\nکارشناسان امنیتی معتقدند که هدف از این اتهامات، تضعیف محور مقاومت در منطقه است. متهم کردن این نیروها بدون ارائه شواهد قابل اعتماد نشان‌دهنده ماهیت جنگ‌روانی این کمپین‌هاست.',
  ];
  
  const arabicContents = [
    'في أعقاب التطورات الأخيرة في المنطقة، أوضح محور المقاومة موقفه من الاتهامات التي أثارتها وسائل الإعلام الغربية. يعتقد الخبراء أن هذه الاتهامات جزء من حملة حرب نفسية واسعة ضد قوات المقاومة في المنطقة.\n\nبحسب التقارير الميدانية، صممت هذه الحملة الإعلامية بهدف إضعاف مكانة محور المقاومة في الرأي العام الإقليمي. إن اتهام البلدان وقوات المقاومة دون تقديم أدلة موثوقة هو من السمات البارزة لهذه الحرب النفسية.\n\nكما رد المسؤولون العراقيون على هذه الشبهات ووصفوها بأنها لا أساس لها من الصحة.',
    'تشير التقارير الواردة إلى أن وسائل الإعلام الغربية قد بدأت حملة واسعة ضد الحشد الشعبي العراقي. تحاول هذه الحملة، باستخدام تقنيات الحرب النفسية، إثارة الشكوك حول أداء قوات المقاومة.\n\nيعتقد خبراء الأمن أن الهدف من هذه الاتهامات هو إضعاف محور المقاومة في المنطقة. إن اتهام هذه القوات دون تقديم أدلة موثوقة يدل على طبيعة الحرب النفسية لهذه الحملات.',
  ];
  
  const englishContents = [
    'Following recent developments in the region, the resistance axis has clarified its position regarding accusations made by Western media outlets. Experts believe these allegations are part of a widespread psychological warfare campaign against resistance forces in the region.\n\nAccording to field reports, this media campaign has been designed to weaken the position of the resistance axis in regional public opinion. Accusing countries and resistance forces without providing credible evidence is a prominent feature of this psychological warfare.\n\nIraqi officials have also responded to these suspicions and described them as baseless.',
    'Reports indicate that Western media have launched an extensive campaign against the Iraqi Popular Mobilization Forces. This campaign, using psychological warfare techniques, attempts to create doubts about the performance of resistance forces.\n\nSecurity experts believe that the purpose of these accusations is to weaken the resistance axis in the region. Accusing these forces without providing reliable evidence demonstrates the psychological warfare nature of these campaigns.',
  ];
  
  const persianAuthors = ['محمد رضایی', 'فاطمه احمدی', 'علی کریمی', 'زهرا موسوی', 'حسین نوری'];
  const arabicAuthors = ['أحمد الصدر', 'فاطمة الزهراء', 'محمد الحسيني', 'زينب العراقية', 'علي الموسوي'];
  const englishAuthors = ['John Smith', 'Sarah Johnson', 'Michael Brown', 'Emma Davis', 'David Wilson'];
  
  const sources = [
    { domain: 'aljazeera.net', path: 'news' },
    { domain: 'isna.ir', path: 'news' },
    { domain: 'mehrnews.com', path: 'news' },
    { domain: 'tasnimnews.com', path: 'fa/news' },
    { domain: 'farsnews.ir', path: 'news' },
    { domain: 'irna.ir', path: 'news' },
    { domain: 'rt.com', path: 'middle_east' },
    { domain: 'bbc.com', path: 'persian/articles' },
  ];
  
  for (let i = 0; i < 100; i++) {
    // More recent posts (last 7 days get 60% of posts)
    const daysAgo = i < 60 ? Math.floor(Math.random() * 7) : Math.floor(Math.random() * 30);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    
    // Determine language for this post
    const langChoice = Math.random();
    let title, content, author;
    
    if (langChoice < 0.4) {
      // Persian
      title = persianTitles[Math.floor(Math.random() * persianTitles.length)];
      content = persianContents[Math.floor(Math.random() * persianContents.length)];
      author = persianAuthors[Math.floor(Math.random() * persianAuthors.length)];
    } else if (langChoice < 0.7) {
      // Arabic
      title = arabicTitles[Math.floor(Math.random() * arabicTitles.length)];
      content = arabicContents[Math.floor(Math.random() * arabicContents.length)];
      author = arabicAuthors[Math.floor(Math.random() * arabicAuthors.length)];
    } else {
      // English
      title = englishTitles[Math.floor(Math.random() * englishTitles.length)];
      content = englishContents[Math.floor(Math.random() * englishContents.length)];
      author = englishAuthors[Math.floor(Math.random() * englishAuthors.length)];
    }
    
    const source = sources[Math.floor(Math.random() * sources.length)];
    const randomId = Math.floor(Math.random() * 10000000);
    
    posts.push({
      date: date.toISOString(),
      title,
      contents: content,
      author,
      articleURL: `https://www.${source.domain}/${source.path}/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${randomId}/`,
    });
  }
  
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Generate and enrich all posts
const rawPosts = generateMockPosts();
export const mockPosts: EnrichedPost[] = rawPosts.map((post, index) => 
  enrichPost(post, `post-${index + 1}`)
);
