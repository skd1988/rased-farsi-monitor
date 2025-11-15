import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Play, Pause, RotateCcw, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useSettings } from '@/pages/settings/hooks/useSettings';
import { useAnalysisAutomation } from '@/hooks/useAnalysisAutomation';

export default function BatchAnalysis() {
  const [unanalyzedCount, setUnanalyzedCount] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [currentPost, setCurrentPost] = useState<string>("");
  const [errors, setErrors] = useState<Array<{ postId: string; title: string; error: string }>>([]);
  const [batchSize, setBatchSize] = useState(10);
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const { toast } = useToast();

  // Settings Integration
  const { settings } = useSettings();

  useEffect(() => {
    loadUnanalyzedCount();
  }, []);

  useEffect(() => {
    if (isAnalyzing && progress.current > 0 && startTime) {
      const elapsed = Date.now() - startTime;
      const avgTimePerPost = elapsed / progress.current;
      const remaining = progress.total - progress.current;
      setEstimatedTime(Math.ceil((avgTimePerPost * remaining) / 1000));
    }
  }, [progress.current, progress.total, isAnalyzing, startTime]);

  // Sync local state with settings
  useEffect(() => {
    if (settings.batch_size) {
      setBatchSize(parseInt(settings.batch_size));
    }
    if (settings.analysis_delay) {
      setDelaySeconds(settings.analysis_delay * 60); // تبدیل دقیقه به ثانیه
    }
  }, [settings.batch_size, settings.analysis_delay]);

  // Analysis Automation
  const { isAutomationActive, nextRunTime } = useAnalysisAutomation({
    onAnalyze: async (limit: number) => {
      setBatchSize(limit);
      await startBatchAnalysis();
    },
    isAnalyzing,
  });

  const loadUnanalyzedCount = async () => {
    const { count } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .or("analyzed_at.is.null,status.eq.new");
    setUnanalyzedCount(count || 0);
  };

  const analyzePost = async (post: any): Promise<boolean> => {
    try {
      setCurrentPost(post.title || "Untitled");

      const { data, error } = await supabase.functions.invoke("analyze-post-deepseek", {
        body: {
          postId: post.id,
          title: post.title,
          contents: post.contents,
          source: post.source,
          language: post.language || "نامشخص",
          published_at: post.published_at,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Analysis failed");

      return true;
    } catch (error) {
      console.error("Error analyzing post:", error);
      setErrors((prev) => [
        ...prev,
        {
          postId: post.id,
          title: post.title || "Untitled",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      ]);
      return false;
    }
  };

  const processWithRetry = async (post: any, maxRetries = 2): Promise<boolean> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (isPaused) {
        await new Promise((resolve) => {
          const checkPause = setInterval(() => {
            if (!isPaused) {
              clearInterval(checkPause);
              resolve(true);
            }
          }, 500);
        });
      }

      const success = await analyzePost(post);
      if (success) return true;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
    return false;
  };

  const startBatchAnalysis = async () => {
    setIsAnalyzing(true);
    setIsPaused(false);
    setStartTime(Date.now());
    setProgress({ current: 0, total: 0, success: 0, failed: 0 });
    setErrors([]);

    try {
      // Fetch ALL unanalyzed posts with pagination (no 1000 limit)
      let allPosts: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: postsData, error } = await supabase
          .from("posts")
          .select("id, title, contents, source, language, published_at")
          .or("analyzed_at.is.null,status.eq.new")
          .order("published_at", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        
        if (postsData && postsData.length > 0) {
          allPosts = [...allPosts, ...postsData];
          from += pageSize;
          hasMore = postsData.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      const posts = allPosts;
      if (!posts || posts.length === 0) {
        toast({ title: "No posts to analyze" });
        setIsAnalyzing(false);
        return;
      }

      setProgress({ current: 0, total: posts.length, success: 0, failed: 0 });

      for (let i = 0; i < posts.length; i += batchSize) {
        if (isPaused) {
          await new Promise((resolve) => {
            const checkPause = setInterval(() => {
              if (!isPaused) {
                clearInterval(checkPause);
                resolve(true);
              }
            }, 500);
          });
        }

        const batch = posts.slice(i, i + batchSize);
        const results = await Promise.all(batch.map((post) => processWithRetry(post)));

        const successCount = results.filter(Boolean).length;
        const failCount = results.filter((r) => !r).length;

        setProgress((prev) => ({
          ...prev,
          current: prev.current + batch.length,
          success: prev.success + successCount,
          failed: prev.failed + failCount,
        }));

        if (i + batchSize < posts.length) {
          await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
        }
      }

      toast({
        title: "Batch analysis complete",
        description: `Analyzed ${progress.success + progress.failed} posts. ${progress.success} succeeded, ${progress.failed} failed.`,
      });

      await loadUnanalyzedCount();
    } catch (error) {
      console.error("Batch analysis error:", error);
      toast({
        title: "Batch analysis failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      setCurrentPost("");
      setStartTime(null);
    }
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    toast({ title: isPaused ? "Resuming..." : "Paused" });
  };

  const retryFailed = async () => {
    if (errors.length === 0) return;

    const failedIds = errors.map((e) => e.postId);
    setErrors([]);

    const { data: posts } = await supabase
      .from("posts")
      .select("id, title, contents, source, language, published_at")
      .in("id", failedIds);

    if (!posts) return;

    setIsAnalyzing(true);
    setProgress({ current: 0, total: posts.length, success: 0, failed: 0 });

    for (const post of posts) {
      const success = await processWithRetry(post);
      setProgress((prev) => ({
        ...prev,
        current: prev.current + 1,
        success: prev.success + (success ? 1 : 0),
        failed: prev.failed + (success ? 0 : 1),
      }));
    }

    setIsAnalyzing(false);
    toast({ title: "Retry complete" });
  };

  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  const successRate = progress.current > 0 ? ((progress.success / progress.current) * 100).toFixed(1) : "0.0";

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Batch Post Analysis</h1>
          <p className="text-muted-foreground">Analyze multiple posts using DeepSeek AI</p>
        </div>

        {isAutomationActive && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      تحلیل خودکار فعال است
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      {settings.analysis_schedule === 'immediate' && 'فوری - بلافاصله بعد از ورود مطالب'}
                      {settings.analysis_schedule === 'delayed' && `تاخیری - هر ${settings.analysis_delay} دقیقه`}
                      {settings.analysis_schedule === 'scheduled' && 'زمان‌بندی شده - در ساعات مشخص'}
                    </p>
                  </div>
                </div>
                {nextRunTime && settings.analysis_schedule === 'delayed' && (
                  <div className="text-left">
                    <p className="text-xs text-green-600 dark:text-green-400">اجرای بعدی:</p>
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      {new Date(nextRunTime).toLocaleTimeString('fa-IR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Analysis Status</CardTitle>
            <CardDescription>
              {unanalyzedCount} unanalyzed posts remaining
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAnalyzing && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Progress: {progress.current} / {progress.total}</span>
                  <span className="text-muted-foreground">{progressPercentage.toFixed(1)}%</span>
                </div>
                <Progress value={progressPercentage} />
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Success: {progress.success}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span>Failed: {progress.failed}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span>Rate: {successRate}%</span>
                  </div>
                </div>

                {currentPost && (
                  <Alert>
                    <AlertDescription>
                      Currently analyzing: {currentPost}
                    </AlertDescription>
                  </Alert>
                )}

                {estimatedTime > 0 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Estimated time remaining: {Math.floor(estimatedTime / 60)}m {estimatedTime % 60}s
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {!isAnalyzing ? (
                <Button onClick={startBatchAnalysis} disabled={unanalyzedCount === 0} className="flex-1">
                  <Play className="h-4 w-4 mr-2" />
                  Start Analysis
                </Button>
              ) : (
                <>
                  <Button onClick={togglePause} variant="outline" className="flex-1">
                    {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                    {isPaused ? "Resume" : "Pause"}
                  </Button>
                </>
              )}

              {errors.length > 0 && !isAnalyzing && (
                <Button onClick={retryFailed} variant="secondary">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry Failed ({errors.length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="batchSize">Batch Size</Label>
                <Input
                  id="batchSize"
                  type="number"
                  min="1"
                  max="50"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  disabled={isAnalyzing}
                />
                <p className="text-xs text-muted-foreground">Posts to analyze simultaneously</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delay">Delay Between Batches (seconds)</Label>
                <Input
                  id="delay"
                  type="number"
                  min="0"
                  max="30"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  disabled={isAnalyzing}
                />
                <p className="text-xs text-muted-foreground">Avoid rate limiting</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {errors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Error Log</CardTitle>
              <CardDescription>{errors.length} posts failed to analyze</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {errors.map((err, idx) => (
                  <Alert key={idx} variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{err.title}</strong>
                      <br />
                      <span className="text-xs">{err.error}</span>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
