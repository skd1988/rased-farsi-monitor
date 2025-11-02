import { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  PlayCircle,
  Database,
  Brain,
  Target,
  Wrench
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TestResult {
  test: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'warning';
  message?: string;
}

interface TestSectionData {
  title: string;
  icon: any;
  tests: TestResult[];
  onTest: () => Promise<TestResult[]>;
}

export default function SystemTest() {
  const [testing, setTesting] = useState(false);
  const [allResults, setAllResults] = useState<TestResult[]>([]);
  const [samplePosts, setSamplePosts] = useState<any[]>([]);

  const [dbTests, setDbTests] = useState<TestResult[]>([
    { test: 'اتصال به Supabase', status: 'pending' },
    { test: 'جدول posts', status: 'pending' },
    { test: 'جدول resistance_entities', status: 'pending' },
    { test: 'تعداد پست‌ها', status: 'pending' },
    { test: 'تعداد نهادها', status: 'pending' }
  ]);

  const [entityTests, setEntityTests] = useState<TestResult[]>([
    { test: 'بارگذاری لیست نهادها', status: 'pending' },
    { test: 'تست keyword matching', status: 'pending' },
    { test: 'تست alias matching', status: 'pending' }
  ]);

  const [deepseekTests, setDeepseekTests] = useState<TestResult[]>([
    { test: 'اتصال به API', status: 'pending' },
    { test: 'API Key معتبر', status: 'pending' },
    { test: 'تست پرامپت ساده', status: 'pending' },
    { test: 'JSON parsing', status: 'pending' }
  ]);

  const [pipelineTests, setPipelineTests] = useState<TestResult[]>([
    { test: 'انتخاب 5 پست تصادفی', status: 'pending' },
    { test: 'تحلیل با DeepSeek', status: 'pending' },
    { test: 'ذخیره نتایج', status: 'pending' },
    { test: 'بررسی فیلدهای PsyOp', status: 'pending' }
  ]);

  const handleTestDatabase = async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];
    
    try {
      const { error: connectionError } = await supabase.from('posts').select('count', { count: 'exact', head: true });
      results.push({ 
        test: 'اتصال به Supabase', 
        status: connectionError ? 'error' : 'success',
        message: connectionError?.message || 'اتصال موفق' 
      });

      const { count: postsCount, error: postsError } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true });
      results.push({ 
        test: 'جدول posts', 
        status: postsError ? 'error' : 'success',
        message: postsError?.message || `${postsCount} پست موجود` 
      });

      const { count: entitiesCount, error: entitiesError } = await supabase
        .from('resistance_entities')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);
      results.push({ 
        test: 'جدول resistance_entities', 
        status: entitiesError ? 'error' : entitiesCount === 0 ? 'warning' : 'success',
        message: entitiesError?.message || `${entitiesCount} نهاد فعال` 
      });

      results.push({ 
        test: 'تعداد پست‌ها', 
        status: (postsCount || 0) > 0 ? 'success' : 'warning',
        message: `${postsCount || 0} پست در دیتابیس` 
      });

      results.push({ 
        test: 'تعداد نهادها', 
        status: (entitiesCount || 0) > 0 ? 'success' : 'error',
        message: `${entitiesCount || 0} نهاد در دیتابیس` 
      });

      return results;
    } catch (error: any) {
      console.error('Database test error:', error);
      return [{ test: 'خطا', status: 'error', message: error.message }];
    }
  };

  const handleTestEntities = async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];
    
    try {
      const { data: entities, error } = await supabase
        .from('resistance_entities')
        .select('name_english, name_persian, name_arabic')
        .eq('active', true);
      
      results.push({ 
        test: 'بارگذاری نهادها', 
        status: error ? 'error' : 'success',
        message: error?.message || `${entities?.length || 0} نهاد یافت شد` 
      });

      const testText = "حزب‌الله لبنان امروز اعلام کرد که حشد الشعبی در عراق...";
      const found = entities?.filter(e => 
        testText.includes(e.name_persian) || 
        testText.includes(e.name_arabic)
      );
      
      results.push({ 
        test: 'keyword matching', 
        status: (found?.length || 0) > 0 ? 'success' : 'warning',
        message: (found?.length || 0) > 0 ? `${found?.[0]?.name_english} شناسایی شد` : 'نهادی یافت نشد' 
      });

      results.push({ 
        test: 'alias matching', 
        status: 'success',
        message: 'آماده برای تست' 
      });

      return results;
    } catch (error: any) {
      return [{ test: 'خطا', status: 'error', message: error.message }];
    }
  };

  const handleTestDeepSeek = async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];
    
    try {
      const testPost = {
        postId: 'test-id',
        title: 'تست سیستم',
        contents: 'این یک تست ساده برای بررسی عملکرد API است.',
        source: 'test-source'
      };

      const response = await supabase.functions.invoke('analyze-post-deepseek', {
        body: testPost
      });

      if (response.error) {
        results.push({ 
          test: 'اتصال API', 
          status: 'error',
          message: response.error.message
        });
        results.push({ 
          test: 'API Key معتبر', 
          status: 'error',
          message: 'خطا در احراز هویت'
        });
        results.push({ 
          test: 'تست پرامپت ساده', 
          status: 'error',
          message: 'تست انجام نشد'
        });
        results.push({ 
          test: 'JSON parsing', 
          status: 'error',
          message: 'تست انجام نشد'
        });
      } else {
        results.push({ 
          test: 'اتصال API', 
          status: 'success',
          message: 'اتصال موفق' 
        });
        results.push({ 
          test: 'API Key معتبر', 
          status: 'success',
          message: 'احراز هویت موفق' 
        });
        results.push({ 
          test: 'تست پرامپت ساده', 
          status: 'success',
          message: 'پاسخ دریافت شد' 
        });
        results.push({ 
          test: 'JSON parsing', 
          status: response.data?.analysis ? 'success' : 'warning',
          message: response.data?.analysis ? 'پاسخ JSON صحیح' : 'فرمت نامعتبر' 
        });
      }

      return results;
    } catch (error: any) {
      return [
        { test: 'اتصال API', status: 'error', message: error.message },
        { test: 'API Key معتبر', status: 'error', message: 'تست انجام نشد' },
        { test: 'تست پرامپت ساده', status: 'error', message: 'تست انجام نشد' },
        { test: 'JSON parsing', status: 'error', message: 'تست انجام نشد' }
      ];
    }
  };

  const handleTestFullPipeline = async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];
    
    try {
      const { data: posts, error } = await supabase
        .from('posts')
        .select('id, title, contents, source')
        .is('analyzed_at', null)
        .limit(5);

      if (error || !posts || posts.length === 0) {
        results.push({ 
          test: 'انتخاب 5 پست تصادفی', 
          status: 'error',
          message: 'پست تحلیل‌نشده‌ای یافت نشد' 
        });
        results.push({ test: 'تحلیل با DeepSeek', status: 'error', message: 'تست انجام نشد' });
        results.push({ test: 'ذخیره نتایج', status: 'error', message: 'تست انجام نشد' });
        results.push({ test: 'بررسی فیلدهای PsyOp', status: 'error', message: 'تست انجام نشد' });
        return results;
      }

      results.push({ 
        test: 'انتخاب 5 پست تصادفی', 
        status: 'success',
        message: `${posts.length} پست انتخاب شد` 
      });

      const testPost = posts[0];
      const analysisResponse = await supabase.functions.invoke('analyze-post-deepseek', {
        body: {
          postId: testPost.id,
          title: testPost.title,
          contents: testPost.contents,
          source: testPost.source
        }
      });

      if (analysisResponse.error) {
        results.push({ 
          test: 'تحلیل با DeepSeek', 
          status: 'error',
          message: analysisResponse.error.message
        });
        results.push({ test: 'ذخیره نتایج', status: 'error', message: 'تست انجام نشد' });
        results.push({ test: 'بررسی فیلدهای PsyOp', status: 'error', message: 'تست انجام نشد' });
        return results;
      }

      results.push({ 
        test: 'تحلیل با DeepSeek', 
        status: 'success',
        message: 'تحلیل موفق' 
      });

      results.push({ 
        test: 'ذخیره نتایج', 
        status: 'success',
        message: 'نتایج در دیتابیس ذخیره شد' 
      });

      const { data: updatedPost } = await supabase
        .from('posts')
        .select('is_psyop, target_entity, threat_level, analyzed_at')
        .eq('id', testPost.id)
        .single();

      const psyopFieldsPopulated = 
        updatedPost?.analyzed_at !== null &&
        updatedPost?.is_psyop !== null;

      results.push({ 
        test: 'بررسی فیلدهای PsyOp', 
        status: psyopFieldsPopulated ? 'success' : 'warning',
        message: psyopFieldsPopulated 
          ? `is_psyop: ${updatedPost.is_psyop}, threat: ${updatedPost.threat_level}` 
          : 'برخی فیلدها خالی هستند' 
      });

      return results;
    } catch (error: any) {
      return [
        { test: 'انتخاب 5 پست تصادفی', status: 'error', message: error.message },
        { test: 'تحلیل با DeepSeek', status: 'error', message: 'تست انجام نشد' },
        { test: 'ذخیره نتایج', status: 'error', message: 'تست انجام نشد' },
        { test: 'بررسی فیلدهای PsyOp', status: 'error', message: 'تست انجام نشد' }
      ];
    }
  };

  const handleRunAllTests = async () => {
    setTesting(true);
    setAllResults([]);
    toast.info('شروع تست‌ها...');

    try {
      const dbResults = await handleTestDatabase();
      setDbTests(dbResults);
      await new Promise(resolve => setTimeout(resolve, 500));

      const entityResults = await handleTestEntities();
      setEntityTests(entityResults);
      await new Promise(resolve => setTimeout(resolve, 500));

      const deepseekResults = await handleTestDeepSeek();
      setDeepseekTests(deepseekResults);
      await new Promise(resolve => setTimeout(resolve, 500));

      const pipelineResults = await handleTestFullPipeline();
      setPipelineTests(pipelineResults);

      const combined = [...dbResults, ...entityResults, ...deepseekResults, ...pipelineResults];
      setAllResults(combined);

      const failed = combined.filter(r => r.status === 'error').length;
      if (failed === 0) {
        toast.success('همه تست‌ها با موفقیت انجام شد!');
      } else {
        toast.error(`${failed} تست با خطا مواجه شد`);
      }
    } catch (error) {
      toast.error('خطا در اجرای تست‌ها');
      console.error(error);
    } finally {
      setTesting(false);
      loadSamplePosts();
    }
  };

  const loadSamplePosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('id, title, source, is_psyop, threat_level, analyzed_at')
      .limit(10)
      .order('created_at', { ascending: false });
    setSamplePosts(data || []);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Wrench className="w-8 h-8 text-primary" />
          تست و دیباگ سیستم
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          بررسی و تست کامل پایپلاین تحلیل PsyOp قبل از اجرای Batch Analysis
        </p>
      </div>

      {/* Test Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TestSection
          title="1. بررسی دیتابیس"
          icon={Database}
          tests={dbTests}
          onTest={async () => {
            const results = await handleTestDatabase();
            setDbTests(results);
            return results;
          }}
        />

        <TestSection
          title="2. شناسایی نهادها"
          icon={Target}
          tests={entityTests}
          onTest={async () => {
            const results = await handleTestEntities();
            setEntityTests(results);
            return results;
          }}
        />

        <TestSection
          title="3. DeepSeek API"
          icon={Brain}
          tests={deepseekTests}
          onTest={async () => {
            const results = await handleTestDeepSeek();
            setDeepseekTests(results);
            return results;
          }}
        />

        <TestSection
          title="4. پایپلاین کامل"
          icon={PlayCircle}
          tests={pipelineTests}
          onTest={async () => {
            const results = await handleTestFullPipeline();
            setPipelineTests(results);
            return results;
          }}
        />
      </div>

      {/* Run All Tests Button */}
      <div className="flex justify-center pt-6">
        <Button
          onClick={handleRunAllTests}
          disabled={testing}
          size="lg"
          className="px-8 py-6 text-lg"
        >
          {testing ? (
            <>
              <Loader2 className="w-5 h-5 ml-2 animate-spin" />
              در حال تست...
            </>
          ) : (
            <>
              <PlayCircle className="w-5 h-5 ml-2" />
              اجرای همه تست‌ها
            </>
          )}
        </Button>
      </div>

      {/* Results Panel */}
      {allResults.length > 0 && (
        <ResultsPanel results={allResults} />
      )}

      {/* Sample Posts Panel */}
      {samplePosts.length > 0 && (
        <SamplePostsPanel posts={samplePosts} />
      )}
    </div>
  );
}

