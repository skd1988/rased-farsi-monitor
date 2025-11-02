import { Lightbulb, ChevronLeft } from 'lucide-react';

interface FollowUpSuggestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
}

export function FollowUpSuggestions({ questions, onSelect }: FollowUpSuggestionsProps) {
  if (!questions || questions.length === 0) return null;
  
  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          💡 سوالات پیشنهادی بعدی:
        </span>
      </div>
      
      <div className="space-y-2">
        {questions.map((question, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(question)}
            className="
              w-full text-right px-3 py-2.5 min-h-[44px]
              bg-blue-50 dark:bg-blue-900/20 
              hover:bg-blue-100 dark:hover:bg-blue-900/30
              border border-blue-200 dark:border-blue-800
              rounded-lg
              text-sm text-blue-900 dark:text-blue-100
              transition-all
              flex items-center gap-3
              group
            "
          >
            <div className="w-5 h-5 rounded-full bg-blue-600 dark:bg-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0 font-medium">
              {idx + 1}
            </div>
            <span className="flex-1 text-right">{question}</span>
            <ChevronLeft className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:translate-x-[-2px] transition-transform flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
