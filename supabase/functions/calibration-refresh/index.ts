import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ReviewedPost = {
  id: number;
  is_psyop: boolean | null;
  psyop_risk_score: number | null;
  psyop_review_status: string | null;
};

type ConfusionRow = Record<string, unknown>;

type RefreshRequest = {
  lookbackDays?: number;
  minRiskScore?: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(
      JSON.stringify({
        error: "Missing Supabase configuration",
        stage: "calibration_refresh",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  let lookbackDays = 30;
  let minRiskScore = 0;

  try {
    const body = (await req.json()) as RefreshRequest;

    if (body && typeof body.lookbackDays === "number" && !Number.isNaN(body.lookbackDays)) {
      lookbackDays = body.lookbackDays;
    }

    if (body && typeof body.minRiskScore === "number" && !Number.isNaN(body.minRiskScore)) {
      minRiskScore = body.minRiskScore;
    }
  } catch (_err) {
    // Ignore parsing errors and fall back to defaults
  }

  const now = new Date();
  const since = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const { data: reviewedPosts, error: reviewedError } = await supabase
    .from<ReviewedPost>("posts")
    .select("id, is_psyop, psyop_risk_score, psyop_review_status")
    .in("psyop_review_status", ["confirmed", "rejected"])
    .not("psyop_risk_score", "is", null)
    .gte("published_at", since.toISOString())
    .gte("psyop_risk_score", minRiskScore);

  if (reviewedError) {
    console.error("Error loading reviewed posts:", reviewedError);
    return new Response(
      JSON.stringify({ error: "Failed to load reviewed posts", stage: "calibration_refresh" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let totalReviewed = 0;
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  const fpScores: number[] = [];
  const fnScores: number[] = [];

  for (const row of reviewedPosts ?? []) {
    const modelPositive = row.is_psyop === true;
    const humanPositive = row.psyop_review_status === "confirmed";
    const score = typeof row.psyop_risk_score === "number" ? row.psyop_risk_score : null;

    totalReviewed++;

    if (modelPositive && humanPositive) {
      tp++;
    } else if (modelPositive && !humanPositive) {
      fp++;
      if (score !== null) fpScores.push(score);
    } else if (!modelPositive && !humanPositive) {
      tn++;
    } else if (!modelPositive && humanPositive) {
      fn++;
      if (score !== null) fnScores.push(score);
    }
  }

  const modelAgreement = tp + tn;
  const modelDisagreement = fp + fn;

  const avgRiskFp =
    fpScores.length > 0
      ? fpScores.reduce((sum, v) => sum + v, 0) / fpScores.length
      : null;

  const avgRiskFn =
    fnScores.length > 0
      ? fnScores.reduce((sum, v) => sum + v, 0) / fnScores.length
      : null;

  const confirmedScores: number[] = [];
  const rejectedScores: number[] = [];

  for (const row of reviewedPosts ?? []) {
    const score = typeof row.psyop_risk_score === "number" ? row.psyop_risk_score : null;
    if (score === null) continue;

    if (row.psyop_review_status === "confirmed") {
      confirmedScores.push(score);
    } else if (row.psyop_review_status === "rejected") {
      rejectedScores.push(score);
    }
  }

  const avgConfirmed =
    confirmedScores.length > 0
      ? confirmedScores.reduce((s, v) => s + v, 0) / confirmedScores.length
      : null;

  const avgRejected =
    rejectedScores.length > 0
      ? rejectedScores.reduce((s, v) => s + v, 0) / rejectedScores.length
      : null;

  let recommendedRiskThreshold = 70;

  if (avgConfirmed !== null && avgRejected !== null) {
    const midpoint = (avgConfirmed + avgRejected) / 2;
    recommendedRiskThreshold = Math.round((midpoint + avgConfirmed) / 2);
  } else if (avgConfirmed !== null) {
    recommendedRiskThreshold = Math.round(avgConfirmed - 5);
  } else if (avgRejected !== null) {
    recommendedRiskThreshold = Math.round(avgRejected + 5);
  }

  if (recommendedRiskThreshold < 40) recommendedRiskThreshold = 40;
  if (recommendedRiskThreshold > 90) recommendedRiskThreshold = 90;

  let recommendedDeepThreshold = recommendedRiskThreshold;
  let recommendedDeepestThreshold = recommendedRiskThreshold + 10;

  if (recommendedDeepThreshold < 60) recommendedDeepThreshold = 60;
  if (recommendedDeepestThreshold < 80) recommendedDeepestThreshold = 80;
  if (recommendedDeepestThreshold > 95) recommendedDeepestThreshold = 95;

  let confusionData: ConfusionRow[] | null = null;

  const { data: confusionRows, error: confusionError } = await supabase
    .from<ConfusionRow>("psyop_model_confusion")
    .select("*");

  if (confusionError) {
    console.error("Error loading confusion view:", confusionError);
  } else {
    confusionData = confusionRows as ConfusionRow[];
  }

  const { error: insertError } = await supabase.from("psyop_calibration_metrics").insert({
    total_reviewed: totalReviewed,
    model_agreement: modelAgreement,
    model_disagreement: modelDisagreement,
    false_positive_count: fp,
    false_negative_count: fn,
    avg_risk_fp: avgRiskFp,
    avg_risk_fn: avgRiskFn,
    recommended_risk_threshold: recommendedRiskThreshold,
    recommended_deep_threshold: recommendedDeepThreshold,
    recommended_deepest_threshold: recommendedDeepestThreshold,
    raw_confusion: confusionData ?? null,
  });

  if (insertError) {
    console.error("Error inserting calibration metrics:", insertError);
    return new Response(
      JSON.stringify({ error: "Failed to insert calibration metrics", stage: "calibration_refresh" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const responseBody = {
    stage: "calibration_refresh",
    total_reviewed: totalReviewed,
    model_agreement: modelAgreement,
    model_disagreement: modelDisagreement,
    false_positive_count: fp,
    false_negative_count: fn,
    avg_risk_fp: avgRiskFp,
    avg_risk_fn: avgRiskFn,
    recommended_risk_threshold: recommendedRiskThreshold,
    recommended_deep_threshold: recommendedDeepThreshold,
    recommended_deepest_threshold: recommendedDeepestThreshold,
  };

  return new Response(JSON.stringify(responseBody), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
