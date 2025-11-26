import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download } from "lucide-react";
import AnalysisCard from "@/components/analysis/AnalysisCard";
import AnalysisDetailModal from "@/components/analysis/AnalysisDetailModal";
import BulkAnalysisModal from "@/components/analysis/BulkAnalysisModal";
import {
  resolveAnalysisStage,
  normalizeSentimentValue,
} from "@/components/analysis/analysisUtils";
import type { AnalyzedPost } from "@/types/analysis";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import StatsCard from "@/components/analysis/StatsCard";
import { useAnalyzedPosts } from "@/hooks/useAnalyzedPosts";
import { supabase } from "@/integrations/supabase/client";

const AIAnalysis = () => {
  const { posts, loading, error, refetch } = useAnalyzedPosts();
  const [filteredPosts, setFilteredPosts] = useState<AnalyzedPost[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [threatFilter, setThreatFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("threat");
  const [psyopFilter, setPsyopFilter] = useState<"all" | "psyop" | "non_psyop">("all");
  const [stageFilter, setStageFilter] = useState<"all" | "quick" | "deep" | "deepest">("all");
  const [deepestOnly, setDeepestOnly] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<AnalyzedPost | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();

  useEffect(() => {
    applyFilters();
    setCurrentPage(1); // Reset to first page when filters change
  }, [
    posts,
    searchQuery,
    threatFilter,
    sentimentFilter,
    topicFilter,
    sortBy,
    psyopFilter,
    stageFilter,
    deepestOnly,
  ]);

  useEffect(() => {
    if (error) {
      toast({
        title: "خطا در بارگذاری تحلیل‌ها",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const applyFilters = () => {
    let filtered = [...posts];

    // Text search on title and analysis summary
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((post) => {
        const textParts: string[] = [
          post.title,
          post.analysis_summary,
          (post as any).quick_summary,
          (post as any).deep_summary,
          post.deep_smart_summary,
          post.deepest_smart_summary,
          post.extended_summary,
          post.narrative_core,
          post.crisis_extended_summary,
          post.crisis_narrative_core,
        ].filter(Boolean) as string[];

        const haystack = textParts.join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }

    // Threat level filter
    if (threatFilter !== "all") {
      filtered = filtered.filter((post) => post.threat_level === threatFilter);
    }

    // Sentiment filter
    if (sentimentFilter !== "all") {
      filtered = filtered.filter((post) => {
        const normalized = normalizeSentimentValue(post.sentiment as any);
        return normalized === sentimentFilter;
      });
    }

    // Topic filter
    if (topicFilter !== "all") {
      filtered = filtered.filter((post) => post.main_topic === topicFilter);
    }

    // PsyOp filter: all / only psyop / only non-psyop
    if (psyopFilter === "psyop") {
      filtered = filtered.filter((post) => post.is_psyop === true);
    } else if (psyopFilter === "non_psyop") {
      filtered = filtered.filter((post) => !post.is_psyop);
    }

    // Stage filter: Quick / Deep / Deepest
    if (stageFilter !== "all") {
      filtered = filtered.filter(
        (p) => resolveAnalysisStage(p as any) === stageFilter
      );
    }

    // Only posts with deepest (crisis) analysis
    if (deepestOnly) {
      filtered = filtered.filter(
        (p) => resolveAnalysisStage(p as any) === "deepest"
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === "threat") {
        const threatOrder: Record<string, number> = {
          Critical: 0,
          High: 1,
          Medium: 2,
          Low: 3,
        };
        const aRank = threatOrder[a.threat_level || "Low"] ?? 3;
        const bRank = threatOrder[b.threat_level || "Low"] ?? 3;
        return aRank - bRank;
      } else if (sortBy === "newest") {
        return new Date(b.analyzed_at || b.published_at).getTime() -
          new Date(a.analyzed_at || a.published_at).getTime();
      } else if (sortBy === "oldest") {
        return new Date(a.analyzed_at || a.published_at).getTime() -
          new Date(b.analyzed_at || b.published_at).getTime();
      }
      return 0;
    });

    setFilteredPosts(filtered);
  };

  const handleRunDeepAnalysis = async (postId: string) => {
    try {
      console.log("▶️ Running deep analysis for post", postId);

      const { data, error } = await supabase.functions.invoke(
        "analyze-post-deepseek",
        {
          body: { postId }, // send postId with correct key
        }
      );

      if (error) {
        console.error("Deep analysis error:", error);
        toast({
          title: "خطا در اجرای تحلیل عمیق",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      console.log("✅ Deep analysis result:", data);
      toast({
        title: "تحلیل عمیق اجرا شد",
        description: "نتایج به‌روزرسانی شد.",
      });

      await refetch();
    } catch (err) {
      console.error("Deep analysis exception:", err);
      toast({
        title: "خطای غیرمنتظره در اجرای تحلیل عمیق",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  const handleRunDeepestAnalysis = async (postId: string) => {
    try {
      console.log("▶️ Running deepest analysis for post", postId);

      const { data, error } = await supabase.functions.invoke("deepest-analysis", {
        body: { postId: postId },
      });

      if (error) {
        console.error("Deepest analysis error:", error);
        toast({
          title: "خطا در اجرای تحلیل بحران (Deepest)",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      console.log("✅ Deepest analysis result:", data);
      toast({
        title: "تحلیل بحران اجرا شد",
        description: "نتایج به‌روزرسانی شد.",
      });

      await refetch();
    } catch (err) {
      console.error("Deepest analysis exception:", err);
      toast({
        title: "خطای غیرمنتظره در اجرای تحلیل بحران (Deepest)",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  const psyopPosts = posts.filter((p) => p.is_psyop);

  const stats = {
    analyzed: posts.length,
    critical: posts.filter((p) => p.threat_level === "Critical").length,
    high: posts.filter((p) => p.threat_level === "High").length,
    negative: posts
      .filter((p) => normalizeSentimentValue(p.sentiment as any) === "Negative")
      .length,

    // 3-level PsyOp stats (using resolver)
    psyop: psyopPosts.length,
    quickOnly: psyopPosts.filter(
      (p) => resolveAnalysisStage(p as any) === "quick"
    ).length,
    deep: psyopPosts.filter(
      (p) => resolveAnalysisStage(p as any) === "deep"
    ).length,
    deepest: psyopPosts.filter(
      (p) => resolveAnalysisStage(p as any) === "deepest"
    ).length,
  };

  const allTopics = Array.from(new Set(posts.map((p) => p.main_topic).filter(Boolean)));

  // Pagination calculations
  const totalPages = Math.ceil(filteredPosts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPosts = filteredPosts.slice(startIndex, endIndex);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('ellipsis');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (posts.length === 0) {
    return (
      <>
        <div className="p-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <div className="text-6xl">🤖</div>
            <h3 className="text-2xl font-bold">هنوز هیچ مطلبی تحلیل نشده</h3>
            <p className="text-muted-foreground">برای شروع، از دکمه زیر استفاده کنید</p>
            <Button
              onClick={() => {
                console.log("🔵 Opening bulk modal");
                setShowBulkModal(true);
              }}
              size="lg"
            >
              <FileText className="ms-2 h-5 w-5" />
              شروع تحلیل
            </Button>
          </div>
        </div>

        {/* Modal must be rendered even in empty state */}
        <BulkAnalysisModal
          open={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          onComplete={refetch}
        />
      </>
    );
  }

  // Main content
  return (
    <>
      <div className="p-8 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">تحلیل هوشمند</h1>
            <p className="text-muted-foreground mt-2">تحلیل محتوا با هوش مصنوعی و شناسایی تهدیدها</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                console.log("🔵 Opening bulk modal");
                setShowBulkModal(true);
              }}
            >
              <FileText className="ms-2 h-4 w-4" />
              تحلیل گروهی
            </Button>
            <Button variant="outline">
              <Download className="ms-2 h-4 w-4" />
              خروجی گزارش PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard title="کل مطالب تحلیل‌شده" value={stats.analyzed} icon="📊" color="blue" />
          <StatsCard title="تهدید بحرانی" value={stats.critical} icon="🔴" color="red" pulse={stats.critical > 0} />
          <StatsCard title="نیازمند بررسی" value={stats.high} icon="⚠️" color="orange" />
          <StatsCard title="احساسات منفی" value={stats.negative} icon="😟" color="yellow" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <StatsCard
            title="محتوای PsyOp"
            value={stats.psyop}
            icon="🎯"
            color="purple"
          />
          <StatsCard
            title="فقط Quick"
            value={stats.quickOnly}
            icon="⚡"
            color="blue"
          />
          <StatsCard
            title="تحلیل عمیق (Deep)"
            value={stats.deep}
            icon="🧠"
            color="indigo"
          />
          <StatsCard
            title="تحلیل بحران (Deepest)"
            value={stats.deepest}
            icon="🚨"
            color="red"
            pulse={stats.deepest > 0}
          />
        </div>

        {/* Filters */}
        <div className="bg-card border rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-8 gap-4">
            <Input
              placeholder="جستجو در نتایج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="md:col-span-2 text-right"
              dir="rtl"
            />

            <Select value={threatFilter} onValueChange={setThreatFilter}>
              <SelectTrigger>
                <SelectValue placeholder="سطح تهدید" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="Critical">بحرانی</SelectItem>
                <SelectItem value="High">بالا</SelectItem>
                <SelectItem value="Medium">متوسط</SelectItem>
                <SelectItem value="Low">پایین</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="احساسات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="Positive">مثبت</SelectItem>
                <SelectItem value="Neutral">خنثی</SelectItem>
                <SelectItem value="Negative">منفی</SelectItem>
              </SelectContent>
            </Select>

            <Select value={topicFilter} onValueChange={setTopicFilter}>
              <SelectTrigger>
                <SelectValue placeholder="موضوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                {allTopics.map((topic) => (
                  <SelectItem key={topic} value={topic}>
                    {topic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="مرتب‌سازی" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="threat">بر اساس تهدید</SelectItem>
                <SelectItem value="newest">جدیدترین</SelectItem>
                <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={psyopFilter}
              onValueChange={(value) => setPsyopFilter(value as "all" | "psyop" | "non_psyop")}
            >
              <SelectTrigger>
                <SelectValue placeholder="نوع محتوا" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه محتواها</SelectItem>
                <SelectItem value="psyop">فقط محتوای جنگ روانی</SelectItem>
                <SelectItem value="non_psyop">محتوای غیر PsyOp</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={stageFilter}
              onValueChange={(value) => setStageFilter(value as "all" | "quick" | "deep" | "deepest")}
            >
              <SelectTrigger>
                <SelectValue placeholder="مرحله تحلیل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه مراحل</SelectItem>
                <SelectItem value="quick">Quick</SelectItem>
                <SelectItem value="deep">Deep</SelectItem>
                <SelectItem value="deepest">Deepest</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <input
                id="deepest-only"
                type="checkbox"
                checked={deepestOnly}
                onChange={(e) => setDeepestOnly(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="deepest-only" className="text-sm text-muted-foreground">
                فقط موارد دارای تحلیل بحران (Deepest)
              </label>
            </div>
          </div>
        </div>

        {/* Analysis Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {paginatedPosts.map((post) => (
            <AnalysisCard
              key={post.id}
              post={post}
              onViewDetails={() => setSelectedPost(post)}
              onReanalyze={refetch}
            />
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">هیچ نتیجه‌ای با این فیلترها یافت نشد</div>
        )}

        {/* Pagination */}
        {filteredPosts.length > 0 && totalPages > 1 && (
          <div className="flex justify-center mt-8">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>

                {getPageNumbers().map((page, index) =>
                  page === 'ellipsis' ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setCurrentPage(page as number)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* Modals - Always rendered */}
      <BulkAnalysisModal
        open={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onComplete={refetch}
      />

      {selectedPost && (
        <AnalysisDetailModal
          post={selectedPost}
          open={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          onRunDeep={handleRunDeepAnalysis}
          onRunDeepest={handleRunDeepestAnalysis}
        />
      )}
    </>
  );
};

export default AIAnalysis;