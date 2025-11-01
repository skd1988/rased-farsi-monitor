import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Search,
  TrendingUp,
  AlertTriangle,
  FileText,
  Globe,
} from 'lucide-react';

interface QuickPromptsProps {
  onSelectPrompt: (prompt: string) => void;
}

const QuickPrompts = ({ onSelectPrompt }: QuickPromptsProps) => {
  const quickActions = [
    {
      icon: BarChart,
      label: '📊 آمار امروز',
      prompt: 'آمار مطالب امروز را نشان بده',
    },
    {
      icon: Search,
      label: '🔍 جستجو در مطالب',
      prompt: 'مطالب مهم امروز را نشان بده',
    },
    {
      icon: TrendingUp,
      label: '📈 تحلیل ترندها',
      prompt: 'ترند کلمات کلیدی 7 روز اخیر چیه؟',
    },
    {
      icon: AlertTriangle,
      label: '⚠️ هشدارهای فعال',
      prompt: 'مطالب با سطح تهدید بالا را نشان بده',
    },
  ];

  const suggestedPrompts = [
    'مطالب امروز با threat level بالا',
    'ترند کلمات کلیدی 7 روز اخیر',
    'منابع با محتوای منفی',
    'کمپین‌های هماهنگ شده',
    'خلاصه وضعیت امروز',
    'تحلیل منبع الجزیره',
  ];

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action, idx) => (
          <Card
            key={idx}
            className="p-4 cursor-pointer hover:bg-accent transition-colors group"
            onClick={() => onSelectPrompt(action.prompt)}
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <action.icon className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium">{action.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Suggested Prompts */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
          پرسش‌های پیشنهادی:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {suggestedPrompts.map((prompt, idx) => (
            <Button
              key={idx}
              variant="outline"
              className="justify-start h-auto py-3 text-right"
              onClick={() => onSelectPrompt(prompt)}
            >
              <span className="mr-2">💬</span>
              {prompt}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickPrompts;
