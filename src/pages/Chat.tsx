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
    const { data, error } = await supabase
      .from("chat_conversations")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error loading conversations:", error);
      return;
    }

    setConversations(data || []);
  };

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("timestamp", { ascending: true });

    if (error) {
      console.error("Error loading messages:", error);
      return;
    }

    setMessages(
      (data || []).map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        metadata: msg.metadata,
      })),
    );
  };

  const createNewConversation = async () => {
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ title: "گفتگوی جدید" })
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

    // Create conversation if needed
    let conversationId = currentConversationId;
    if (!conversationId) {
      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({ title: content.substring(0, 50) })
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
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content,
    });

    // Build conversation history (last 10 messages)
    const conversationHistory = messages.slice(-10).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    console.log("Conversation history length:", conversationHistory.length);

    // Call Edge Function - NO MOCKS!
    setIsLoading(true);
    try {
      console.log("Calling chat-assistant Edge Function...");

      const response = await supabase.functions.invoke("chat-assistant", {
        body: {
          question: content,
          conversationHistory,
        },
      });

      console.log("Response received:", response);

      if (response.error) {
        console.error("Edge Function error:", response.error);
        throw response.error;
      }

      if (!response.data || !response.data.answer) {
        console.error("Invalid response data:", response.data);
        throw new Error("Invalid response from API");
      }

      console.log("AI Answer:", response.data.answer);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.data.answer,
        timestamp: new Date(),
        metadata: {
          sources: response.data.sources,
          statistics: response.data.statistics,
          keyFindings: response.data.keyFindings,
          recommendations: response.data.recommendations,
        },
        structured_data: {
          answer: response.data.answer,
          summary: response.data.summary,
          key_stats: response.data.key_stats,
          top_targets: response.data.top_targets,
          top_techniques: response.data.top_techniques,
          top_sources: response.data.top_sources,
          actionable_insights: response.data.actionable_insights,
          recommendations: response.data.recommendations,
          related_posts: response.data.related_posts,
        },
        followUpQuestions: response.data.followUpQuestions || [],
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Save AI message to database
      await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: aiMessage.content,
        metadata: aiMessage.metadata,
      });

      // Update conversation timestamp
      await supabase
        .from("chat_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      console.log("=== END: Message sent successfully ===");
    } catch (error) {
      console.error("=== ERROR in handleSendMessage ===");
      console.error("Error details:", error);
      console.error("Error type:", typeof error);
      console.error("Error object:", JSON.stringify(error, null, 2));

      // Show detailed error in chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `❌ خطا در ارسال پیام:

${error instanceof Error ? error.message : "خطای نامشخص"}

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
        description: "ارسال پیام با خطا مواجه شد - Console را چک کنید",
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
        <div className="flex-1 overflow-y-auto px-6 py-8">
          {messages.length === 0 ? (
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-3xl font-bold mb-2">🛡️ سلام! من دستیار تحلیل عملیات روانی هستم</h2>
                <p className="text-muted-foreground">می‌توانم در شناسایی، تحلیل و پاسخ به جنگ روانی علیه محور مقاومت به شما کمک کنم</p>
                <p className="text-sm text-muted-foreground mt-2">درباره PsyOp های شناسایی‌شده، اهداف حملات، کمپین‌های هماهنگ، و استراتژی پاسخ‌دهی سوال بپرسید</p>
              </div>

              <QuickPrompts onSelectPrompt={handleQuickPrompt} />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message) => (
                <ChatMessage 
                  key={message.id} 
                  message={message}
                  onFollowUpSelect={handleFollowUpSelect}
                />
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span className="text-sm text-muted-foreground">در حال تایپ...</span>
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
