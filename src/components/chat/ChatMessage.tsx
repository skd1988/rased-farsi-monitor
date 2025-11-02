import { Bot, User, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ChatResponseRich } from './ChatResponseRich';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    sources?: { posts?: string[] };
    statistics?: Record<string, any>;
    keyFindings?: string[];
  };
  structured_data?: {
    answer: string;
    summary?: string;
    key_stats?: any;
    top_targets?: any[];
    top_techniques?: any[];
    top_sources?: any[];
    actionable_insights?: string[];
    recommendations?: string[];
    related_posts?: string[];
  };
}

interface ChatMessageProps {
  message: Message;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const { toast } = useToast();
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast({
      title: 'کپی شد',
      description: 'متن در کلیپ‌بورد کپی شد',
    });
  };

  return (
    <div className={cn('flex gap-4', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      {/* Content */}
      <div className={cn('flex-1 space-y-2', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'inline-block rounded-2xl max-w-[85%]',
            isUser
              ? 'bg-primary text-primary-foreground px-4 py-3'
              : 'bg-muted px-4 py-3'
          )}
        >
          {!isUser && message.structured_data ? (
            <ChatResponseRich data={message.structured_data} />
          ) : (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          )}
        </div>

        {/* Metadata Cards - Only show if no structured_data */}
        {!isUser && message.metadata && !message.structured_data && (
          <div className="space-y-2 max-w-[80%]">
            {message.metadata.statistics && (
              <Card className="p-4">
                <h4 className="font-semibold mb-2 text-sm">📊 آمار</h4>
                <div className="text-sm space-y-1">
                  {Object.entries(message.metadata.statistics).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {message.metadata.keyFindings && message.metadata.keyFindings.length > 0 && (
              <Card className="p-4">
                <h4 className="font-semibold mb-2 text-sm">🔍 یافته‌های کلیدی</h4>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  {message.metadata.keyFindings.map((finding, idx) => (
                    <li key={idx}>{finding}</li>
                  ))}
                </ul>
              </Card>
            )}

            {message.metadata.sources?.posts && message.metadata.sources.posts.length > 0 && (
              <Card className="p-4">
                <h4 className="font-semibold mb-2 text-sm">📄 منابع</h4>
                <div className="flex flex-wrap gap-2">
                  {message.metadata.sources.posts.map((postId) => (
                    <span
                      key={postId}
                      className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-mono"
                    >
                      {postId}
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Actions */}
        {!isUser && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              <Copy className="w-4 h-4 mr-2" />
              کپی
            </Button>
            <Button variant="ghost" size="sm">
              <ThumbsUp className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <ThumbsDown className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
