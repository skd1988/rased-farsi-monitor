import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AnalyzedPost, AnalysisStage, SentimentValue, UrgencyLevel, ViralityPotential } from "@/types/analysis";
import { isPsyopPost, normalizeSentimentValue, resolveAnalysisStage } from "@/components/analysis/analysisUtils";

const normalizeStageValue = (stage: AnalyzedPost["analysis_stage"]): AnalysisStage => {
  if (stage === "quick" || stage === "deep" || stage === "deepest") return stage;
  return null;
};

export function useAnalyzedPosts() {
  const [posts, setPosts] = useState<AnalyzedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyzedPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let allPosts: AnalyzedPost[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error: fetchError } = await supabase
          .from("posts")
          .select("*")
          .or("analyzed_at.not.is.null,quick_analyzed_at.not.is.null")
          .order("analyzed_at", { ascending: false, nullsFirst: false })
          .order("quick_analyzed_at", { ascending: false, nullsFirst: false })
          .range(from, from + batchSize - 1);

        if (fetchError) throw fetchError;

        if (data && data.length > 0) {
          const mapped = data.map((row) => {
            const normalizedStage = normalizeStageValue(row.analysis_stage as AnalysisStage);
            const normalizedSentiment = normalizeSentimentValue(row.sentiment as SentimentValue);

            const post: AnalyzedPost = {
              ...row,
              analysis_stage: normalizedStage,
              sentiment: normalizedSentiment ?? row.sentiment,
              urgency_level: (row.urgency_level as UrgencyLevel) ?? null,
              virality_potential: (row.virality_potential as ViralityPotential) ?? null,
              threat_level: (row.threat_level as AnalyzedPost["threat_level"]) ?? null,
              status: (row.status as AnalyzedPost["status"]) ?? "pending",
            };

            post.resolved_stage = resolveAnalysisStage(post);
            (post as any).is_psyop_resolved = isPsyopPost(post);

            return post;
          });

          allPosts = [...allPosts, ...mapped];
          from += batchSize;

          if (data.length < batchSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      const sorted = allPosts.sort((a, b) => {
        const aDate =
          new Date(a.analyzed_at || a.quick_analyzed_at || a.published_at || 0).getTime();
        const bDate =
          new Date(b.analyzed_at || b.quick_analyzed_at || b.published_at || 0).getTime();
        return bDate - aDate;
      });

      setPosts(sorted);
    } catch (err) {
      console.error("Error fetching analyzed posts:", err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyzedPosts();
  }, [fetchAnalyzedPosts]);

  return { posts, loading, error, refetch: fetchAnalyzedPosts } as const;
}

export default useAnalyzedPosts;
