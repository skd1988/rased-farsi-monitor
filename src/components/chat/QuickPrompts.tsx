import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Shield,
  Target,
  Zap,
  Network,
  BarChart3,
} from 'lucide-react';

interface QuickPromptsProps {
  onSelectPrompt: (prompt: string) => void;
}

const QuickPrompts = ({ onSelectPrompt }: QuickPromptsProps) => {
  const quickAnalysisPrompts = [
    {
      id: 1,
      icon: AlertTriangle,
      text: '🚨 چند PsyOp امروز شناسایی شد و کدوم نهادها هدف بودند؟',
      color: 'border-red-500',
      iconColor: 'text-red-500',
    },
    {
      id: 2,
      icon: Shield,
      text: '⚠️ بحرانی‌ترین تهدیدات فعلی چی هستند؟',
      color: 'border-orange-500',
      iconColor: 'text-orange-500',
    },
    {
      id: 6,
      icon: BarChart3,
      text: '📊 خلاصه وضعیت امنیت اطلاعاتی',
      color: 'border-green-500',
      iconColor: 'text-green-500',
    },
  ];

  const targetAnalysisPrompts = [
    {
      id: 3,
      icon: Target,
      text: '🎯 محبوب‌ترین اهداف حملات این هفته کدومن؟',
      color: 'border-blue-500',
      iconColor: 'text-blue-500',
    },
    {
      id: 4,
      icon: Zap,
      text: '🔧 کدوم تاکتیک‌های جنگ روانی بیشتر استفاده شده؟',
      color: 'border-purple-500',
      iconColor: 'text-purple-500',
    },
  ];

  const campaignPrompts = [
    {
      id: 5,
      icon: Network,
      text: '🕸️ آیا کمپین هماهنگ‌شده‌ای فعال هست؟',
      color: 'border-yellow-500',
      iconColor: 'text-yellow-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Quick Analysis */}
      <div>
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground">
          🔍 تحلیل سریع:
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {quickAnalysisPrompts.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => onSelectPrompt(prompt.text)}
              className={`
                w-full text-right p-4 rounded-lg
                bg-gray-50 dark:bg-gray-800/50
                hover:bg-gray-100 dark:hover:bg-gray-700/50
                border-r-4 ${prompt.color}
                transition-all hover:scale-[1.02] active:scale-[0.98]
                flex items-center gap-3
                group
              `}
            >
              <prompt.icon className={`w-5 h-5 ${prompt.iconColor} flex-shrink-0`} />
              <span className="flex-1 text-sm font-medium">{prompt.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Target Analysis */}
      <div>
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground">
          🎯 تحلیل اهداف و تاکتیک‌ها:
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {targetAnalysisPrompts.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => onSelectPrompt(prompt.text)}
              className={`
                w-full text-right p-4 rounded-lg
                bg-gray-50 dark:bg-gray-800/50
                hover:bg-gray-100 dark:hover:bg-gray-700/50
                border-r-4 ${prompt.color}
                transition-all hover:scale-[1.02] active:scale-[0.98]
                flex items-center gap-3
                group
              `}
            >
              <prompt.icon className={`w-5 h-5 ${prompt.iconColor} flex-shrink-0`} />
              <span className="flex-1 text-sm font-medium">{prompt.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Campaign Detection */}
      <div>
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground">
          🕸️ شناسایی کمپین:
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {campaignPrompts.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => onSelectPrompt(prompt.text)}
              className={`
                w-full text-right p-4 rounded-lg
                bg-gray-50 dark:bg-gray-800/50
                hover:bg-gray-100 dark:hover:bg-gray-700/50
                border-r-4 ${prompt.color}
                transition-all hover:scale-[1.02] active:scale-[0.98]
                flex items-center gap-3
                group
              `}
            >
              <prompt.icon className={`w-5 h-5 ${prompt.iconColor} flex-shrink-0`} />
              <span className="flex-1 text-sm font-medium">{prompt.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickPrompts;
