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
      const { data: posts, error } = await supabase
        .from("posts")
        .select("id, title, contents, source, language, published_at")
        .or("analyzed_at.is.null,status.eq.new")
        .order("published_at", { ascending: false });

      if (error) throw error;
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
