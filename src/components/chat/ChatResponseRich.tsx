import { 
  TrendingUp, 
  AlertTriangle, 
  Target, 
  Zap,
  ExternalLink,
  ArrowRight 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface RichResponseProps {
  data: {
    answer: string;
    summary?: string;
    key_stats?: {
      total_psyops?: number;
      critical_threats?: number;
      high_threats?: number;
      active_campaigns?: number;
      urgent_responses_needed?: number;
    };
    top_targets?: Array<{
      entity: string;
      count: number;
      threat?: string;
    }>;
    top_techniques?: Array<{
      technique: string;
      count: number;
    }>;
    top_sources?: Array<{
      source: string;
      count: number;
      credibility?: string;
    }>;
    actionable_insights?: string[];
    recommendations?: string[];
    related_posts?: string[];
  };
}

export function ChatResponseRich({ data }: RichResponseProps) {
  return (
    <div className="space-y-4">
      {/* Summary Box (if exists) */}
      {data.summary && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-r-4 border-blue-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              {data.summary}
            </p>
          </div>
        </div>
      )}

      {/* Key Stats Cards (if exists) */}
      {data.key_stats && Object.keys(data.key_stats).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {data.key_stats.total_psyops !== undefined && (
            <StatCard
              label="کل PsyOp"
              value={data.key_stats.total_psyops}
              icon={AlertTriangle}
              color="red"
            />
          )}
          {data.key_stats.critical_threats !== undefined && (
            <StatCard
              label="بحرانی"
              value={data.key_stats.critical_threats}
              icon={AlertTriangle}
              color="red"
            />
          )}
          {data.key_stats.high_threats !== undefined && (
            <StatCard
              label="اولویت بالا"
              value={data.key_stats.high_threats}
              icon={AlertTriangle}
              color="orange"
            />
          )}
          {data.key_stats.active_campaigns !== undefined && (
            <StatCard
              label="کمپین فعال"
              value={data.key_stats.active_campaigns}
              icon={Target}
              color="yellow"
            />
          )}
          {data.key_stats.urgent_responses_needed !== undefined && (
            <StatCard
              label="نیاز به پاسخ فوری"
              value={data.key_stats.urgent_responses_needed}
              icon={Zap}
              color="purple"
            />
          )}
        </div>
      )}

      {/* Main Answer (Markdown) */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          components={{
            h3: ({node, ...props}) => (
              <h3 className="text-lg font-bold mt-4 mb-2" {...props} />
            ),
            ul: ({node, ...props}) => (
              <ul className="list-disc list-inside space-y-1 mr-4" {...props} />
            ),
            li: ({node, ...props}) => (
              <li className="text-sm" {...props} />
            ),
            strong: ({node, ...props}) => (
              <strong className="font-bold text-gray-900 dark:text-white" {...props} />
            ),
          }}
        >
          {data.answer}
        </ReactMarkdown>
      </div>

      {/* Top Targets Section (if exists) */}
      {data.top_targets && data.top_targets.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            اهداف اصلی حملات
          </h4>
          <div className="space-y-2">
            {data.top_targets.map((target, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium">{target.entity}</span>
                  {target.threat && (
                    <ThreatBadge level={target.threat} />
                  )}
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {target.count} حمله
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Techniques Section (if exists) */}
      {data.top_techniques && data.top_techniques.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            تاکتیک‌های پرکاربرد
          </h4>
          <div className="flex flex-wrap gap-2">
            {data.top_techniques.map((tech, idx) => (
              <div
                key={idx}
                className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full text-xs font-medium"
              >
                {tech.technique} ({tech.count})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Sources Section (if exists) */}
      {data.top_sources && data.top_sources.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-bold mb-3">منابع اصلی حملات</h4>
          <div className="space-y-2">
            {data.top_sources.map((source, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{source.source}</span>
                  {source.credibility === 'Known Enemy Source' && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 rounded text-xs">
                      منبع دشمن
                    </span>
                  )}
                </div>
                <span className="text-gray-600 dark:text-gray-400">
                  {source.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actionable Insights (if exists) */}
      {data.actionable_insights && data.actionable_insights.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="text-sm font-bold mb-2 text-blue-900 dark:text-blue-100">
            💡 نکات کلیدی
          </h4>
          <ul className="space-y-1">
            {data.actionable_insights.map((insight, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations (if exists) */}
      {data.recommendations && data.recommendations.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h4 className="text-sm font-bold mb-2 text-green-900 dark:text-green-100">
            ✅ توصیه‌های عملیاتی
          </h4>
          <ul className="space-y-1">
            {data.recommendations.map((rec, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Related Posts Links (if exists) */}
      {data.related_posts && data.related_posts.length > 0 && (
        <div className="border-t pt-4">
          <button className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            مشاهده {data.related_posts.length} پست مرتبط
          </button>
        </div>
      )}
    </div>
  );
}

// Helper Components
function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: number;
  icon: any;
  color: 'red' | 'orange' | 'yellow' | 'purple';
}) {
  const colorClasses = {
    red: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-100 dark:border-red-800',
    orange: 'bg-orange-50 text-orange-900 border-orange-200 dark:bg-orange-900/20 dark:text-orange-100 dark:border-orange-800',
    yellow: 'bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-100 dark:border-yellow-800',
    purple: 'bg-purple-50 text-purple-900 border-purple-200 dark:bg-purple-900/20 dark:text-purple-100 dark:border-purple-800',
  };

  return (
    <div className={`border rounded-lg p-3 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

function ThreatBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    High: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
    Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[level] || colors.Medium}`}>
      {level}
    </span>
  );
}
