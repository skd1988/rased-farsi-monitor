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
      const { data, error } = await supabase
        .from('posts')
        .select('id, title, contents, published_at, source')
        .is('analyzed_at', null)
        .order('published_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPosts(data || []);
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
    const total = postsToAnalyze.length;
    setEstimatedTimeRemaining(total * 3);
    
    const startTime = Date.now();
    let successCount = 0;
    let alertsCreated = 0;

    for (let i = 0; i < postsToAnalyze.length; i++) {
      const post = postsToAnalyze[i];
      setCurrentPost(i + 1);
      setCurrentPostTitle(post.title);
      
      const elapsed = (Date.now() - startTime) / 1000;
      const avgTimePerPost = elapsed / (i + 1);
      const remaining = Math.ceil(avgTimePerPost * (total - i - 1));
      setEstimatedTimeRemaining(remaining);

      try {
        console.log(`🔵 Analyzing post ${i + 1}/${total}: ${post.id}`);
        
        const response = await supabase.functions.invoke('analyze-post', {
          body: {
            postId: post.id,
            postTitle: post.title,
            postContent: post.contents
          }
        });

        if (response.error) {
          console.error('❌ Edge function error:', response.error);
          throw response.error;
        }
        
        if (!response.data || !response.data.analysis) {
          console.error('❌ Invalid response structure:', response.data);
          throw new Error('Invalid response from edge function');
        }
        
        const analysis = response.data.analysis;
        console.log(`✅ Analysis received for post ${post.id}`);

        // Save to database with correct field names
        const { error: updateError } = await supabase
          .from('posts')
          .update({
            analysis_summary: analysis.summary,
            sentiment: analysis.sentiment,
            sentiment_score: analysis.sentiment_score,
            main_topic: analysis.main_topic,
            threat_level: analysis.threat_level,
            confidence: analysis.confidence,
            key_points: analysis.key_points,
            recommended_action: analysis.recommended_action,
            analyzed_at: analysis.analyzed_at,
            analysis_model: analysis.analysis_model,
            processing_time: analysis.processing_time
          })
          .eq('id', post.id);

        if (updateError) {
          console.error('❌ Database update error:', updateError);
          throw updateError;
        }

        // Auto-create alert for critical/high threat posts
        if (analysis.threat_level === 'Critical' || analysis.threat_level === 'High') {
          const alertType = 
            analysis.main_topic === 'جنگ روانی' ? 'Psychological Warfare' :
            analysis.main_topic === 'کمپین' ? 'Coordinated Campaign' :
            analysis.main_topic === 'اتهام' ? 'Direct Attack' :
            analysis.main_topic === 'شبهه' ? 'Fake News' :
            analysis.main_topic?.includes('محور') ? 'Propaganda' :
            'Viral Content';

          const triggeredReason = `تهدید سطح ${analysis.threat_level} - احساسات: ${analysis.sentiment} - موضوع اصلی: ${analysis.main_topic} - اطمینان: ${analysis.confidence}%`;

          const { error: alertError } = await supabase.from('alerts').insert({
            post_id: post.id,
            alert_type: alertType,
            severity: analysis.threat_level,
            status: 'New',
            triggered_reason: triggeredReason,
            assigned_to: null,
            notes: null
          });
          
          if (!alertError) {
            alertsCreated++;
            console.log(`🚨 Alert created for post ${post.id} - ${analysis.threat_level}`);
          }
        }

        setResults(prev => ({ ...prev, [post.id]: 'success' }));
        successCount++;

      } catch (error) {
        console.error(`❌ Error analyzing post ${post.id}:`, error);
        setResults(prev => ({ ...prev, [post.id]: 'error' }));
      }

      setProgress(((i + 1) / total) * 100);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsAnalyzing(false);
    
    toast({
      title: 'تحلیل گروهی تکمیل شد',
      description: alertsCreated > 0 
        ? `${successCount} مطلب تحلیل شد و ${alertsCreated} هشدار ایجاد شد`
        : `${successCount} از ${total} مطلب با موفقیت تحلیل شد`,
    });

    setTimeout(() => {
      onComplete();
      onClose();
    }, 2000);
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
                <span>پیشرفت: {currentPost} از {posts.length}</span>
                <span>زمان تخمینی: {estimatedTimeRemaining} ثانیه</span>
              </div>
              <Progress value={progress} className="w-full h-3" />
            </div>
            
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium">در حال تحلیل:</span>
              </div>
              <p className="text-sm break-words">{currentPostTitle}</p>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              <h4 className="font-semibold mb-2">نتایج ({Object.keys(results).length}):</h4>
              {Object.entries(results).map(([postId, status]) => {
                const post = posts.find(p => p.id === postId);
                return (
                  <div key={postId} className="flex items-start justify-between gap-3 p-3 border rounded-lg bg-card">
                    <span className="text-sm flex-1 line-clamp-2 break-words leading-relaxed">{post?.title}</span>
                    {status === 'success' && (
                      <div className="flex items-center gap-2 text-green-600 shrink-0">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs whitespace-nowrap">موفق</span>
                      </div>
                    )}
                    {status === 'error' && (
                      <div className="flex items-center gap-2 text-red-600 shrink-0">
                        <XCircle className="h-4 w-4" />
                        <span className="text-xs whitespace-nowrap">خطا</span>
                      </div>
                    )}
                  </div>
                );
              })}
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