#!/bin/bash

# ============================================
# VentureX OS - Supabase Setup Script
# ============================================

echo "🚀 VentureX OS Supabase Setup"
echo "=============================="

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "📦 Installing Supabase CLI..."
    npm install -g supabase
fi

# Variables - UPDATE THESE WITH YOUR VALUES
SUPABASE_PROJECT_REF="yxbbmwebqjpxvpgzcyph"

# Get API keys from user
echo ""
echo "Please enter your API keys:"
read -p "GROQ API Key (starts with gsk_): " GROQ_API_KEY
read -p "HuggingFace API Key (starts with hf_): " HF_API_KEY

if [[ ! $GROQ_API_KEY == gsk_* ]]; then
    echo "⚠️  Warning: Groq API key should start with 'gsk_'"
fi

if [[ ! $HF_API_KEY == hf_* ]]; then
    echo "⚠️  Warning: HuggingFace API key should start with 'hf_'"
fi

echo ""
echo "📡 Linking to Supabase project: $SUPABASE_PROJECT_REF"
supabase link --project-ref $SUPABASE_PROJECT_REF

echo ""
echo "🔐 Setting secrets..."
supabase secrets set GROQ_API_KEY=$GROQ_API_KEY
supabase secrets set HF_API_KEY=$HF_API_KEY

echo ""
echo "☁️  Deploying Edge Functions..."
supabase functions deploy venturex-chat --no-verify-jwt
supabase functions deploy venturex-search --no-verify-jwt
supabase functions deploy venturex-embed --no-verify-jwt
supabase functions deploy venturex-upsert --no-verify-jwt

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run the SQL migration in Supabase SQL Editor"
echo "   (Copy from supabase/migrations/001_initial_schema.sql)"
echo ""
echo "2. Build the extension:"
echo "   npm run build"
echo ""
echo "3. Load extension in Chrome:"
echo "   chrome://extensions → Load unpacked → select 'dist' folder"
