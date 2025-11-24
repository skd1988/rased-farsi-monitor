import React from "react";
import StatsCard from "@/components/analysis/StatsCard";
import { AnalyzedPost } from "@/types/analysis";
import { isPsyopPost, normalizeSentimentValue, resolveAnalysisStage } from "./analysisUtils";

interface Props {
  posts: AnalyzedPost[];
}

const AnalysisSummaryCards: React.FC<Props> = ({ posts }) => {
  const completed = posts.filter((p) => p.status === "completed");

  const analyzed = completed.length;
  const critical = completed.filter((p) => p.threat_level === "Critical").length;
  const high = completed.filter((p) => p.threat_level === "High").length;
  const negative = completed.filter((p) => normalizeSentimentValue(p.sentiment) === "Negative").length;

  const quickOnly = completed.filter((p) => resolveAnalysisStage(p) === "quick");
  const deep = completed.filter((p) => resolveAnalysisStage(p) === "deep");
  const deepest = completed.filter((p) => resolveAnalysisStage(p) === "deepest");

  const psyopPosts = completed.filter((p) => isPsyopPost(p));

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <StatsCard title="تحلیل شده" value={analyzed} icon="🤖" color="blue" />
      <StatsCard title="تهدید بحرانی" value={critical} icon="🔴" color="red" pulse={critical > 0} />
      <StatsCard title="نیازمند بررسی" value={high} icon="⚠️" color="orange" />
      <StatsCard title="احساسات منفی" value={negative} icon="😟" color="yellow" />

      <StatsCard title="محتوای جنگ روانی (PsyOp)" value={psyopPosts.length} icon="🎯" color="red" />
      <StatsCard title="فقط Quick" value={quickOnly.length} icon="⚡" color="blue" />
      <StatsCard title="تحلیل عمیق (Deep)" value={deep.length} icon="🔬" color="orange" />
      <StatsCard title="تحلیل بحران (Deepest)" value={deepest.length} icon="🔥" color="red" pulse={deepest.length > 0} />
    </div>
  );
};

export default AnalysisSummaryCards;
