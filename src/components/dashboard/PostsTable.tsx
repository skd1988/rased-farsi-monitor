import React from 'react';
import { Eye, ExternalLink, Zap, Brain, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPersianDateTime, getRelativeTime } from '@/lib/dateUtils';
import { EnrichedPost } from '@/lib/mockData';
import { cn } from '@/lib/utils';

interface PostsTableProps {
  posts: EnrichedPost[];
  onViewPost: (post: EnrichedPost) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
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

const getStanceBadgeClass = (stance?: string | null): string => {
  switch (stance) {
    case 'hostile_propaganda':
      return 'bg-red-600 text-white';
    case 'legitimate_criticism':
      return 'bg-blue-600 text-white';
    case 'supportive':
      return 'bg-green-600 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

const getCategoryBadgeClass = (category?: string | null): string => {
  switch (category) {
    case 'confirmed_psyop':
      return 'bg-red-700 text-white';
    case 'potential_psyop':
      return 'bg-orange-600 text-white';
    default:
      return 'bg-gray-600 text-white';
  }
};

const PostsTable: React.FC<PostsTableProps> = ({
  posts,
  onViewPost,
  currentPage = 1,
  totalPages = 1,
  onPageChange
}) => {
  return (
    <div className="bg-card rounded-lg shadow-card overflow-hidden">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-right">آخرین مطالب منتشر شده</h3>
          {totalPages > 1 && (
            <span className="text-sm text-muted-foreground">
              صفحه {currentPage} از {totalPages}
            </span>
          )}
        </div>
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
              <th className="px-4 py-3 text-right text-sm font-medium">نوع تحلیل</th>
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
                  <div className="flex flex-col items-start gap-1">
                    <button
                      onClick={() => onViewPost(post)}
                      className="text-sm font-medium hover:text-primary transition-colors text-right line-clamp-2"
                      title={post.title}
                    >
                      {post.title}
                    </button>
                    <div className="flex flex-wrap gap-1">
                      <span
                        className={cn('px-2 py-0.5 rounded text-[11px] font-semibold', getStanceBadgeClass(post.stance_type))}
                      >
                        {(post.stance_type ?? 'neutral').replace(/_/g, ' ')}
                      </span>
                      {post.psyop_category && (
                        <span
                          className={cn('px-2 py-0.5 rounded text-[11px] font-semibold', getCategoryBadgeClass(post.psyop_category))}
                        >
                          {post.psyop_category.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    {Array.isArray(post.psyop_techniques) && post.psyop_techniques.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {post.psyop_techniques.slice(0, 3).map((tech: string) => (
                          <Badge key={tech} variant="outline" className="text-[11px]">
                            {tech.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {post.sourceURL ? (
                    <a
                      href={post.sourceURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block hover:opacity-80 transition-opacity"
                    >
                      <Badge className={cn('text-xs cursor-pointer', getSourceColor(post.source))}>
                        {post.source}
                      </Badge>
                    </a>
                  ) : (
                    <Badge className={cn('text-xs', getSourceColor(post.source))}>
                      {post.source}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-right">{post.author}</td>
                <td className="px-4 py-3">
                  <div className="text-right">
                    <p className="text-sm">{formatPersianDateTime(post.date)}</p>
                    <p className="text-xs text-muted-foreground">{getRelativeTime(post.date)}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-lg" title={post.language}>
                    {getLanguageFlag(post.language)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <TooltipProvider>
                    {(post as any).analysis_stage === 'deep' ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 justify-end cursor-help">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-xs font-medium text-red-700 dark:text-red-400">
                              عمیق
                            </span>
                            <Info className="w-3 h-3 text-gray-400" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p className="text-xs">تحلیل کامل 25+ فیلد</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (post as any).analysis_stage === 'quick' ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 justify-end cursor-help">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-xs font-medium text-green-700 dark:text-green-400">
                              سریع
                            </span>
                            <Info className="w-3 h-3 text-gray-400" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p className="text-xs">غربالگری اولیه</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs text-gray-400 text-center block">-</span>
                    )}
                  </TooltipProvider>
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
                    {post.articleURL && (
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                      >
                        <a
                          href={post.articleURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="لینک اصلی"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              صفحه {currentPage} از {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="mr-1">قبلی</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <span className="ml-1">بعدی</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostsTable;
