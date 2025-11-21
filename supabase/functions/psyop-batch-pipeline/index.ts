import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PipelineOptions = {
  maxPosts: number;
  runSummarize: boolean;
  runQuick: boolean;
  runDeep: boolean;
  runDeepest: boolean;
};

type PostRecord = {
  id: string;
  published_at: string;
  summary: string | null;
  psyop_risk_score: number | null;
  needs_deep_analysis: boolean | null;
  analysis_summary: string | null;
  deepest_escalation_level: string | null;
  is_psyop: boolean | null;
  psyop_category: string | null;
};

type NeededStages = {
  summarize: boolean;
  quick: boolean;
  deep: boolean;
  deepest: boolean;
};

type PsyopThresholds = {
  riskThreshold: number;      // base risk decision (psyop vs not)
  deepThreshold: number;      // when to trigger deep analysis
  deepestThreshold: number;   // when to trigger deepest analysis / crisis
};

function computeNeededStages(
  post: PostRecord,
  opts: PipelineOptions,
  thresholds: PsyopThresholds,
): NeededStages {
  const needsSummarize = opts.runSummarize && (!post.summary || post.summary.trim().length === 0);
  const needsQuick = opts.runQuick && post.psyop_risk_score == null;
  const needsDeep =
    opts.runDeep && post.needs_deep_analysis === true && (post.analysis_summary == null || post.analysis_summary === "");
  const highRisk =
    typeof post.psyop_risk_score === "number" && post.psyop_risk_score >= thresholds.deepestThreshold;
  const confirmed = post.is_psyop === true || post.psyop_category === "confirmed_psyop";
  const needsDeepest = opts.runDeepest && highRisk && confirmed && !post.deepest_escalation_level;

  return {
    summarize: needsSummarize,
    quick: needsQuick,
    deep: needsDeep,
    deepest: needsDeepest,
  };
}

function getOptionsFromRequest(body: unknown): PipelineOptions {
  const opts = (body && typeof body === "object" ? body : {}) as Partial<PipelineOptions>;

  return {
    maxPosts: typeof opts.maxPosts === "number" && opts.maxPosts > 0 ? opts.maxPosts : 25,
    runSummarize: opts.runSummarize !== undefined ? Boolean(opts.runSummarize) : true,
    runQuick: opts.runQuick !== undefined ? Boolean(opts.runQuick) : true,
    runDeep: opts.runDeep !== undefined ? Boolean(opts.runDeep) : true,
    runDeepest: opts.runDeepest !== undefined ? Boolean(opts.runDeepest) : false,
  };
}

async function fetchCandidatePosts(
  supabase: SupabaseClient,
  maxPosts: number,
): Promise<{ posts: PostRecord[]; error?: Error }> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, published_at, summary, psyop_risk_score, needs_deep_analysis, analysis_summary, deepest_escalation_level, is_psyop, psyop_category",
    )
    .gte("published_at", since.toISOString())
    .order("published_at", { ascending: false })
    .limit(maxPosts * 3);

  if (error) {
    return { posts: [], error: new Error(`Failed to fetch posts: ${error.message}`) };
  }

  return { posts: (data ?? []) as PostRecord[] };
}

