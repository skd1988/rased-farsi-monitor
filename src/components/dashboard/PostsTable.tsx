import React from 'react';
import { Eye, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPersianDate, getRelativeTime } from '@/lib/dateUtils';
import { EnrichedPost } from '@/lib/mockData';
import { cn } from '@/lib/utils';

interface PostsTableProps {
  posts: EnrichedPost[];
  onViewPost: (post: EnrichedPost) => void;
}

const getSourceColor = (source: string): string => {
  const colors: Record<string, string> = {
    'الجزیرة': 'bg-success/10 text-success',
    'ایسنا': 'bg-primary/10 text-primary',
    'مهر': 'bg-purple-500/10 text-purple-500',
    'تسنیم': 'bg-blue-500/10 text-blue-500',
    'فارس': 'bg-green-500/10 text-green-500',
  };
  return colors[source] || 'bg-muted text-muted-foreground';
};

const getLanguageFlag = (language: string): string => {
  const flags: Record<string, string> = {
    'فارسی': '🇮🇷',
    'عربی': '🇸🇦',
    'English': '🇬🇧',
  };
  return flags[language] || '🌐';
};

const PostsTable: React.FC<PostsTableProps> = ({ posts, onViewPost }) => {
  return (
    <div className="bg-card rounded-lg shadow-card overflow-hidden">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-bold text-right">آخرین مطالب منتشر شده</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-right text-sm font-medium">ردیف</th>
              <th className="px-4 py-3 text-right text-sm font-medium">عنوان</th>
              <th className="px-4 py-3 text-right text-sm font-medium">منبع</th>
              <th className="px-4 py-3 text-right text-sm font-medium">نویسنده</th>
              <th className="px-4 py-3 text-right text-sm font-medium">تاریخ</th>
              <th className="px-4 py-3 text-right text-sm font-medium">زبان</th>
              <th className="px-4 py-3 text-right text-sm font-medium">کلمات کلیدی</th>
              <th className="px-4 py-3 text-right text-sm font-medium">وضعیت</th>
              <th className="px-4 py-3 text-right text-sm font-medium">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {posts.map((post, index) => (
              <tr key={post.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-sm">{index + 1}</td>
                <td className="px-4 py-3 max-w-xs">
                  <button
                    onClick={() => onViewPost(post)}
                    className="text-sm font-medium hover:text-primary transition-colors text-right line-clamp-2"
                    title={post.title}
                  >
                    {post.title}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <Badge className={cn('text-xs', getSourceColor(post.source))}>
                    {post.source}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-right">{post.author}</td>
                <td className="px-4 py-3">
                  <div className="text-right">
                    <p className="text-sm">{formatPersianDate(post.date)}</p>
                    <p className="text-xs text-muted-foreground">{getRelativeTime(post.date)}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-lg" title={post.language}>
                    {getLanguageFlag(post.language)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap justify-end">
                    {post.keywords.slice(0, 3).map((keyword, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                    {post.keywords.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{post.keywords.length - 3}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="text-xs">
                    {post.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewPost(post)}
                      title="مشاهده"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(post.articleURL, '_blank')}
                      title="لینک اصلی"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PostsTable;
