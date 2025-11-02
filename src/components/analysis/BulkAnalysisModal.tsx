import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, CheckSquare } from 'lucide-react';
import { formatPersianDateTime } from '@/lib/dateUtils';

interface BulkAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const BulkAnalysisModal = ({ open, onClose, onComplete }: BulkAnalysisModalProps) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPost, setCurrentPost] = useState(0);
  const [currentPostTitle, setCurrentPostTitle] = useState('');
  const [results, setResults] = useState<Record<string, 'success' | 'error'>>({});
  const [showManualSelection, setShowManualSelection] = useState(false);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);
  const [batchResults, setBatchResults] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchUnanalyzedPosts();
      setShowManualSelection(false);
      setSelectedPosts(new Set());
      setIsAnalyzing(false);
      setProgress(0);
      setResults({});
    }
  }, [open]);

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

  const analyzeSelected = async (postsToAnalyze: any[]) => {
    if (postsToAnalyze.length === 0) {
      toast({
        title: 'هیچ مطلبی انتخاب نشده',
        description: 'لطفا حداقل یک مطلب را انتخاب کنید',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setCurrentPost(0);
    setResults({});
    setBatchResults(null);
    const total = postsToAnalyze.length;
    
    // New estimate: ~2 sec/post average (quick: 1s, deep: 4s, 70% quick only)
    setEstimatedTimeRemaining(Math.ceil(total * 2));

    try {
      console.log(`🚀 Starting two-stage batch analysis for ${total} posts`);
      
      const postIds = postsToAnalyze.map(p => p.id);
      
      const response = await supabase.functions.invoke('batch-analyze-posts', {
        body: {
          postIds: postIds,
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
      setBatchResults(batchData);
      
      console.log('✅ Batch analysis completed:', batchData);
      
      // Simulate progress updates during processing
      const updateInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) {
            clearInterval(updateInterval);
            return 95;
          }
          return prev + 5;
        });
      }, (batchData.processing_time_ms / 20));
      
      // Wait for completion
      setTimeout(() => {
        clearInterval(updateInterval);
        setProgress(100);
        setIsAnalyzing(false);
        
        const improvement = Math.round((batchData.time_saved_ms / batchData.estimated_old_time_ms) * 100);
        
        toast({
          title: '✅ تحلیل گروهی تکمیل شد',
          description: `${batchData.total} مطلب در ${(batchData.processing_time_ms / 1000).toFixed(1)} ثانیه | ${improvement}% سریع‌تر`,
        });

        setTimeout(() => {
          onComplete();
          onClose();
        }, 3000);
      }, 1000);

    } catch (error) {
      console.error('❌ Error in batch analysis:', error);
      setIsAnalyzing(false);
      
      toast({
        title: 'خطا در تحلیل گروهی',
        description: error instanceof Error ? error.message : 'خطای ناشناخته',
        variant: 'destructive',
      });
    }
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
        if (!isOpen && !isAnalyzing) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl">تحلیل گروهی مطالب</DialogTitle>
          <DialogDescription>
            {isAnalyzing
              ? `در حال تحلیل: ${currentPost} از ${posts.length}`
              : `${posts.length} مطلب تحلیل نشده یافت شد`
            }
          </DialogDescription>
        </DialogHeader>

        {isAnalyzing ? (
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>در حال پردازش...</span>
                <span>زمان تخمینی: {Math.ceil(estimatedTimeRemaining / 60)} دقیقه</span>
              </div>
              <Progress value={progress} className="w-full h-3" />
            </div>
            
            {batchResults && (
              <div className="grid grid-cols-3 gap-4 mt-6">
                <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {batchResults.quick_only}
                    </div>
                    <div className="text-sm font-medium mt-1">تحلیل سریع</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      پست‌های عادی
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {batchResults.deep_analyzed}
                    </div>
                    <div className="text-sm font-medium mt-1">تحلیل عمیق</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      PsyOp تأیید شده
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {batchResults.alerts_created}
                    </div>
                    <div className="text-sm font-medium mt-1">هشدار ایجاد شده</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      تهدید بالا/بحرانی
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {batchResults && (
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <span className="text-2xl">⚡</span>
                    مقایسه عملکرد
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">روش قبلی (تک‌مرحله‌ای):</span>
                      <span className="font-medium">{(batchResults.estimated_old_time_ms / 1000).toFixed(1)} ثانیه</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">روش جدید (دومرحله‌ای):</span>
                      <span className="font-medium">{(batchResults.processing_time_ms / 1000).toFixed(1)} ثانیه</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-semibold text-green-600 dark:text-green-400">بهبود سرعت:</span>
                      <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                        {Math.round((batchResults.time_saved_ms / batchResults.estimated_old_time_ms) * 100)}% سریع‌تر 🚀
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">صرفه‌جویی زمان:</span>
                      <span className="font-medium">{(batchResults.time_saved_ms / 1000).toFixed(1)} ثانیه</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">صرفه‌جویی هزینه:</span>
                      <span className="font-medium">${batchResults.cost_saved_usd.toFixed(4)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium">در حال اتمام...</span>
              </div>
            </div>
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