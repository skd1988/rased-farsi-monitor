import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, CheckSquare, Brain, Zap } from 'lucide-react';
import { toPersianNumber } from '@/lib/utils';
import { formatPersianDateTime } from '@/lib/dateUtils';

interface BulkAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const BulkAnalysisModal = ({ open, onClose, onComplete }: BulkAnalysisModalProps) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    quickDetections: 0,
    deepAnalyses: 0,
    failed: 0,
    recentActivity: [] as any[]
  });
  const [batchResults, setBatchResults] = useState<any>(null);
  const [showManualSelection, setShowManualSelection] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const intervalRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchUnanalyzedPosts();
      setShowManualSelection(false);
      setSelectedPosts(new Set());
      setStatus('idle');
      setProgress({
        current: 0,
        total: 0,
        quickDetections: 0,
        deepAnalyses: 0,
        failed: 0,
        recentActivity: []
      });
      setBatchResults(null);
    }
  }, [open]);

  // Real-time progress polling
  useEffect(() => {
    if (status === 'running') {
      const pollInterval = setInterval(async () => {
        await fetchProgress();
      }, 2000); // Poll every 2 seconds
      
      intervalRef.current = pollInterval;
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [status, startTime]);

  const fetchUnanalyzedPosts = async () => {
    try {
      let allPosts: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      // Fetch all unanalyzed posts in batches of 1000 to bypass Supabase's default limit
      while (hasMore) {
        const { data, error } = await supabase
          .from('posts')
          .select('id, title, contents, published_at, source')
          .is('analyzed_at', null)
          .order('published_at', { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allPosts = [...allPosts, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      setPosts(allPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: 'خطا در بارگذاری مطالب',
        description: 'لطفا دوباره تلاش کنید',
        variant: 'destructive',
      });
    }
  };

  const togglePost = (postId: string) => {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(postId)) {
      newSelected.delete(postId);
    } else {
      newSelected.add(postId);
    }
    setSelectedPosts(newSelected);
  };

  const selectAll = () => {
    if (selectedPosts.size === posts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(posts.map(p => p.id)));
    }
  };

  // Fetch real-time progress from database
  const fetchProgress = async () => {
    if (!startTime) return;
    
    try {
      const startTimeISO = new Date(startTime).toISOString();
      
      const { data: analyzed, error } = await supabase
        .from('posts')
        .select('id, title, analysis_stage, analyzed_at, is_psyop')
        .gte('analyzed_at', startTimeISO)
        .order('analyzed_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      if (analyzed && analyzed.length > 0) {
        const quickCount = analyzed.filter(p => p.analysis_stage === 'quick').length;
        const deepCount = analyzed.filter(p => p.analysis_stage === 'deep').length;
        
        setProgress(prev => ({
          ...prev,
          current: analyzed.length,
          quickDetections: quickCount,
          deepAnalyses: deepCount,
          recentActivity: analyzed.slice(0, 5).map(p => ({
            title: p.title,
            stage: p.analysis_stage,
            isPsyop: p.is_psyop,
            time: formatPersianDateTime(p.analyzed_at)
          }))
        }));
      }
      
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    }
  };

  const analyzeSelected = async (postsToAnalyze: any[]) => {
    if (postsToAnalyze.length === 0) {
      toast({
        title: 'هیچ مطلبی انتخاب نشده',
        description: 'لطفا حداقل یک مطلب را انتخاب کنید',
        variant: 'destructive',
      });
      return;
    }

    setStatus('running');
    setStartTime(Date.now());
    setProgress({
      current: 0,
      total: postsToAnalyze.length,
      quickDetections: 0,
      deepAnalyses: 0,
      failed: 0,
      recentActivity: []
    });
    setBatchResults(null);

    try {
      console.log(`🚀 Starting two-stage batch analysis for ${postsToAnalyze.length} posts`);
      
      const response = await supabase.functions.invoke('batch-analyze-posts', {
        body: {
          limit: postsToAnalyze.length === posts.length ? null : postsToAnalyze.length,
          batchSize: 10
        }
      });

      if (response.error) {
        console.error('❌ Batch analysis error:', response.error);
        throw response.error;
      }
      
      if (!response.data || !response.data.success) {
        console.error('❌ Invalid response structure:', response.data);
        throw new Error(response.data?.error || 'Batch analysis failed');
      }
      
      const batchData = response.data.results;
      
      // Stop polling
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Set final results
      setBatchResults(batchData);
      setStatus('completed');
      
      console.log('✅ Batch analysis completed:', batchData);
      
      const improvement = Math.round((batchData.time_saved_ms / batchData.estimated_old_time_ms) * 100);
      
      toast({
        title: '✅ تحلیل گروهی تکمیل شد',
        description: `${batchData.total} مطلب در ${toPersianNumber((batchData.processing_time_ms / 1000).toFixed(1))} ثانیه | ${toPersianNumber(improvement)}% سریع‌تر`,
      });
      
      // Call onComplete but DON'T close modal - let user close manually
      onComplete();

    } catch (error) {
      console.error('❌ Error in batch analysis:', error);
      setStatus('error');
      
      // Stop polling on error
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      toast({
        title: 'خطا در تحلیل گروهی',
        description: error instanceof Error ? error.message : 'خطای ناشناخته',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    if (status === 'running') {
      const confirmed = confirm('تحلیل در حال انجام است. آیا مطمئن هستید؟');
      if (!confirmed) return;
      
      // Stop polling
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    
    onClose();
  };

  const calculateRemainingTime = (): number => {
    const remaining = progress.total - progress.current;
    const avgTime = 2.5; // seconds per post average
    const totalSeconds = Math.round(remaining * avgTime);
    const minutes = Math.ceil(totalSeconds / 60); // Convert to minutes
    return minutes;
  };

  const calculateProgress = (): number => {
    if (progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const handleAnalyzeAll = () => {
    analyzeSelected(posts);
  };

  const handleAnalyzeLast10 = () => {
    const last10 = posts.slice(0, 10);
    analyzeSelected(last10);
  };

  const handleManualSelection = () => {
    setShowManualSelection(true);
  };

  const handleStartManualAnalysis = () => {
    const selected = posts.filter(p => selectedPosts.has(p.id));
    analyzeSelected(selected);
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        if (!isOpen && status !== 'running') {
          handleClose();
        }
      }}
    >
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl">تحلیل گروهی مطالب</DialogTitle>
          <DialogDescription>
            {status === 'running'
              ? `در حال تحلیل: ${toPersianNumber(progress.current)} از ${toPersianNumber(progress.total)}`
              : status === 'completed'
              ? 'تحلیل با موفقیت تکمیل شد'
              : `${toPersianNumber(posts.length)} مطلب تحلیل نشده یافت شد`
            }
          </DialogDescription>
        </DialogHeader>

        {status === 'running' ? (
          <div className="space-y-6 py-6">
            {/* Progress Header */}
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold">در حال پردازش...</div>
              <div className="text-sm text-muted-foreground">
                {toPersianNumber(progress.current)} از {toPersianNumber(progress.total)} ({toPersianNumber(calculateProgress())}%)
              </div>
            </div>

            {/* Progress Bar */}
            <Progress value={calculateProgress()} className="w-full h-3" />

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">مرحله اول</div>
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {toPersianNumber(progress.quickDetections)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">غربالگری سریع</div>
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">مرحله دوم</div>
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                    {toPersianNumber(progress.deepAnalyses)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">تحلیل عمیق</div>
                </CardContent>
              </Card>

              <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">تکمیل شده</div>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {toPersianNumber(progress.current)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">موفق</div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            {progress.recentActivity.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-3">فعالیت‌های اخیر:</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {progress.recentActivity.map((activity, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center gap-2 text-xs p-3 bg-muted rounded border"
                      >
                        {activity.stage === 'quick' ? (
                          <Zap className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        ) : (
                          <Brain className="w-4 h-4 text-red-600 flex-shrink-0" />
                        )}
                        <span className="flex-1 truncate font-medium">{activity.title}</span>
                        <span className="text-muted-foreground flex-shrink-0">{activity.time}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Estimated Time */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 bg-muted/50 p-4 rounded-lg">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <div className="font-medium">در حال اجرا...</div>
                  <div className="text-sm text-muted-foreground">
                    زمان تخمینی باقیمانده: {toPersianNumber(calculateRemainingTime())} دقیقه
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : status === 'completed' && batchResults ? (
          <div className="space-y-6 py-6">
            {/* Success Header */}
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">
                تحلیل با موفقیت تکمیل شد! 🎉
              </h2>
              <p className="text-muted-foreground">
                {toPersianNumber(batchResults.total)} مطلب در {toPersianNumber((batchResults.processing_time_ms / 1000).toFixed(1))} ثانیه
              </p>
            </div>

            {/* Results Summary */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                    {toPersianNumber(batchResults.quick_only)}
                  </div>
                  <div className="text-sm font-medium">تحلیل سریع</div>
                  <div className="text-xs text-muted-foreground mt-1">خبر عادی</div>
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-red-600 dark:text-red-400 mb-2">
                    {toPersianNumber(batchResults.deep_analyzed)}
                  </div>
                  <div className="text-sm font-medium">تحلیل عمیق</div>
                  <div className="text-xs text-muted-foreground mt-1">PsyOp شناسایی شده</div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Metrics */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-6">
                <h4 className="font-semibold mb-4 flex items-center gap-2 text-lg">
                  <span className="text-2xl">⚡</span>
                  مقایسه عملکرد
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">روش قبلی (تک‌مرحله‌ای):</span>
                    <span className="font-bold">{toPersianNumber((batchResults.estimated_old_time_ms / 1000).toFixed(1))} ثانیه</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">روش جدید (دومرحله‌ای):</span>
                    <span className="font-bold">{toPersianNumber((batchResults.processing_time_ms / 1000).toFixed(1))} ثانیه</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t-2 border-primary/20">
                    <span className="font-bold text-green-600 dark:text-green-400 text-base">بهبود سرعت:</span>
                    <span className="font-bold text-green-600 dark:text-green-400 text-2xl">
                      {toPersianNumber(Math.round((batchResults.time_saved_ms / batchResults.estimated_old_time_ms) * 100))}% 🚀
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">صرفه‌جویی زمان:</span>
                    <span className="font-medium">{toPersianNumber((batchResults.time_saved_ms / 1000).toFixed(1))} ثانیه</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => window.location.href = '/psyop-detection'}
                variant="default"
                size="lg"
                className="flex-1"
              >
                مشاهده PsyOp های شناسایی شده
              </Button>
              <Button
                onClick={handleClose}
                variant="outline"
                size="lg"
                className="flex-1"
              >
                بستن
              </Button>
            </div>
          </div>
        ) : status === 'error' ? (
          <div className="text-center py-12">
            <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">خطا در تحلیل گروهی</h3>
            <p className="text-muted-foreground mb-6">لطفا دوباره تلاش کنید</p>
            <Button onClick={handleClose} variant="outline">
              بستن
            </Button>
          </div>
        ) : showManualSelection ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedPosts.size} مطلب انتخاب شده
              </p>
              <Button variant="ghost" size="sm" onClick={() => setShowManualSelection(false)}>
                بازگشت
              </Button>
            </div>

            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedPosts.size === posts.length && posts.length > 0}
                        onCheckedChange={selectAll}
                      />
                    </TableHead>
                    <TableHead>عنوان</TableHead>
                    <TableHead>منبع</TableHead>
                    <TableHead>تاریخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map(post => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPosts.has(post.id)}
                          onCheckedChange={() => togglePost(post.id)}
                        />
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="line-clamp-2 break-words">{post.title}</div>
                      </TableCell>
                      <TableCell>{post.source}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatPersianDateTime(post.published_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {posts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                همه مطالب قبلاً تحلیل شده‌اند
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button onClick={() => setShowManualSelection(false)} variant="outline">
                انصراف
              </Button>
              <Button 
                onClick={handleStartManualAnalysis} 
                disabled={selectedPosts.size === 0}
              >
                تحلیل ({selectedPosts.size})
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow hover:border-primary"
                onClick={handleAnalyzeAll}
              >
                <CardContent className="p-6 text-center space-y-3">
                  <div className="text-5xl">🤖</div>
                  <h3 className="font-bold text-lg">تحلیل همه مطالب جدید</h3>
                  <p className="text-sm text-muted-foreground">
                    تحلیل تمام مطالبی که هنوز تحلیل نشده‌اند
                  </p>
                  <div className="text-2xl font-bold text-primary">
                    {posts.length} مطلب
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow hover:border-primary"
                onClick={handleAnalyzeLast10}
              >
                <CardContent className="p-6 text-center space-y-3">
                  <div className="text-5xl">⚡</div>
                  <h3 className="font-bold text-lg">تحلیل 10 مطلب اخیر</h3>
                  <p className="text-sm text-muted-foreground">
                    تحلیل سریع آخرین مطالب
                  </p>
                  <div className="text-2xl font-bold text-primary">
                    {Math.min(posts.length, 10)} مطلب
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow hover:border-primary"
                onClick={handleManualSelection}
              >
                <CardContent className="p-6 text-center space-y-3">
                  <div className="text-5xl">✅</div>
                  <h3 className="font-bold text-lg">انتخاب دستی مطالب</h3>
                  <p className="text-sm text-muted-foreground">
                    خودتان مطالب را انتخاب کنید
                  </p>
                  <Button variant="outline" className="mt-2" asChild>
                    <div>
                      <CheckSquare className="ms-2 h-4 w-4" />
                      انتخاب کنید
                    </div>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {posts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <div className="text-6xl mb-4">✨</div>
                <h3 className="text-xl font-semibold mb-2">همه مطالب تحلیل شده‌اند!</h3>
                <p className="text-sm">هیچ مطلب تحلیل نشده‌ای وجود ندارد</p>
              </div>
            )}

            <DialogFooter>
              <Button onClick={onClose} variant="outline">
                بستن
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BulkAnalysisModal;