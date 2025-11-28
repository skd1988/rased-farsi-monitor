// supabase/functions/suggest-target-name/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * ساده‌ترین نسخه:
 * ورودی:
 *   { kind: "entity" | "person", name_english?: string, name_arabic?: string }
 *
 * خروجی:
 *   { suggested_persian: string | null }
 */

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    // CORS preflight
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  if (!DEEPSEEK_API_KEY) {
    console.error("❌ Missing DEEPSEEK_API_KEY env");
    return new Response(
      JSON.stringify({ error: "Server misconfigured: missing API key" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const kind = body.kind as "entity" | "person" | undefined;
    const nameEnglish = (body.name_english ?? "").toString().trim();
    const nameArabic = (body.name_arabic ?? "").toString().trim();

    if (!kind) {
      return new Response(
        JSON.stringify({ error: "Missing 'kind' (entity|person)" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!nameEnglish && !nameArabic) {
      return new Response(
        JSON.stringify({
          error: "At least one of name_english or name_arabic is required",
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

    // ───────────────────── DeepSeek call ─────────────────────
    const systemPrompt = `
شما یک دستیار متخصص در نام‌گذاری و ترجمه نهادها و افراد مرتبط با محور مقاومت هستید.
کار شما:
- اگر نام انگلیسی یا عربی داده شد، آن را به «نام رسمی و رایج فارسی» تبدیل کنید.
- فقط نام فارسی را خروجی بدهید.
- از معادل‌های جاافتاده استفاده کنید (مثلاً "Muslim Brotherhood" → "اخوان‌المسلمین").
    `.trim();

    const userPrompt = `
نوع هدف: ${kind === "entity" ? "نهاد / سازمان" : "فرد"}
نام انگلیسی: ${nameEnglish || "-"}
نام عربی: ${nameArabic || "-"}

لطفاً فقط یک خروجی JSON برگردان:
{
  "persian_name": "نام پیشنهادی فارسی"
}
    `.trim();

    const payload = {
      model: "deepseek-chat",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ DeepSeek error:", res.status, text);
      return new Response(
        JSON.stringify({
          error: "DeepSeek API error",
          status: res.status,
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content?.trim() ?? "";

    let suggested: string | null = null;

    // تلاش برای پارس JSON
    if (content) {
      try {
        const cleaned = content
          .replace(/^```json/i, "")
          .replace(/^```/, "")
          .replace(/```$/, "")
          .trim();
        const parsed = JSON.parse(cleaned);
        if (typeof parsed?.persian_name === "string") {
          suggested = parsed.persian_name.trim();
        }
      } catch {
        // اگر مدل به‌صورت متن ساده برگرداند، همان را استفاده کن
        suggested = content.split("\n")[0].trim();
      }
    }

    return new Response(
      JSON.stringify({
        suggested_persian: suggested,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error("❌ Unexpected error in suggest-target-name:", err);
    return new Response(
      JSON.stringify({ error: "Unexpected error" }),
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
