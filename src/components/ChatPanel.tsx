import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Trash2 } from 'lucide-react';
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

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

const ChatPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
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
  }, [messages]);

  const handleSend = (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: text,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');

    // Mock AI response after 1 second
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "این یک پاسخ آزمایشی است. قابلیت اتصال به API در مرحله بعد اضافه می‌شود.",
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
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
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-3">
                      سوالات پیشنهادی:
                    </p>
                    {quickPrompts.map((prompt, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        onClick={() => handleQuickPrompt(prompt)}
                        className="w-full justify-end text-right p-3 h-auto bg-muted/50 hover:bg-muted text-sm"
                      >
                        {prompt}
                      </Button>
                    ))}
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
                          className={`max-w-[85%] rounded-lg p-3 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{message.content}</p>
                        </div>
                        <span className="text-xs text-muted-foreground opacity-70 mt-1">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    ))}
                    <div ref={scrollRef} />
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  size="icon"
                  className="shrink-0"
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
