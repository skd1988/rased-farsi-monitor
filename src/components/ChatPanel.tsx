import React, { useState } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
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

  const handleSend = () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
            <DrawerTitle className="flex items-center gap-2 text-right">
              <span>گفتگو با داده‌ها</span>
              <MessageSquare className="h-5 w-5 text-primary" />
            </DrawerTitle>
          </DrawerHeader>

          {/* Content Area */}
          <div className="flex flex-col h-[calc(100vh-140px)]">
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <div className="space-y-4">
                    <div className="text-muted-foreground">
                      سوال خود را بپرسید یا از پیشنهادهای زیر استفاده کنید
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4" dir="rtl">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === 'user' ? 'justify-start' : 'justify-end'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Button
                  onClick={handleSend}
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
