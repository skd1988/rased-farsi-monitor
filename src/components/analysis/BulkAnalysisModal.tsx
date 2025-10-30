import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

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
  const [results, setResults] = useState<Record<string, 'success' | 'error'>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchUnanalyzedPosts();
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

  const analyzeSelected = async () => {
    if (selectedPosts.size === 0) {
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

    const postsToAnalyze = posts.filter(p => selectedPosts.has(p.id));
    const total = postsToAnalyze.length;

    for (let i = 0; i < postsToAnalyze.length; i++) {
      const post = postsToAnalyze[i];
      setCurrentPost(i + 1);

      try {
        const response = await supabase.functions.invoke('analyze-post', {
          body: {
            postId: post.id,
            postTitle: post.title,
            postContent: post.contents
          }
        });

        if (response.error) throw response.error;

        setResults(prev => ({ ...prev, [post.id]: 'success' }));
      } catch (error) {
        console.error(`Error analyzing post ${post.id}:`, error);
        setResults(prev => ({ ...prev, [post.id]: 'error' }));
      }

      setProgress(((i + 1) / total) * 100);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsAnalyzing(false);
    toast({
      title: 'تحلیل گروهی تکمیل شد',
      description: `${Object.values(results).filter(r => r === 'success').length} مطلب با موفقیت تحلیل شد`,
    });

    setTimeout(() => {
      onComplete();
      onClose();
    }, 2000);
  };

  const analyzeAll = async () => {
    setSelectedPosts(new Set(posts.map(p => p.id)));
    setTimeout(() => analyzeSelected(), 100);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تحلیل گروهی مطالب</DialogTitle>
          <DialogDescription>
            {isAnalyzing
              ? `در حال تحلیل: ${currentPost} از ${selectedPosts.size}`
              : `${posts.length} مطلب تحلیل نشده یافت شد`
            }
          </DialogDescription>
        </DialogHeader>

        {isAnalyzing ? (
          <div className="space-y-4 py-6">
            <Progress value={progress} className="w-full" />
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>در حال پردازش...</span>
            </div>
            <div className="space-y-2">
              {posts.filter(p => selectedPosts.has(p.id)).map(post => (
                <div key={post.id} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm truncate">{post.title}</span>
                  {results[post.id] === 'success' && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {results[post.id] === 'error' && (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  {!results[post.id] && currentPost > posts.findIndex(p => p.id === post.id) && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <Button onClick={analyzeAll} disabled={posts.length === 0}>
                تحلیل همه ({posts.length})
              </Button>
              <Button 
                onClick={analyzeSelected} 
                disabled={selectedPosts.size === 0}
                variant="secondary"
              >
                تحلیل انتخاب شده ({selectedPosts.size})
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
                      <TableCell className="max-w-md truncate">{post.title}</TableCell>
                      <TableCell>{post.source}</TableCell>
                      <TableCell>{new Date(post.published_at).toLocaleDateString('fa-IR')}</TableCell>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BulkAnalysisModal;