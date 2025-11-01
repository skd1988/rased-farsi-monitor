import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: {
    processingTime?: number;
  };
  statistics?: Record<string, number>;
  keyFindings?: string[];
  sources?: {
    posts?: string[];
    analysis?: string[];
  };
  isError?: boolean;
}

const ChatPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    "مطالب امروز با threat level بالا رو نشون بده",
    "ترند کلمات کلیدی 7 روز اخیر چیه؟",
    "منابعی که بیشترین محتوای منفی دارن کدومن؟",
    "آیا کمپین هماهنگ شده‌ای شناسایی شده؟",
    "خلاصه‌ای از وضعیت امروز بده"
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: text,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-with-data', {
        body: { question: text, context: 'last_30_days' }
      });

      if (error) throw error;

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.answer || "متأسفم، خطایی رخ داده است.",
        role: 'assistant',
        timestamp: new Date(),
        metadata: data.metadata,
        statistics: data.statistics,
        keyFindings: data.keyFindings,
        sources: data.sources,
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "متأسفم، خطایی در ارتباط با سرور رخ داده است. لطفاً دوباره تلاش کنید.",
        role: 'assistant',
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleQuickPrompt = (prompt: string) => {
    handleSend(prompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Floating Chat Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-[60px] w-[60px] rounded-full bg-primary hover:bg-primary/90 shadow-lg z-50 transition-all duration-200"
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>

      {/* Chat Drawer */}
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="fixed inset-y-0 right-0 left-auto h-screen w-full sm:w-[450px] rounded-none border-l">
          {/* Header */}
          <DrawerHeader className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearChat}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <DrawerTitle className="flex items-center gap-2 text-right">
              <span>گفتگو با داده‌ها</span>
              <MessageSquare className="h-5 w-5 text-primary" />
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              چت هوش مصنوعی برای تحلیل داده‌ها
            </DrawerDescription>
          </DrawerHeader>

          {/* Content Area */}
          <div className="flex flex-col h-[calc(100vh-140px)]">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4" dir="rtl">
                {messages.length === 0 ? (
                  <div className="space-y-6">
                    <div className="text-center space-y-2">
                      <p className="text-lg text-foreground">
                        👋 سلام! چطور می‌تونم کمکتون کنم؟
                      </p>
                      <p className="text-sm text-muted-foreground">
                        می‌تونید سوالی درباره داده‌های رسانه‌ای بپرسید یا از پیشنهادهای زیر استفاده کنید
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground mb-3">
                        سوالات پیشنهادی:
                      </p>
                      {quickPrompts.map((prompt, index) => (
                        <Button
                          key={index}
                          variant="ghost"
                          onClick={() => handleQuickPrompt(prompt)}
                          disabled={isLoading}
                          className="w-full justify-end text-right p-3 h-auto bg-muted/50 hover:bg-muted text-sm transition-all duration-200 hover:shadow-sm disabled:opacity-50"
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex flex-col ${
                          message.role === 'user' ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg p-3 shadow-sm ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : message.isError
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </p>

                          {/* Metadata section for AI messages */}
                          {message.role === 'assistant' && !message.isError && (
                            <>
                              {/* Statistics */}
                              {message.statistics && Object.keys(message.statistics).length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border">
                                  <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(message.statistics).map(([key, value]) => (
                                      <div key={key} className="bg-background p-2 rounded text-xs">
                                        <div className="text-muted-foreground">{key}</div>
                                        <div className="font-semibold">{value}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Key Findings */}
                              {message.keyFindings && message.keyFindings.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border">
                                  <p className="font-semibold text-xs mb-1">نکات کلیدی:</p>
                                  <ul className="list-disc list-inside space-y-1 text-xs">
                                    {message.keyFindings.map((finding, idx) => (
                                      <li key={idx}>{finding}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Sources */}
                              {message.sources && (message.sources.posts?.length || message.sources.analysis?.length) && (
                                <div className="mt-3 pt-3 border-t border-border">
                                  <p className="font-semibold text-xs mb-2">
                                    منابع ({(message.sources.posts?.length || 0) + (message.sources.analysis?.length || 0)}):
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {[...(message.sources.posts || []), ...(message.sources.analysis || [])]
                                      .slice(0, 5)
                                      .map((source, idx) => (
                                        <span
                                          key={idx}
                                          className="bg-primary/10 text-primary px-2 py-1 rounded text-xs"
                                        >
                                          {source}
                                        </span>
                                      ))}
                                    {((message.sources.posts?.length || 0) + (message.sources.analysis?.length || 0)) > 5 && (
                                      <span className="text-xs text-muted-foreground">
                                        +{((message.sources.posts?.length || 0) + (message.sources.analysis?.length || 0)) - 5} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Processing Time */}
                              {message.metadata?.processingTime && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  پردازش شد در {(message.metadata.processingTime / 1000).toFixed(1)} ثانیه
                                </p>
                              )}
                            </>
                          )}

                          {/* Retry button for errors */}
                          {message.isError && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSend(messages[messages.findIndex(m => m.id === message.id) - 1]?.content)}
                              className="mt-2 text-xs"
                            >
                              تلاش مجدد
                            </Button>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground opacity-70 mt-1">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex flex-col items-start">
                        <div className="bg-muted rounded-lg p-3 shadow-sm flex items-center gap-2">
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                          <span className="text-sm text-muted-foreground">در حال تایپ...</span>
                        </div>
                      </div>
                    )}
                    <div ref={scrollRef} />
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t p-4 bg-background">
              <div className="flex gap-2">
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="shrink-0 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </Button>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="سوال خود را بپرسید..."
                  className="flex-1 text-right"
                  dir="rtl"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default ChatPanel;