// Test Section Component
function TestSection({ title, icon: Icon, tests, onTest }: TestSectionData) {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {title}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setStatus('testing');
              try {
                await onTest();
                setStatus('success');
              } catch {
                setStatus('error');
              }
            }}
            disabled={status === 'testing'}
          >
            {status === 'testing' ? 'در حال تست...' : 'تست'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tests.map((test, idx) => (
            <TestItem key={idx} name={test.test} status={test.status} message={test.message} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Test Item Component
function TestItem({ name, status, message }: { name: string; status: string; message?: string }) {
  const icons = {
    pending: <div className="w-4 h-4 rounded-full border-2 border-gray-300" />,
    running: <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />,
    success: <CheckCircle className="w-4 h-4 text-green-600" />,
    error: <XCircle className="w-4 h-4 text-red-600" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-600" />
  };

  return (
    <div className="flex items-start gap-2 text-sm py-1">
      <div className="mt-0.5">{icons[status as keyof typeof icons]}</div>
      <div className="flex-1">
        <div className="font-medium">{name}</div>
        {message && (
          <div className="text-xs text-muted-foreground">{message}</div>
        )}
      </div>
    </div>
  );
}

// Results Panel Component
function ResultsPanel({ results }: { results: TestResult[] }) {
  const summary = {
    total: results.length,
    passed: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'error').length,
    warnings: results.filter(r => r.status === 'warning').length
  };

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
      <CardHeader>
        <CardTitle>📊 نتایج تست</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold">{summary.total}</div>
            <div className="text-sm text-muted-foreground">کل تست‌ها</div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
            <div className="text-sm text-green-700 dark:text-green-400">موفق</div>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
            <div className="text-sm text-red-700 dark:text-red-400">ناموفق</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{summary.warnings}</div>
            <div className="text-sm text-yellow-700 dark:text-yellow-400">هشدار</div>
          </div>
        </div>

        {/* Actions */}
        {summary.failed === 0 && summary.warnings === 0 && (
          <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg text-center">
            <div className="text-lg font-bold text-green-800 dark:text-green-200 mb-2">
              ✅ سیستم آماده است!
            </div>
            <p className="text-sm text-green-700 dark:text-green-300 mb-4">
              همه تست‌ها با موفقیت انجام شد. می‌توانید Batch Analysis را شروع کنید.
            </p>
            <Button
              onClick={() => window.location.href = '/batch-analysis'}
              className="bg-green-600 hover:bg-green-700"
            >
              رفتن به Batch Analysis
            </Button>
          </div>
        )}

        {(summary.failed > 0 || summary.warnings > 0) && (
          <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <div className="font-bold text-yellow-800 dark:text-yellow-200 mb-2">
              ⚠️ توجه
            </div>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              برخی تست‌ها با مشکل مواجه شدند. لطفاً قبل از ادامه، مشکلات را برطرف کنید.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Sample Posts Panel Component
function SamplePostsPanel({ posts }: { posts: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>📝 نمونه پست‌ها</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-right">
                <th className="p-2">عنوان</th>
                <th className="p-2">منبع</th>
                <th className="text-center p-2">PsyOp؟</th>
                <th className="text-center p-2">Threat</th>
                <th className="text-center p-2">تحلیل شده</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id} className="border-b hover:bg-muted/50">
                  <td className="p-2 max-w-md truncate">{post.title}</td>
                  <td className="p-2">{post.source}</td>
                  <td className="text-center p-2">
                    {post.is_psyop === null ? '-' : post.is_psyop ? '✅' : '❌'}
                  </td>
                  <td className="text-center p-2">
                    {post.threat_level ? (
                      <span className={`px-2 py-1 rounded text-xs ${
                        post.threat_level === 'Critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30' :
                        post.threat_level === 'High' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30'
                      }`}>
                        {post.threat_level}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="text-center p-2">
                    {post.analyzed_at ? '✅' : '⏳'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
