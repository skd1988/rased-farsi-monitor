import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatMessage from '@/components/chat/ChatMessage';
import ChatInput from '@/components/chat/ChatInput';
import QuickPrompts from '@/components/chat/QuickPrompts';
import { Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: any;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

const Chat = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId);
    }
  }, [currentConversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading conversations:', error);
      return;
    }

    setConversations(data || []);
  };

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    setMessages(
      (data || []).map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        metadata: msg.metadata,
      }))
    );
  };

  const createNewConversation = async () => {
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({ title: 'گفتگوی جدید' })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: 'خطا',
        description: 'ایجاد گفتگو با خطا مواجه شد',
        variant: 'destructive',
      });
      return;
    }

    setCurrentConversationId(data.id);
    setMessages([]);
    loadConversations();
  };

  const deleteConversation = async (conversationId: string) => {
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error('Error deleting conversation:', error);
      return;
    }

    if (currentConversationId === conversationId) {
      setCurrentConversationId(null);
      setMessages([]);
    }

    loadConversations();
  };

  const updateConversationTitle = async (conversationId: string, title: string) => {
    const { error } = await supabase
      .from('chat_conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (error) {
      console.error('Error updating title:', error);
      return;
    }

    loadConversations();
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    // Create conversation if needed
    let conversationId = currentConversationId;
    if (!conversationId) {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({ title: content.substring(0, 50) })
        .select()
        .single();

      if (error || !data) {
        toast({
          title: 'خطا',
          description: 'ایجاد گفتگو با خطا مواجه شد',
          variant: 'destructive',
        });
        return;
      }

      conversationId = data.id;
      setCurrentConversationId(conversationId);
      loadConversations();
    }

    // Add user message to UI
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Save user message to database
    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content,
    });

    // Build conversation history (last 10 messages)
    const conversationHistory = messages.slice(-10).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Call chat API with conversation history
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('chat-with-data', {
        body: { 
          question: content,
          conversationHistory 
        },
      });

      if (response.error) throw response.error;

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.answer,
        timestamp: new Date(),
        metadata: {
          sources: response.data.sources,
          statistics: response.data.statistics,
          keyFindings: response.data.keyFindings,
        },
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Save AI message to database
      await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: aiMessage.content,
        metadata: aiMessage.metadata,
      });

      // Update conversation timestamp
      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'خطا',
        description: 'ارسال پیام با خطا مواجه شد',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    handleSendMessage(prompt);
  };

  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={setCurrentConversationId}
        onNewConversation={createNewConversation}
        onDeleteConversation={deleteConversation}
        onUpdateTitle={updateConversationTitle}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">
                {currentConversationId
                  ? conversations.find((c) => c.id === currentConversationId)?.title || 'گفتگو'
                  : 'گفتگو با داده‌ها'}
              </h1>
              <p className="text-sm text-muted-foreground">DeepSeek-V3</p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          {messages.length === 0 ? (
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-3xl font-bold mb-2">👋 سلام! چطور می‌تونم کمکتون کنم؟</h2>
                <p className="text-muted-foreground">
                  می‌تونید سوالی درباره داده‌های رسانه‌ای بپرسید
                </p>
              </div>

              <QuickPrompts onSelectPrompt={handleQuickPrompt} />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default Chat;