async function processPost(
  supabase: SupabaseClient,
  post: PostRecord,
  neededStages: NeededStages,
  counters: {
    processedCount: number;
    summarizeCount: number;
    quickCount: number;
    deepCount: number;
    deepestCount: number;
    errorCount: number;
  },
) {
  if (!neededStages.summarize && !neededStages.quick && !neededStages.deep && !neededStages.deepest) {
    return;
  }

  counters.processedCount += 1;

  if (neededStages.summarize) {
    try {
      await supabase.functions.invoke("summarize-post", {
        body: { postId: post.id },
      });
      counters.summarizeCount += 1;
    } catch (error) {
      console.error(`summarize-post failed for ${post.id}:`, error);
      counters.errorCount += 1;
    }
  }

  if (neededStages.quick) {
    try {
      await supabase.functions.invoke("quick-psyop-detection", {
        body: { postId: post.id },
      });
      counters.quickCount += 1;
    } catch (error) {
      console.error(`quick-psyop-detection failed for ${post.id}:`, error);
      counters.errorCount += 1;
    }
  }

  if (neededStages.deep) {
    try {
      await supabase.functions.invoke("analyze-post-deepseek", {
        body: { postId: post.id },
      });
      counters.deepCount += 1;
    } catch (error) {
      console.error(`analyze-post-deepseek failed for ${post.id}:`, error);
      counters.errorCount += 1;
    }
  }

  if (neededStages.deepest) {
    try {
      await supabase.functions.invoke("deepest-analysis", {
        body: { postId: post.id },
      });
      counters.deepestCount += 1;
    } catch (error) {
      console.error(`deepest-analysis failed for ${post.id}:`, error);
      counters.errorCount += 1;
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch (error) {
    console.error("Failed to read request body:", error);
    return new Response(
      JSON.stringify({ error: "Invalid request body", stage: "batch_pipeline" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let bodyJson: unknown;
  if (!bodyText || bodyText.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "Missing JSON body", stage: "batch_pipeline" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    bodyJson = JSON.parse(bodyText);
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return new Response(
      JSON.stringify({ error: "Invalid JSON", stage: "batch_pipeline" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const options = getOptionsFromRequest(bodyJson);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const thresholds = await loadPsyopThresholds(supabase);
  console.log("Batch pipeline using psyop thresholds:", thresholds);

  try {
    const { posts, error } = await fetchCandidatePosts(supabase, options.maxPosts);
    if (error) {
      throw error;
    }

    const selected: { post: PostRecord; stages: NeededStages }[] = [];

    for (const post of posts) {
      const stages = computeNeededStages(post, options, thresholds);
      if (!stages.summarize && !stages.quick && !stages.deep && !stages.deepest) {
        continue;
      }

      selected.push({ post, stages });
      if (selected.length >= options.maxPosts) {
        break;
      }
    }

    const counters = {
      processedCount: 0,
      summarizeCount: 0,
      quickCount: 0,
      deepCount: 0,
      deepestCount: 0,
      errorCount: 0,
    };

    for (const item of selected) {
      await processPost(supabase, item.post, item.stages, counters);
    }

    const responsePayload = {
      stage: "batch_pipeline",
      processed_posts: counters.processedCount,
      summarize_calls: counters.summarizeCount,
      quick_calls: counters.quickCount,
      deep_calls: counters.deepCount,
      deepest_calls: counters.deepestCount,
      errors: counters.errorCount,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Batch pipeline error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, stage: "batch_pipeline" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function loadPsyopThresholds(supabase: SupabaseClient): Promise<PsyopThresholds> {
  // default fallback thresholds
  let thresholds: PsyopThresholds = {
    riskThreshold: 70,
    deepThreshold: 75,
    deepestThreshold: 85,
  };

  try {
    const { data, error } = await supabase
      .from("psyop_calibration_metrics")
      .select("recommended_risk_threshold, recommended_deep_threshold, recommended_deepest_threshold")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.warn("Failed to load calibration thresholds, using defaults:", error);
      return thresholds;
    }

    const row = data?.[0];
    if (!row) return thresholds;

    const risk = row.recommended_risk_threshold ?? thresholds.riskThreshold;
    const deep = row.recommended_deep_threshold ?? thresholds.deepThreshold;
    const deepest = row.recommended_deepest_threshold ?? thresholds.deepestThreshold;

    thresholds = {
      riskThreshold: Number.isFinite(risk) ? risk : thresholds.riskThreshold,
      deepThreshold: Number.isFinite(deep) ? deep : thresholds.deepThreshold,
      deepestThreshold: Number.isFinite(deepest) ? deepest : thresholds.deepestThreshold,
    };

    return thresholds;
  } catch (err) {
    console.warn("Unexpected error loading thresholds, using defaults:", err);
    return thresholds;
  }
}
