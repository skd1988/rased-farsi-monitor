import React from "react";
import StatsCard from "@/components/analysis/StatsCard";
import { AnalyzedPost } from "@/types/analysis";
import { isPsyopPost, normalizeSentimentValue } from "./analysisUtils";

interface Props {
  posts: AnalyzedPost[];
}

const AnalysisSummaryCards: React.FC<Props> = ({ posts }) => {
  const completed = posts.filter((p) => {
    const anyStageDone =
      (p as any).quick_analyzed_at ||
      (p as any).deep_analyzed_at ||
      (p as any).deepest_analysis_completed_at ||
      p.analyzed_at ||
      (p as any).analysis_stage;

    return Boolean(anyStageDone);
  });

  const stats = completed.reduce(
    (acc, post) => {
      const sentiment = normalizeSentimentValue(post.sentiment);

      if (post.threat_level === "Critical") acc.critical += 1;
      if (post.threat_level === "High") acc.high += 1;
      if (sentiment === "Negative") acc.negative += 1;

      const hasQuick = Boolean((post as any).quick_analyzed_at);
      const hasDeep = Boolean((post as any).deep_analyzed_at);
      const hasDeepest = Boolean((post as any).deepest_analysis_completed_at);

      if (hasQuick && !hasDeep && !hasDeepest) acc.quickOnly += 1;
      if (hasDeep && !hasDeepest) acc.deep += 1;
      if (hasDeepest) acc.deepest += 1;

      if (isPsyopPost(post)) acc.psyop += 1;

      return acc;
    },
    {
      critical: 0,
      high: 0,
      negative: 0,
      quickOnly: 0,
      deep: 0,
      deepest: 0,
      psyop: 0,
    },
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <StatsCard title="تحلیل شده" value={completed.length} icon="🤖" color="blue" />
      <StatsCard title="تهدید بحرانی" value={stats.critical} icon="🔴" color="red" pulse={stats.critical > 0} />
      <StatsCard title="نیازمند بررسی" value={stats.high} icon="⚠️" color="orange" />
      <StatsCard title="احساسات منفی" value={stats.negative} icon="😟" color="yellow" />

      <StatsCard title="محتوای جنگ روانی (PsyOp)" value={stats.psyop} icon="🎯" color="red" />
      <StatsCard title="فقط Quick" value={stats.quickOnly} icon="⚡" color="blue" />
      <StatsCard title="تحلیل عمیق (Deep بدون بحران)" value={stats.deep} icon="🔬" color="orange" />
      <StatsCard title="تحلیل بحران (Deepest)" value={stats.deepest} icon="🔥" color="red" pulse={stats.deepest > 0} />
    </div>
  );
};

export default AnalysisSummaryCards;
