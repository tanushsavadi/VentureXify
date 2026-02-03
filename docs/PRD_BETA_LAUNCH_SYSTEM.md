# VentureXify Beta Launch System - Product Requirements Document

> **Version:** 1.0.0  
> **Last Updated:** 2026-02-02  
> **Status:** Draft  
> **Author:** VentureXify Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Goals & Success Metrics](#goals--success-metrics)
4. [User Personas](#user-personas)
5. [System Architecture](#system-architecture)
6. [Feature Specifications](#feature-specifications)
7. [Technical Implementation](#technical-implementation)
8. [UI/UX Requirements](#uiux-requirements)
9. [Security & Privacy](#security--privacy)
10. [Launch Strategy](#launch-strategy)
11. [Timeline & Milestones](#timeline--milestones)

---

## Executive Summary

VentureXify is a premium Chrome extension for Capital One Venture X cardholders that helps maximize travel booking value through AI-powered recommendations. This PRD outlines the beta launch system, including:

- **Premium Landing Page** for r/VentureX community marketing
- **Supabase Authentication** integrated into Chrome extension
- **Waitlist & Beta Access Management** with selective user onboarding
- **Usage Quota System** for scalable API cost management
- **Feedback Collection** for iterative improvement

The goal is to launch a controlled beta with 100-500 initial users, gather feedback, and scale to public release.

---

## Problem Statement

### Current Challenges

1. **No User Management**: The extension currently has no authentication, meaning anyone can use it
2. **No API Cost Control**: Without user tracking, API costs are unpredictable
3. **No Feedback Loop**: No structured way to collect beta tester feedback
4. **No Waitlist**: No mechanism to build anticipation and control rollout

### Desired Outcome

A premium, gated beta experience where:
- Users sign up via a beautiful landing page
- Only approved beta testers can access AI features
- Usage is tracked and limited to control costs
- Feedback is collected to improve the product

---

## Goals & Success Metrics

### Primary Goals

| Goal | Target | Timeline |
|------|--------|----------|
| Waitlist Signups | 500+ | Week 1-2 |
| Beta Testers Activated | 100 (Wave 1) | Week 3 |
| Daily Active Users | 50+ | Week 4 |
| Feedback Submissions | 20+ | Week 4 |
| Net Promoter Score | 8+ | Week 6 |

### Secondary Goals

- Zero security incidents
- 99%+ uptime for auth services
- Average session length > 3 minutes
- AI query satisfaction rate > 80%

---

## User Personas

### Persona 1: The Power Traveler (Primary)
- **Name:** Alex Chen
- **Demographics:** 28-45, frequent business traveler, 10+ trips/year
- **Card Usage:** $50K+/year on Venture X
- **Motivation:** Maximize every dollar of travel spend
- **Tech Savvy:** High - comfortable with browser extensions
- **Where Found:** r/VentureX, r/churning, travel blogs

### Persona 2: The Optimizer (Secondary)
- **Name:** Sarah Miller  
- **Demographics:** 25-35, software engineer, 5-8 trips/year
- **Card Usage:** $20-40K/year
- **Motivation:** Wants data-driven decisions, loves tools
- **Tech Savvy:** Very High - early adopter
- **Where Found:** Product Hunt, Hacker News, Twitter/X

### Persona 3: The Casual Cardholder (Future)
- **Name:** Mike Johnson
- **Demographics:** 35-50, family traveler, 2-4 trips/year
- **Card Usage:** $15-25K/year
- **Motivation:** Simple recommendations, doesn't want to think hard
- **Tech Savvy:** Medium
- **Where Found:** Google search, word of mouth

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LANDING PAGE (Vercel)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  venturexify.com                                                    │   │
│  │  - Hero section with value prop                                     │   │
│  │  - Feature showcase                                                 │   │
│  │  - Email signup form → Supabase Auth                               │   │
│  │  - Waitlist counter (live)                                         │   │
│  │  - Social proof (Reddit testimonials)                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE BACKEND                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │   Auth Service   │  │  Database (PG)   │  │    Edge Functions        │  │
│  │                  │  │                  │  │                          │  │
│  │  - Email/Pass    │  │  - users         │  │  - venturex-chat         │  │
│  │  - Magic Link    │  │  - waitlist      │  │  - venturex-quota        │  │
│  │  - OAuth (opt)   │  │  - beta_access   │  │  - venturex-feedback     │  │
│  │                  │  │  - user_quotas   │  │  - venturex-admin        │  │
│  │                  │  │  - feedback      │  │                          │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CHROME EXTENSION                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  On First Launch:                                                   │   │
│  │  1. Check for existing session → chrome.storage.local              │   │
│  │  2. If no session → Show login/signup screen                       │   │
│  │  3. If session exists → Validate with Supabase                     │   │
│  │  4. Check beta_access status                                       │   │
│  │  5. If approved → Enable AI features                               │   │
│  │  6. If waitlisted → Show "Coming Soon" state                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  On AI Query:                                                       │   │
│  │  1. Check daily quota from Supabase                                │   │
│  │  2. If quota available → Make API call                             │   │
│  │  3. Increment usage counter                                        │   │
│  │  4. If quota exhausted → Show limit message                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Feature Specifications

### Feature 1: Premium Landing Page

#### 1.1 Hero Section
- **Headline:** "Your AI Copilot for Venture X"
- **Subheadline:** "Maximize every mile. Never overpay for travel again."
- **CTA:** "Join the Beta Waitlist" (primary button)
- **Visual:** Animated mockup of extension in action

#### 1.2 Feature Showcase
- Portal vs Direct comparison
- AI-powered recommendations
- Travel Eraser optimization
- Transfer partner analysis

#### 1.3 Social Proof Section
- Testimonials from r/VentureX (with permission)
- "Built by Venture X cardholders, for Venture X cardholders"
- Reddit badge/logo

#### 1.4 Waitlist Signup Form

**Collected Fields:**
| Field | Required | Purpose |
|-------|----------|---------|
| Email | Yes | Primary identifier, Supabase Auth |
| First Name | Yes | Personalization |
| Reddit Username | Optional | Verify r/VentureX membership |
| How did you hear about us? | Optional | Attribution tracking |
| Feature Interest | Optional | Product prioritization |

#### 1.5 Live Waitlist Counter
- Display current waitlist count
- "You're #X in line" after signup
- Creates urgency/FOMO

### Feature 2: Supabase Authentication

#### 2.1 Auth Methods (Priority Order)
1. **Email + Password** (Primary)
   - Simple, familiar flow
   - Email verification required

2. **Magic Link** (Secondary)
   - Passwordless option
   - Better for mobile-to-extension flow

3. **Google OAuth** (Future - v2)
   - One-click signup
   - Requires additional setup

#### 2.2 Auth in Chrome Extension

**Login Screen States:**
```
┌─────────────────────────────────────┐
│        VentureXify                  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    🔐 Sign In               │   │
│  │                             │   │
│  │    Email:                   │   │
│  │    [________________]       │   │
│  │                             │   │
│  │    Password:                │   │
│  │    [________________]       │   │
│  │                             │   │
│  │    [  Sign In  ]            │   │
│  │                             │   │
│  │    ─── or ───               │   │
│  │                             │   │
│  │    [📧 Send Magic Link]     │   │
│  │                             │   │
│  │    Don't have an account?   │   │
│  │    [Join Waitlist →]        │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Waitlisted State:**
```
┌─────────────────────────────────────┐
│        VentureXify                  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ⏳ You're on the list!   │   │
│  │                             │   │
│  │    Position: #147           │   │
│  │                             │   │
│  │    We're letting in         │   │
│  │    new users weekly.        │   │
│  │                             │   │
│  │    ─────────────────────    │   │
│  │                             │   │
│  │    🎁 Skip the line!        │   │
│  │    Share with 3 friends     │   │
│  │    to get early access.     │   │
│  │                             │   │
│  │    [📤 Get Referral Link]   │   │
│  │                             │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Beta Active State:**
```
┌─────────────────────────────────────┐
│        VentureXify                  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ✅ Welcome, Alex!        │   │
│  │                             │   │
│  │    🎯 Beta Tester           │   │
│  │    30 AI queries/day        │   │
│  │                             │   │
│  │    Today: 7/30 used         │   │
│  │    [███████░░░░░░░░░░░░░]   │   │
│  │                             │   │
│  │    [Continue to App →]      │   │
│  │                             │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Feature 3: Beta Access Management

#### 3.1 User Status Flow
```
SIGNUP → WAITLISTED → INVITED → ACTIVATED → ACTIVE_BETA
           │              │          │          │
           │              │          │          └─ Can use all features
           │              │          └─ First login, onboarding
           │              └─ Email sent with activation instructions
           └─ On waitlist, can't use AI features yet
```

#### 3.2 Admin Dashboard (Simple)
- View waitlist count
- Batch invite users (select N users)
- View usage statistics
- Manual user status override

### Feature 4: Usage Quota System

#### 4.1 Quota Tiers
| Tier | Daily AI Queries | Who Qualifies |
|------|-----------------|---------------|
| Waitlisted | 0 | Users on waitlist |
| Beta | 30/day | Activated beta users |
| Power | 50/day | Active feedback givers, referrers |
| Unlimited | ∞ | Admins, partners |

#### 4.2 Quota Reset Schedule
- Resets daily at 00:00 UTC
- Unused quota does NOT roll over
- Reset tracked per-user in database

### Feature 5: Feedback Collection

#### 5.1 In-Extension Feedback
- Thumbs up/down on AI responses
- "Report Issue" button
- Short feedback form (optional text)

#### 5.2 Feedback Data Captured
| Field | Description |
|-------|-------------|
| user_id | Supabase auth user |
| feedback_type | positive / negative / bug / suggestion |
| context | What feature was being used |
| message | Optional user message |
| ai_query | Hash of query (privacy) |
| ai_response_preview | First 100 chars |
| timestamp | When submitted |

---

## Technical Implementation

### Database Schema

```sql
-- ============================================
-- BETA ACCESS MANAGEMENT TABLES
-- ============================================

-- Waitlist tracking
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  reddit_username TEXT,
  referral_source TEXT, -- 'reddit', 'twitter', 'friend', etc.
  feature_interests TEXT[], -- ['ai_chat', 'comparison', 'eraser']
  position INTEGER GENERATED ALWAYS AS IDENTITY,
  status TEXT DEFAULT 'waitlisted' CHECK (status IN ('waitlisted', 'invited', 'activated', 'active')),
  invited_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  referred_by UUID REFERENCES waitlist(id),
  referral_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast position lookups
CREATE INDEX idx_waitlist_position ON waitlist(position);
CREATE INDEX idx_waitlist_status ON waitlist(status);
CREATE INDEX idx_waitlist_email ON waitlist(email);

-- User quotas
CREATE TABLE user_quotas (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT DEFAULT 'beta' CHECK (tier IN ('waitlisted', 'beta', 'power', 'unlimited')),
  daily_limit INTEGER DEFAULT 30,
  queries_today INTEGER DEFAULT 0,
  queries_total INTEGER DEFAULT 0,
  last_query_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback collection
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'bug', 'suggestion')),
  context TEXT, -- 'ai_chat', 'comparison', 'eraser', etc.
  message TEXT,
  query_hash TEXT, -- SHA256 hash of query for privacy
  response_preview TEXT, -- First 100 chars
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for feedback analytics
CREATE INDEX idx_feedback_type ON feedback(feedback_type);
CREATE INDEX idx_feedback_user ON feedback(user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to check and decrement quota
CREATE OR REPLACE FUNCTION check_and_use_quota(p_user_id UUID)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  daily_limit INTEGER,
  tier TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_quota user_quotas%ROWTYPE;
BEGIN
  -- Get or create quota record
  INSERT INTO user_quotas (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Reset if new day
  UPDATE user_quotas
  SET queries_today = 0,
      last_query_date = CURRENT_DATE
  WHERE user_id = p_user_id
    AND last_query_date < CURRENT_DATE;
  
  -- Get current quota
  SELECT * INTO v_quota FROM user_quotas WHERE user_id = p_user_id;
  
  -- Check if unlimited
  IF v_quota.tier = 'unlimited' THEN
    UPDATE user_quotas
    SET queries_today = queries_today + 1,
        queries_total = queries_total + 1
    WHERE user_id = p_user_id;
    
    RETURN QUERY SELECT TRUE, 999, 999, 'unlimited'::TEXT;
    RETURN;
  END IF;
  
  -- Check if quota available
  IF v_quota.queries_today < v_quota.daily_limit THEN
    UPDATE user_quotas
    SET queries_today = queries_today + 1,
        queries_total = queries_total + 1
    WHERE user_id = p_user_id;
    
    RETURN QUERY SELECT 
      TRUE,
      (v_quota.daily_limit - v_quota.queries_today - 1)::INTEGER,
      v_quota.daily_limit,
      v_quota.tier;
  ELSE
    RETURN QUERY SELECT 
      FALSE,
      0::INTEGER,
      v_quota.daily_limit,
      v_quota.tier;
  END IF;
END;
$$;

-- Function to get waitlist position
CREATE OR REPLACE FUNCTION get_waitlist_position(p_email TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_position INTEGER;
BEGIN
  SELECT position INTO v_position
  FROM waitlist
  WHERE email = p_email;
  
  RETURN COALESCE(v_position, -1);
END;
$$;

-- Function to batch invite users
CREATE OR REPLACE FUNCTION invite_batch(p_count INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_invited INTEGER;
BEGIN
  WITH to_invite AS (
    SELECT id
    FROM waitlist
    WHERE status = 'waitlisted'
    ORDER BY position
    LIMIT p_count
  )
  UPDATE waitlist
  SET status = 'invited',
      invited_at = NOW()
  WHERE id IN (SELECT id FROM to_invite);
  
  GET DIAGNOSTICS v_invited = ROW_COUNT;
  RETURN v_invited;
END;
$$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Waitlist: Users can only see their own entry
CREATE POLICY "Users can view own waitlist entry"
  ON waitlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own waitlist entry"
  ON waitlist FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Quotas: Users can only see their own quota
CREATE POLICY "Users can view own quota"
  ON user_quotas FOR SELECT
  USING (auth.uid() = user_id);

-- Feedback: Users can insert and view their own feedback
CREATE POLICY "Users can view own feedback"
  ON feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Edge Function: Quota Check

```typescript
// supabase/functions/venturex-quota/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check quota
    const { data, error } = await supabase.rpc('check_and_use_quota', {
      p_user_id: user.id
    })

    if (error) {
      throw error
    }

    const quota = data[0]
    
    return new Response(
      JSON.stringify({
        allowed: quota.allowed,
        remaining: quota.remaining,
        dailyLimit: quota.daily_limit,
        tier: quota.tier
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

---

## UI/UX Requirements

### Landing Page Design System

#### Color Palette (Premium Dark Theme)
```css
:root {
  /* Primary - Gold/Amber accent (Capital One inspired) */
  --primary-500: #F59E0B;
  --primary-600: #D97706;
  --primary-400: #FBBF24;
  
  /* Background - Deep dark */
  --bg-primary: #0A0A0B;
  --bg-secondary: #111113;
  --bg-tertiary: #1A1A1D;
  
  /* Text */
  --text-primary: #FFFFFF;
  --text-secondary: #A1A1AA;
  --text-muted: #71717A;
  
  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-medium: rgba(255, 255, 255, 0.12);
  
  /* Gradients */
  --gradient-gold: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
  --gradient-glass: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
}
```

#### Typography
```css
/* Headings - Modern geometric sans */
font-family: 'Inter', 'SF Pro Display', -apple-system, sans-serif;

/* Hierarchy */
h1 { font-size: 3.5rem; font-weight: 700; letter-spacing: -0.02em; }
h2 { font-size: 2.5rem; font-weight: 600; letter-spacing: -0.01em; }
h3 { font-size: 1.5rem; font-weight: 600; }
body { font-size: 1rem; font-weight: 400; line-height: 1.6; }
```

#### Component Specifications

**Primary CTA Button:**
```css
.btn-primary {
  background: var(--gradient-gold);
  color: #0A0A0B;
  padding: 16px 32px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1rem;
  box-shadow: 0 0 40px rgba(245, 158, 11, 0.3);
  transition: all 0.3s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 60px rgba(245, 158, 11, 0.5);
}
```

**Glass Card:**
```css
.glass-card {
  background: var(--gradient-glass);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 24px;
}
```

### Extension Auth UI Requirements

- Match existing extension glass theme
- Smooth transitions between auth states
- Loading states for all async operations
- Clear error messages
- Responsive within side panel constraints

---

## Security & Privacy

### Authentication Security
- All auth through Supabase (battle-tested)
- JWT tokens stored in chrome.storage.local
- Token refresh handled automatically
- Session validation on each extension open

### Data Privacy
- No PII sent to AI APIs (queries redacted)
- Email stored only for auth purposes
- Feedback is anonymized
- Users can delete account and all data

### API Security
- All API calls through Supabase Edge Functions
- No API keys in extension code
- Rate limiting at function level
- Request validation

---

## Launch Strategy

### Phase 1: Soft Launch (Week 1)
1. Deploy landing page
2. Post on r/VentureX with soft pitch
3. Collect initial 100-200 signups
4. NO beta invites yet - build anticipation

### Phase 2: First Wave (Week 2-3)
1. Invite first 50 users
2. Monitor API usage closely
3. Collect initial feedback
4. Fix critical bugs

### Phase 3: Expanded Beta (Week 4-6)
1. Invite 100 more users weekly
2. Implement feedback improvements
3. Add referral system for organic growth
4. Prepare for public launch

### Phase 4: Public Beta (Week 7+)
1. Open waitlist to immediate access
2. Upgrade API tiers as needed
3. Prepare Chrome Web Store listing
4. Marketing push

---

## Timeline & Milestones

```
Week 1:
├── [ ] Set up Supabase Auth
├── [ ] Create database schema
├── [ ] Build landing page v1
├── [ ] Deploy to Vercel
└── [ ] Soft launch on r/VentureX

Week 2:
├── [ ] Add auth to Chrome extension
├── [ ] Implement quota system
├── [ ] Test end-to-end flow
└── [ ] Invite first 50 beta users

Week 3-4:
├── [ ] Collect feedback
├── [ ] Bug fixes and improvements
├── [ ] Expand to 150 users
└── [ ] Add referral system

Week 5-6:
├── [ ] Major improvements from feedback
├── [ ] Expand to 300 users
├── [ ] Prepare Chrome Web Store listing
└── [ ] Plan public launch

Week 7+:
├── [ ] Public beta launch
├── [ ] Marketing push
├── [ ] Scale infrastructure as needed
└── [ ] Iterate based on usage data
```

---

## Appendix

### A. Supabase Project Requirements

**Project Name:** venturexify-prod  
**Region:** us-east-1 (closest to target users)  
**Plan:** Free tier (upgrade to Pro at 1000+ users)

**Required Services:**
- Authentication (Email/Password, Magic Link)
- Database (PostgreSQL with pgvector)
- Edge Functions
- Storage (optional, for future features)

### B. Vercel Project Requirements

**Project Name:** venturexify-landing  
**Framework:** Next.js 14+ (App Router)  
**Domain:** venturexify.com (to be purchased)

### C. Chrome Extension Updates

**Files to Modify:**
- `manifest.json` - No changes needed
- `src/config/supabase.ts` - Already has config
- `src/ui/sidepanel/` - Add auth screens
- `src/lib/auth.ts` - NEW: Auth helper functions

### D. Reddit Marketing Copy (Draft)

> **Title:** [Tool] Built an AI copilot for Venture X cardholders - looking for beta testers
> 
> Hey r/VentureX! Long-time lurker, first-time poster.
> 
> I've been a Venture X holder since launch and always found myself doing mental math on portal vs direct bookings. So I built a Chrome extension to automate it.
> 
> **What it does:**
> - Compares portal vs direct prices in real-time
> - Factors in your miles earning + travel credit
> - AI chatbot that knows Venture X inside and out
> - Travel Eraser tracking and reminders
> 
> Currently in closed beta and looking for power users to test and give feedback before public launch.
> 
> If interested, sign up at [venturexify.com] - I'm letting in small batches each week.
> 
> Would love your feedback on what features would be most valuable!

---

*End of PRD*
