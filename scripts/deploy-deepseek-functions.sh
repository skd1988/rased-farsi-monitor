#!/usr/bin/env bash
set -euo pipefail

# Update PROJECT_REF with your actual Supabase project reference before running.
PROJECT_REF="YOUR_PROJECT_REF_HERE"

echo "🚀 Building DeepSeek-related edge functions..."
supabase functions build quick-psyop-detection analyze-post analyze-post-deepseek deepest-analysis chat-assistant chat-with-data

echo "🚀 Deploying DeepSeek-related edge functions to project $PROJECT_REF ..."
supabase functions deploy quick-psyop-detection \
  --project-ref "$PROJECT_REF"
supabase functions deploy analyze-post \
  --project-ref "$PROJECT_REF"
supabase functions deploy analyze-post-deepseek \
  --project-ref "$PROJECT_REF"
supabase functions deploy deepest-analysis \
  --project-ref "$PROJECT_REF"
supabase functions deploy chat-assistant \
  --project-ref "$PROJECT_REF"
supabase functions deploy chat-with-data \
  --project-ref "$PROJECT_REF"

echo "✅ DeepSeek edge functions deployed."
