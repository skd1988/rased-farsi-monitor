import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Download, Search, Filter, X, ChevronLeft, ChevronRight, MoreVertical, Eye, Link as LinkIcon, Archive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import PostDetailModal from '@/components/dashboard/PostDetailModal';
import { formatPersianDate, getRelativeTime } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface Post {
  id: string;
  title: string;
  contents: string | null;
  author: string | null;
  article_url: string | null;
  source: string;
  language: string;
  status: string;
  keywords: string[];
  published_at: string;
}

const SOURCES = ['الجزیرة', 'ایسنا', 'مهر', 'تسنیم', 'فارس', 'ایرنا', 'RT Arabic', 'BBC Persian', 'نامشخص'];
const LANGUAGES = [
  { code: 'فارسی', label: 'فارسی', emoji: '🇮🇷' },
  { code: 'عربی', label: 'عربی', emoji: '🇸🇦' },
  { code: 'English', label: 'English', emoji: '🇬🇧' },
];
const STATUSES = ['جدید', 'در حال تحلیل', 'تحلیل شده', 'آرشیو شده'];
const ALL_KEYWORDS = ['جنگ روانی', 'محور مقاومت', 'اتهام', 'شبهه', 'کمپین'];

const KEYWORD_COLORS: Record<string, string> = {
  'جنگ روانی': 'bg-red-500/10 text-red-500 border-red-500/20',
  'محور مقاومت': 'bg-green-500/10 text-green-500 border-green-500/20',
  'اتهام': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  'شبهه': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  'کمپین': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

const STATUS_COLORS: Record<string, string> = {
  'جدید': 'bg-muted text-muted-foreground',
  'در حال تحلیل': 'bg-blue-500/10 text-blue-500',
  'تحلیل شده': 'bg-green-500/10 text-green-500',
  'آرشیو شده': 'bg-secondary text-secondary-foreground',
};

const PostsExplorer = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'keywords' | 'alphabetical'>('newest');

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('published_at', { ascending: false });
      
      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: 'خطا در بارگذاری مطالب',
        description: 'لطفا دوباره تلاش کنید',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort posts
  const filteredPosts = useMemo(() => {
    let filtered = posts;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.contents?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.author?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Source filter
    if (selectedSources.size > 0) {
      filtered = filtered.filter(post => selectedSources.has(post.source));
    }

    // Language filter
    if (selectedLanguages.size > 0) {
      filtered = filtered.filter(post => selectedLanguages.has(post.language));
    }

    // Status filter
    if (selectedStatuses.size > 0) {
      filtered = filtered.filter(post => selectedStatuses.has(post.status));
    }

    // Keywords filter
    if (selectedKeywords.size > 0) {
      filtered = filtered.filter(post =>
        post.keywords.some(k => selectedKeywords.has(k))
      );
    }

    // Date filter
    if (dateFrom) {
      filtered = filtered.filter(post => new Date(post.published_at) >= new Date(dateFrom));
    }
    if (dateTo) {
      filtered = filtered.filter(post => new Date(post.published_at) <= new Date(dateTo));
    }

    // Sort
    if (sortBy === 'newest') {
      filtered = [...filtered].sort((a, b) => 
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      );
    } else if (sortBy === 'oldest') {
      filtered = [...filtered].sort((a, b) => 
        new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
      );
    } else if (sortBy === 'keywords') {
      filtered = [...filtered].sort((a, b) => b.keywords.length - a.keywords.length);
    } else if (sortBy === 'alphabetical') {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }

    return filtered;
  }, [posts, searchQuery, selectedSources, selectedLanguages, selectedStatuses, selectedKeywords, dateFrom, dateTo, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredPosts.length / itemsPerPage);
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPosts(new Set(paginatedPosts.map(p => p.id)));
    } else {
      setSelectedPosts(new Set());
    }
  };

  const handleSelectPost = (postId: string, checked: boolean) => {
    const newSelected = new Set(selectedPosts);
    if (checked) {
      newSelected.add(postId);
    } else {
      newSelected.delete(postId);
    }
    setSelectedPosts(newSelected);
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);
      
      if (error) throw error;
      
      setPosts(posts.filter(p => p.id !== postId));
      toast({ title: 'مطلب با موفقیت حذف شد' });
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: 'خطا در حذف مطلب',
        variant: 'destructive',
      });
    }
  };

  const handleArchivePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ status: 'آرشیو شده' })
        .eq('id', postId);
      
      if (error) throw error;
      
      setPosts(posts.map(p => p.id === postId ? { ...p, status: 'آرشیو شده' } : p));
      toast({ title: 'مطلب آرشیو شد' });
    } catch (error) {
      console.error('Error archiving post:', error);
      toast({
        title: 'خطا در آرشیو مطلب',
        variant: 'destructive',
      });
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedSources(new Set());
    setSelectedLanguages(new Set());
    setSelectedStatuses(new Set());
    setSelectedKeywords(new Set());
    setDateFrom('');
    setDateTo('');
  };

  const activeFiltersCount = 
    (searchQuery ? 1 : 0) +
    selectedSources.size +
    selectedLanguages.size +
    selectedStatuses.size +
    selectedKeywords.size +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const getSourceCount = (source: string) => posts.filter(p => p.source === source).length;
  const getLanguageCount = (lang: string) => posts.filter(p => p.language === lang).length;
  const getStatusCount = (status: string) => posts.filter(p => p.status === status).length;
  const getKeywordCount = (keyword: string) => posts.filter(p => p.keywords.includes(keyword)).length;

  return (
    <div className="flex h-full bg-background" dir="rtl">
      {/* Filters Sidebar */}
      <aside className="w-80 border-l border-border bg-card overflow-y-auto">
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold mb-4">فیلترهای پیشرفته</h3>
            
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="جستجو در عنوان، محتوا، نویسنده..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>

            {/* Sources */}
            <div className="mb-6">
              <h4 className="font-medium mb-3">منبع خبری</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {SOURCES.map(source => (
                  <div key={source} className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedSources.has(source)}
                        onCheckedChange={(checked) => {
                          const newSources = new Set(selectedSources);
                          if (checked) newSources.add(source);
                          else newSources.delete(source);
                          setSelectedSources(newSources);
                        }}
                      />
                      <span className="text-sm">{source}</span>
                    </label>
                    <span className="text-xs text-muted-foreground">({getSourceCount(source)})</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSources(new Set(SOURCES))}
                  className="text-xs"
                >
                  انتخاب همه
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSources(new Set())}
                  className="text-xs"
                >
                  پاک کردن
                </Button>
              </div>
            </div>

            {/* Date Range */}
            <div className="mb-6">
              <h4 className="font-medium mb-3">بازه زمانی</h4>
              <div className="space-y-2">
                <Input
                  type="date"
                  placeholder="از تاریخ"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <Input
                  type="date"
                  placeholder="تا تاریخ"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => {
                  const today = new Date();
                  setDateFrom(today.toISOString().split('T')[0]);
                  setDateTo(today.toISOString().split('T')[0]);
                }}>امروز</Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  setDateFrom(yesterday.toISOString().split('T')[0]);
                  setDateTo(yesterday.toISOString().split('T')[0]);
                }}>دیروز</Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const week = new Date();
                  week.setDate(week.getDate() - 7);
                  setDateFrom(week.toISOString().split('T')[0]);
                  setDateTo(new Date().toISOString().split('T')[0]);
                }}>7 روز اخیر</Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const month = new Date();
                  month.setDate(month.getDate() - 30);
                  setDateFrom(month.toISOString().split('T')[0]);
                  setDateTo(new Date().toISOString().split('T')[0]);
                }}>30 روز اخیر</Button>
              </div>
            </div>

            {/* Languages */}
            <div className="mb-6">
              <h4 className="font-medium mb-3">زبان</h4>
              <div className="space-y-2">
                {LANGUAGES.map(lang => (
                  <div key={lang.code} className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedLanguages.has(lang.code)}
                        onCheckedChange={(checked) => {
                          const newLangs = new Set(selectedLanguages);
                          if (checked) newLangs.add(lang.code);
                          else newLangs.delete(lang.code);
                          setSelectedLanguages(newLangs);
                        }}
                      />
                      <span className="text-sm">{lang.emoji} {lang.label}</span>
                    </label>
                    <span className="text-xs text-muted-foreground">({getLanguageCount(lang.code)})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="mb-6">
              <h4 className="font-medium mb-3">وضعیت</h4>
              <div className="space-y-2">
                {STATUSES.map(status => (
                  <div key={status} className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedStatuses.has(status)}
                        onCheckedChange={(checked) => {
                          const newStatuses = new Set(selectedStatuses);
                          if (checked) newStatuses.add(status);
                          else newStatuses.delete(status);
                          setSelectedStatuses(newStatuses);
                        }}
                      />
                      <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[status])}>
                        {status}
                      </Badge>
                    </label>
                    <span className="text-xs text-muted-foreground">({getStatusCount(status)})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div className="mb-6">
              <h4 className="font-medium mb-3">کلمات کلیدی</h4>
              <div className="space-y-2">
                {ALL_KEYWORDS.map(keyword => (
                  <div key={keyword} className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedKeywords.has(keyword)}
                        onCheckedChange={(checked) => {
                          const newKeywords = new Set(selectedKeywords);
                          if (checked) newKeywords.add(keyword);
                          else newKeywords.delete(keyword);
                          setSelectedKeywords(newKeywords);
                        }}
                      />
                      <Badge variant="outline" className={cn('text-xs', KEYWORD_COLORS[keyword])}>
                        {keyword}
                      </Badge>
                    </label>
                    <span className="text-xs text-muted-foreground">({getKeywordCount(keyword)})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="space-y-2 sticky bottom-0 bg-card pt-4 border-t">
            <Button className="w-full" onClick={() => setCurrentPage(1)}>
              اعمال فیلترها
            </Button>
            <Button variant="outline" className="w-full" onClick={clearAllFilters}>
              <X className="w-4 h-4 ml-2" />
              پاک کردن همه
            </Button>
            {activeFiltersCount > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {activeFiltersCount} فیلتر فعال
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h1 className="text-3xl font-bold mb-2">مطالب</h1>
                <p className="text-muted-foreground">جستجو و مرور تمام مطالب جمع‌آوری شده</p>
              </div>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                خروجی Excel
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center justify-between mb-4 bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-6">
              <span className="text-sm font-medium">تعداد مطالب: {filteredPosts.length}</span>
              <span className="text-sm text-muted-foreground">
                نمایش {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredPosts.length)} از {filteredPosts.length}
              </span>
            </div>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">جدیدترین</SelectItem>
                <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
                <SelectItem value="keywords">بیشترین کلمات کلیدی</SelectItem>
                <SelectItem value="alphabetical">الفبایی (الف-ی)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedPosts.size > 0 && (
            <div className="mb-4 bg-primary/10 p-4 rounded-lg flex items-center justify-between">
              <span className="font-medium">{selectedPosts.size} مورد انتخاب شده</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>تحلیل گروهی</Button>
                <Button variant="outline" size="sm" disabled>تغییر وضعیت</Button>
                <Button variant="outline" size="sm" disabled>آرشیو کردن</Button>
                <Button variant="outline" size="sm" disabled>حذف</Button>
              </div>
            </div>
          )}

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : paginatedPosts.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-lg text-muted-foreground">هیچ مطلبی یافت نشد</p>
                  <Button variant="link" onClick={clearAllFilters} className="mt-2">
                    پاک کردن فیلترها
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="p-4 text-right">
                          <Checkbox
                            checked={selectedPosts.size === paginatedPosts.length && paginatedPosts.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </th>
                        <th className="p-4 text-right font-medium">ردیف</th>
                        <th className="p-4 text-right font-medium min-w-[300px]">عنوان</th>
                        <th className="p-4 text-right font-medium">منبع</th>
                        <th className="p-4 text-right font-medium">نویسنده</th>
                        <th className="p-4 text-right font-medium">تاریخ</th>
                        <th className="p-4 text-right font-medium">زبان</th>
                        <th className="p-4 text-right font-medium">کلمات کلیدی</th>
                        <th className="p-4 text-right font-medium">وضعیت</th>
                        <th className="p-4 text-right font-medium">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPosts.map((post, index) => (
                        <tr
                          key={post.id}
                          className="border-b hover:bg-muted/50 transition-colors"
                        >
                          <td className="p-4">
                            <Checkbox
                              checked={selectedPosts.has(post.id)}
                              onCheckedChange={(checked) => handleSelectPost(post.id, checked as boolean)}
                            />
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => setSelectedPost(post)}
                              className="text-right hover:text-primary transition-colors font-medium line-clamp-2"
                            >
                              {post.title}
                            </button>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="whitespace-nowrap">
                              {post.source}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {post.author || '-'}
                          </td>
                          <td className="p-4">
                            <div className="text-sm">
                              <div>{formatPersianDate(post.published_at)}</div>
                              <div className="text-xs text-muted-foreground">
                                {getRelativeTime(post.published_at)}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-sm">
                            {LANGUAGES.find(l => l.code === post.language)?.emoji} {post.language}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {post.keywords.slice(0, 3).map(keyword => (
                                <Badge
                                  key={keyword}
                                  variant="outline"
                                  className={cn('text-xs', KEYWORD_COLORS[keyword])}
                                >
                                  {keyword}
                                </Badge>
                              ))}
                              {post.keywords.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{post.keywords.length - 3} دیگر
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[post.status])}>
                              {post.status}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSelectedPost(post)}>
                                  <Eye className="w-4 h-4 ml-2" />
                                  مشاهده جزئیات
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled>
                                  🤖 تحلیل هوش مصنوعی (به زودی)
                                </DropdownMenuItem>
                                {post.article_url && (
                                  <DropdownMenuItem
                                    onClick={() => window.open(post.article_url!, '_blank')}
                                  >
                                    <LinkIcon className="w-4 h-4 ml-2" />
                                    باز کردن لینک اصلی
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem disabled>
                                  📝 ویرایش
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleArchivePost(post.id)}>
                                  <Archive className="w-4 h-4 ml-2" />
                                  آرشیو
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setPostToDelete(post.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 ml-2" />
                                  حذف
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {!loading && filteredPosts.length > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">نمایش</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(v) => {
                    setItemsPerPage(Number(v));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">مورد در هر صفحه</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronRight className="w-4 h-4" />
                  صفحه قبل
                </Button>
                
                <div className="flex gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  صفحه بعد
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={{
            id: selectedPost.id,
            date: selectedPost.published_at,
            title: selectedPost.title,
            contents: selectedPost.contents || '',
            author: selectedPost.author || '',
            articleURL: selectedPost.article_url || '',
            source: selectedPost.source,
            language: selectedPost.language,
            status: selectedPost.status,
            keywords: selectedPost.keywords,
          }}
          isOpen={!!selectedPost}
          onClose={() => setSelectedPost(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>آیا مطمئن هستید؟</AlertDialogTitle>
            <AlertDialogDescription>
              این عمل قابل بازگشت نیست! این مطلب برای همیشه حذف خواهد شد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (postToDelete) {
                  handleDeletePost(postToDelete);
                  setPostToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PostsExplorer;
