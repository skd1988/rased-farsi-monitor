import React from "react";
import StatsCard from "@/components/analysis/StatsCard";
import { AnalyzedPost } from "@/types/analysis";
import { isPsyopPost, normalizeSentimentValue, resolveAnalysisStage } from "./analysisUtils";

interface Props {
  posts: AnalyzedPost[];
}

const AnalysisSummaryCards: React.FC<Props> = ({ posts }) => {
  const completed = posts.filter((p) => p.status === "completed");

  const stats = completed.reduce(
    (acc, post) => {
      const resolvedStage = post.resolved_stage ?? resolveAnalysisStage(post);
      const sentiment = normalizeSentimentValue(post.sentiment);

      if (post.threat_level === "Critical") acc.critical += 1;
      if (post.threat_level === "High") acc.high += 1;
      if (sentiment === "Negative") acc.negative += 1;

      if (resolvedStage === "quick") acc.quickOnly += 1;
      if (resolvedStage === "deep") acc.deep += 1;
      if (resolvedStage === "deepest") acc.deepest += 1;

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
      <StatsCard title="تحلیل عمیق (Deep)" value={stats.deep} icon="🔬" color="orange" />
      <StatsCard title="تحلیل بحران (Deepest)" value={stats.deepest} icon="🔥" color="red" pulse={stats.deepest > 0} />
    </div>
  );
};

export default AnalysisSummaryCards;
