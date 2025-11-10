import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import QuickPrompts from "@/components/chat/QuickPrompts";
import { ChatActions } from "@/components/chat/ChatActions";
import { Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: any;
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
  followUpQuestions?: string[];
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    console.log("🔄 Loading conversations...");

    const { data, error } = await supabase
      .from("chat_conversations")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("❌ Error loading conversations:", error);
      toast({
        title: "خطا در بارگذاری گفتگوها",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    console.log(`✅ Loaded ${data?.length || 0} conversations`);
    setConversations(data || []);
  };

  const loadMessages = async (conversationId: string) => {
    console.log("=== Loading messages for conversation:", conversationId);

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("timestamp", { ascending: true });

    if (error) {
      console.error("Error loading messages:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return;
    }

    console.log(`📨 Loading ${data?.length || 0} messages...`);

    setMessages(
      (data || []).map((msg) => {
        const message = {
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          metadata: msg.metadata,
          structured_data: msg.metadata?.structured_data || null,
          followUpQuestions: msg.metadata?.followUpQuestions || [],
        };

        // Debug log for first message
        if (msg.role === "assistant") {
          console.log("💬 Loaded assistant message:", {
            hasStructuredData: !!message.structured_data,
            hasFollowUps: message.followUpQuestions.length > 0,
          });
        }

        return message;
      }),
    );

    console.log("✅ Messages loaded successfully");
  };

  const createNewConversation = async () => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "خطا",
        description: "لطفاً ابتدا وارد شوید",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ title: "گفتگوی جدید", user_id: user.id })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      toast({
        title: "خطا",
        description: "ایجاد گفتگو با خطا مواجه شد",
        variant: "destructive",
      });
      return;
    }

    setCurrentConversationId(data.id);
    setMessages([]);
    loadConversations();
  };

  const deleteConversation = async (conversationId: string) => {
    const { error } = await supabase.from("chat_conversations").delete().eq("id", conversationId);

    if (error) {
      console.error("Error deleting conversation:", error);
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
      .from("chat_conversations")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    if (error) {
      console.error("Error updating title:", error);
      return;
    }

    loadConversations();
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    console.log("=== START: Sending message ===");
    console.log("Message content:", content);
    console.log("Current state:", {
      conversationId: currentConversationId,
      messagesCount: messages.length,
      isLoading,
    });

    // Create conversation if needed
    let conversationId = currentConversationId;
    if (!conversationId) {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "خطا",
          description: "لطفاً ابتدا وارد شوید",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({ title: content.substring(0, 50), user_id: user.id })
        .select()
        .single();

      if (error || !data) {
        console.error("Error creating conversation:", error);
        toast({
          title: "خطا",
          description: "ایجاد گفتگو با خطا مواجه شد",
          variant: "destructive",
        });
        return;
      }

      conversationId = data.id;
      setCurrentConversationId(conversationId);
      loadConversations();
    }

    // Add user message to UI immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Save user message to database
    const { error: userSaveError } = await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    });

    if (userSaveError) {
      console.error("❌ Error saving user message:", userSaveError);
      toast({
        title: "خطا در ذخیره پیام",
        description: userSaveError.message,
        variant: "destructive",
      });
      return;
    }

    console.log("✅ User message saved successfully");

    // Build conversation history (last 10 messages)
    const conversationHistory = messages.slice(-10).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    console.log("Conversation history length:", conversationHistory.length);

    // ✅ Call Edge Function with streaming
    setIsLoading(true);

    // Add temporary assistant message for streaming
    const streamingMessageId = (Date.now() + 1).toString();
    const streamingMessage: Message = {
      id: streamingMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, streamingMessage]);

    try {
      console.log("Calling chat-assistant Edge Function with streaming...");

      // Get the function URL
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = supabase.supabaseUrl;
      const functionUrl = `${supabaseUrl}/functions/v1/chat-assistant?stream=true`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          question: content,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let streamedContent = '';
      let finalData: any = null;

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'content') {
                streamedContent += data.content;

                // Update message in real-time
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === streamingMessageId
                      ? { ...msg, content: streamedContent }
                      : msg
                  )
                );
              } else if (data.type === 'complete') {
                finalData = data.data;
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error('Error parsing SSE:', e);
            }
          }
        }
      }

      console.log("✅ Streaming completed");

      // Update with final structured data
      const finalMessage: Message = {
        id: streamingMessageId,
        role: "assistant",
        content: finalData?.answer || streamedContent,
        timestamp: new Date(),
        metadata: {
          sources: finalData?.sources,
          statistics: finalData?.statistics,
          keyFindings: finalData?.keyFindings,
          recommendations: finalData?.recommendations,
        },
        structured_data: {
          answer: finalData?.answer || streamedContent,
          summary: finalData?.summary,
          key_stats: finalData?.key_stats,
          top_targets: finalData?.top_targets,
          top_techniques: finalData?.top_techniques,
          top_sources: finalData?.top_sources,
          actionable_insights: finalData?.actionable_insights,
          recommendations: finalData?.recommendations,
          related_posts: finalData?.related_posts,
        },
        followUpQuestions: [], // Will be generated after streaming
      };

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === streamingMessageId ? finalMessage : msg
        )
      );

      // Save to database with complete metadata
      const completeMetadata = {
        sources: finalData?.sources,
        statistics: finalData?.statistics,
        keyFindings: finalData?.keyFindings,
        recommendations: finalData?.recommendations,
        structured_data: finalMessage.structured_data,
        followUpQuestions: [],
      };

      const { error: aiSaveError } = await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: finalMessage.content,
        metadata: completeMetadata,
        timestamp: new Date().toISOString(),
      });

      if (aiSaveError) {
        console.error("❌ Error saving AI message:", aiSaveError);
        toast({
          title: "خطا در ذخیره پاسخ",
          description: aiSaveError.message,
          variant: "destructive",
        });
      }

      // Update conversation timestamp
      await supabase
        .from("chat_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      console.log("✅ Streaming message saved successfully");
      console.log("=== END: Message sent successfully ===");
    } catch (error) {
      console.error("=== ERROR in streaming ===");
      console.error("Error details:", error);
      console.error("Error type:", typeof error);
      console.error("Error object:", JSON.stringify(error, null, 2));

      // Remove streaming message and show error
      setMessages((prev) => prev.filter(msg => msg.id !== streamingMessageId));

      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `❌ خطا در دریافت پاسخ: ${error instanceof Error ? error.message : "خطای نامشخص"}

لطفاً موارد زیر را بررسی کنید:
- اتصال اینترنت
- تنظیمات DEEPSEEK_API_KEY
- Console برای جزئیات بیشتر

سپس دوباره تلاش کنید.`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);

      toast({
        title: "خطا",
        description: "خطا در دریافت پاسخ",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const handleFollowUpSelect = (question: string) => {
    handleSendMessage(question);
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
                  ? conversations.find((c) => c.id === currentConversationId)?.title || "گفتگو"
                  : "گفتگو با داده‌ها"}
              </h1>
              <p className="text-sm text-muted-foreground">DeepSeek-V3</p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-8 chat-messages">
          {messages.length === 0 ? (
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12 animate-in fade-in duration-500">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mb-6 animate-in zoom-in duration-300 delay-150">
                  <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                </div>
                <h2 className="text-3xl font-bold mb-3 bg-gradient-to-l from-primary to-primary/60 bg-clip-text text-transparent">
                  🛡️ سلام! من دستیار تحلیل عملیات روانی هستم
                </h2>
                <p className="text-muted-foreground text-lg mb-2">
                  می‌توانم در شناسایی، تحلیل و پاسخ به جنگ روانی علیه محور مقاومت به شما کمک کنم
                </p>
                <p className="text-sm text-muted-foreground/80">
                  💡 درباره PsyOp های شناسایی‌شده، اهداف حملات، کمپین‌های هماهنگ، و استراتژی پاسخ‌دهی سوال بپرسید
                </p>
              </div>

              <QuickPrompts onSelectPrompt={handleQuickPrompt} />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8">
              {messages.map((message) => (
                <ChatMessage 
                  key={message.id} 
                  message={message}
                  onFollowUpSelect={handleFollowUpSelect}
                />
              ))}
              {isLoading && (
                <div className="flex items-start gap-4">
                  {/* Avatar skeleton */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted animate-pulse" />

                  {/* Content skeleton */}
                  <div className="flex-1 space-y-3 bg-muted rounded-2xl rounded-tr-sm p-4 max-w-[85%]">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span className="text-sm text-muted-foreground mr-2">در حال تحلیل...</span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-background/50 rounded animate-pulse w-full" />
                      <div className="h-3 bg-background/50 rounded animate-pulse w-5/6" />
                      <div className="h-3 bg-background/50 rounded animate-pulse w-4/6" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        {messages.length > 0 && (
          <ChatActions 
            messages={messages} 
            conversationId={currentConversationId || undefined}
          />
        )}
        <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default Chat;
