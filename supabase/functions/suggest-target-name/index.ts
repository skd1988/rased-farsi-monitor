import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function callDeepseek(body: unknown): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("DeepSeek error", res.status, text);
    throw new Error(`DeepSeek error: ${res.status}`);
  }

  const json = await res.json();
  const content =
    json.choices?.[0]?.message?.content?.trim?.() ??
    json.choices?.[0]?.message?.content ??
    "";

  return content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST is allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { kind, name_english, name_arabic, name_persian } = payload as {
      kind?: "entity" | "person";
      name_english?: string | null;
      name_arabic?: string | null;
      name_persian?: string | null;
    };

    const sourceName =
      (name_persian && name_persian.trim()) ||
      (name_english && name_english.trim()) ||
      (name_arabic && name_arabic.trim());

    if (!sourceName) {
      return new Response(
        JSON.stringify({
          error: "At least one of name_persian / name_english / name_arabic is required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const roleLabel = kind === "person" ? "فرد حقیقی" : "نهاد یا سازمان";

    const body = {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "تو یک دستیار ترجمه و یکسان‌سازی اسامی برای سامانه رصد عملیات روانی هستی. " +
            "کار تو این است که برای نام‌های افراد و نهادها، یک «نام فارسی کوتاه، استاندارد و رایج» پیشنهاد بدهی. " +
            "فقط خود نام را بدون هیچ توضیح اضافی، بدون نقل‌قول و بدون علائم اضافه برگردان.",
        },
        {
          role: "user",
          content:
            `نوع هدف: ${roleLabel}
نام موجود: ${sourceName}

اگر این نام از قبل فارسی است، فقط همان را تمیز و استاندارد کن (مثلاً فاصله‌ها را اصلاح کن).
اگر انگلیسی یا عربی است، معادل فارسی رایج و حرفه‌ای را پیشنهاد بده.
فقط یک نام فارسی نهایی برگردان.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 64,
    };

    const suggestion = await callDeepseek(body);
    const suggested_persian = suggestion.trim();

    return new Response(
      JSON.stringify({ suggested_persian }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error("suggest-target-name error", err);
    return new Response(
      JSON.stringify({
        error: "Internal error in suggest-target-name",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
