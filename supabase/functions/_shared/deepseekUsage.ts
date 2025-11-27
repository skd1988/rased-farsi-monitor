const DEEPSEEK_INPUT_PRICE_PER_M = 0.14;  // USD per 1M input tokens
const DEEPSEEK_OUTPUT_PRICE_PER_M = 0.28; // USD per 1M output tokens

export type DeepseekUsage = {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
};

export function calculateDeepseekCosts(usage: DeepseekUsage) {
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? inputTokens + outputTokens;

  const cost_input_usd = (inputTokens / 1_000_000) * DEEPSEEK_INPUT_PRICE_PER_M;
  const cost_output_usd = (outputTokens / 1_000_000) * DEEPSEEK_OUTPUT_PRICE_PER_M;
  const cost_usd = cost_input_usd + cost_output_usd;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cost_input_usd,
    cost_output_usd,
    cost_usd,
  };
}

export async function logDeepseekUsage(
  supabase: any,
  params: {
    endpoint: string;
    usage: DeepseekUsage;
    responseTimeMs?: number;
    postId?: string | null;
    questionSnippet?: string | null;
    functionName?: string | null;
  },
) {
  if (!supabase) return;

  const {
    inputTokens,
    outputTokens,
    totalTokens,
    cost_input_usd,
    cost_output_usd,
    cost_usd,
  } = calculateDeepseekCosts(params.usage || {});

  try {
    await supabase.from("api_usage_logs").insert({
      endpoint: params.endpoint,
      function_name: params.functionName ?? params.endpoint,
      model_used: "deepseek-chat",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      cost_input_usd,
      cost_output_usd,
      cost_usd,
      response_time_ms: params.responseTimeMs ?? null,
      status: "success",
      post_id: params.postId ?? null,
      question: params.questionSnippet ?? null,
    });
  } catch (error) {
    console.error("Failed to log DeepSeek API usage:", error);
  }
}
