// ============================================
// VENTUREX CHAT - Supabase Edge Function
// Proxies chat requests to Groq API
// ============================================
// 
// Deploy with: supabase functions deploy venturex-chat --no-verify-jwt
//
// Environment variables needed:
// - GROQ_API_KEY: Your Groq API key
//
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// VentureX knowledge base with CORRECT, COMPREHENSIVE information
// This MUST stay in sync with src/ai/prompts/systemPrompt.ts
const VENTURE_X_KNOWLEDGE = `
## Capital One Venture X Card - CORRECT Knowledge Base

### Card Overview
- **Annual fee:** $395
- **Sign-on bonus:** 75,000 bonus miles after spending $4,000 on purchases within the first 6 months
- Earn 2X miles on all purchases (base rate)
- Earn 5X miles on flights and vacation rentals booked through Capital One Travel portal
- Earn 10X miles on hotels and rental cars booked through Capital One Travel portal
- $300 annual travel credit (Capital One Travel purchases only)
- 10,000 anniversary bonus miles each year
- No foreign transaction fees
- Up to 4 authorized users at no additional card fee

### Lounge Access (Updated Feb 1, 2026)
**Priority Pass Select:**
- Complimentary membership (enrollment required) with access to 1,300+ lounges worldwide
- Primary cardholder can bring up to 2 complimentary guests per visit
- Additional guests beyond 2 cost $35 each per visit

**Capital One Lounges and Landings:**
- Locations: DFW (Dallas-Fort Worth), DEN (Denver), IAD (Washington Dulles), DCA (Ronald Reagan National)
- Features: hot meals, craft cocktails, shower suites, relaxation rooms, premium workspaces
- Guest costs: $45/visit (age 18+), $25/visit (age 17 and under), children under 2 free
- Complimentary guests (2 at Lounges, 1 at Landings) are ONLY for cardholders spending $75,000+/year

**Authorized User Lounge Access:**
- Authorized users do NOT have complimentary lounge access
- Primary cardholders can purchase lounge access for authorized users at $125/year per additional cardholder
- Paid AU lounge access includes Capital One Lounges, Landings, AND Priority Pass

### Travel Protections
- Trip cancellation/interruption insurance: up to $5,000 per trip
- Trip delay reimbursement: up to $500 after 6 hours delay
- Lost luggage reimbursement: up to $3,000
- Baggage delay insurance: up to $500

### Rental Car & Auto
- Primary auto rental collision damage waiver (CDW) — primary coverage, not secondary
- Hertz President's Circle elite status

### Cell Phone Protection
- Up to $800 per claim, $25 deductible
- Covers damage or theft when you pay your monthly cell phone bill with the Venture X

### Visa Infinite Benefits
- Luxury Hotel Collection access
- 24/7 Visa Infinite Concierge service

### Other Benefits
- Global Entry or TSA PreCheck credit: up to $120 every 4 years
- Travel Eraser: redeem miles at 1cpp for travel purchases in last 90 days

### CRITICAL: Travel Eraser - CORRECT Understanding
Travel Eraser is NOT a booking method. It is a POST-PURCHASE statement credit redemption:
- You FIRST book travel (either via portal OR direct)
- You THEN can redeem miles to erase that purchase from your statement
- Redemption rate: 1 cent per mile (1 cpp = 0.01 USD per mile)
- NO MINIMUM — you can erase any amount, even $0.01
- Partial redemptions allowed
- Works on purchases made in last 90 days
- Works on ANY travel purchase (flights, hotels, Uber, etc.)

### CRITICAL: Travel Eraser Math
- 1,000 miles = $10 erased
- 10,000 miles = $100 erased
- To fully erase a $767 purchase, you need 76,700 miles
- Travel Eraser is SPENDING miles, not earning them
- If you use Eraser, you lose those miles (opportunity cost vs transfer partners at 1.5-2cpp)

### Portal vs Direct Decision Framework
Step 1: Compare where to BOOK
- Portal: Higher multiplier (5X flights, 10X hotels), may have higher price
- Direct: Lower multiplier (2X), may have lower price, keep elite status credits

Step 2: After booking, decide HOW TO PAY
- Cash: Keep miles, earn new miles
- Travel Eraser: Spend existing miles at 1cpp to offset cash cost
- Transfer Partners: Spend miles at 1.5-3+ cpp (better value but different use case)

### Miles Valuation
- Floor: 1.0 cpp (Travel Eraser)
- Conservative: 1.5 cpp
- Standard: 1.8 cpp (used in our calculations)
- Aspirational: 2.0+ cpp (transfer partner sweet spots)

### Transfer Partners (ALTERNATIVE to Eraser)
Airlines: Turkish Miles&Smiles, Emirates Skywards, Avianca LifeMiles, Air France/KLM Flying Blue, British Airways Avios, Singapore KrisFlyer, Qantas Frequent Flyer, Etihad Guest, Air Canada Aeroplan, JetBlue TrueBlue, and more.
Hotels: Wyndham Rewards, Choice Privileges, Accor Live Limitless (2:1 ratio).
- Transfer ratio: 1:1 for most partners (1,000 Capital One = 1,000 partner miles)
- Transfer time: Usually instant to 2 business days
- Better value than Eraser IF you have specific redemption in mind
`

interface TravelEraserContext {
  milesBalance?: number
  portalEraserMilesNeeded?: number
  portalEraserValue?: number
  directEraserMilesNeeded?: number
  directEraserValue?: number
  portalNetAfterEraser?: number
  directNetAfterEraser?: number
  eraserOpportunityCost?: number
}

interface ChatRequest {
  message: string
  context?: {
    portalPrice?: number
    directPrice?: number
    route?: string
    portalMiles?: number
    directMiles?: number
    portalNetCost?: number
    directNetCost?: number
    winner?: string
    savings?: number
    creditRemaining?: number
    eraser?: TravelEraserContext
  }
  ragContext?: string
  conversationHistory?: Array<{ role: string; content: string }>
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured')
    }

    const { message, context, ragContext, conversationHistory } = await req.json() as ChatRequest

    // Build system prompt with STRICT rules
    let systemPrompt = `You are VentureX AI, an expert assistant for Capital One Venture X cardholders.

${VENTURE_X_KNOWLEDGE}

## STRICT RULES - YOU MUST FOLLOW THESE:

1. NEVER invent or calculate numbers yourself. Only use the PRE-COMPUTED FACTS provided below.
2. Travel Eraser is NOT an alternative to portal/direct booking - it's a separate decision about how to PAY for a booking you've already made.
3. When discussing Travel Eraser:
   - Always clarify it means SPENDING miles (not earning)
   - Always mention the opportunity cost (those miles could be transferred for 1.5-2cpp)
   - Always use the exact numbers provided in the context
4. Be concise (2-4 sentences for comparison questions). For "list all benefits" or comprehensive questions, use organized markdown with headers and bullet points — be COMPREHENSIVE and list EVERY known benefit.
5. Start answers directly, no "Sure!" or "Certainly!" or "Great question!"
6. CONVERSATION CONTEXT: When the user's message references prior conversation (e.g., pronouns like "it", "that", phrases like "how much does it cost", "what about"), interpret the question in the context of the CONVERSATION HISTORY provided. Always resolve pronouns and contextual references before answering.
7. SCOPE GUARDRAIL: You are exclusively a Capital One Venture X assistant. If the user asks about competitor credit cards, briefly acknowledge but redirect to Venture X. If the user asks about completely unrelated topics (weather, sports, cooking, etc.), respond: "I can only help with Capital One Venture X card questions."
`

    // Add comparison context with PRE-COMPUTED facts
    if (context?.portalPrice || context?.directPrice) {
      systemPrompt += `
## PRE-COMPUTED FACTS (use these EXACT numbers):

### Booking Comparison
- Portal Price: $${context.portalPrice || 'N/A'}
- Direct Price: $${context.directPrice || 'N/A'}
- Price Difference: $${context.portalPrice && context.directPrice ? Math.abs(context.portalPrice - context.directPrice).toFixed(0) : 'N/A'}
- ${context.portalPrice && context.directPrice && context.portalPrice > context.directPrice ? 'Portal is MORE expensive' : context.portalPrice && context.directPrice ? 'Portal is CHEAPER' : ''}

### Miles EARNED (not spent)
- Portal Booking Earns: ${context.portalMiles?.toLocaleString() || 'N/A'} miles (at 5X)
- Direct Booking Earns: ${context.directMiles?.toLocaleString() || 'N/A'} miles (at 2X)
- Extra Miles from Portal: ${context.portalMiles && context.directMiles ? (context.portalMiles - context.directMiles).toLocaleString() : 'N/A'} miles

### Net Cost Analysis (price minus miles value at 1.8cpp)
- Portal Net Cost: $${context.portalNetCost?.toFixed(0) || 'N/A'}
- Direct Net Cost: $${context.directNetCost?.toFixed(0) || 'N/A'}
- WINNER: ${context.winner || 'N/A'}
- Net Savings: $${context.savings?.toFixed(0) || 'N/A'}
${context.route ? `- Route: ${context.route}` : ''}
${context.creditRemaining ? `- Travel Credit Remaining: $${context.creditRemaining} (applies to Portal only)` : ''}
`

      // Add Travel Eraser calculations if provided
      if (context.eraser) {
        const e = context.eraser
        systemPrompt += `
### Travel Eraser Analysis (SPENDING miles, not earning)
${e.milesBalance ? `- User's Miles Balance: ${e.milesBalance.toLocaleString()} miles` : '- User miles balance: Unknown'}

IF user books PORTAL at $${context.portalPrice} and uses Travel Eraser:
- Miles needed to fully erase: ${e.portalEraserMilesNeeded?.toLocaleString() || 'N/A'} miles
- Cash saved from eraser: $${e.portalEraserValue?.toFixed(0) || 'N/A'}
- Net out-of-pocket: $${e.portalNetAfterEraser?.toFixed(0) || 'N/A'}
- Does NOT earn the ${context.portalMiles?.toLocaleString()} miles (you're paying with miles, not cash)

IF user books DIRECT at $${context.directPrice} and uses Travel Eraser:
- Miles needed to fully erase: ${e.directEraserMilesNeeded?.toLocaleString() || 'N/A'} miles  
- Cash saved from eraser: $${e.directEraserValue?.toFixed(0) || 'N/A'}
- Net out-of-pocket: $${e.directNetAfterEraser?.toFixed(0) || 'N/A'}
- Does NOT earn the ${context.directMiles?.toLocaleString()} miles (you're paying with miles, not cash)

OPPORTUNITY COST: Using Travel Eraser at 1cpp means those miles can't be transferred to partners where they might be worth 1.5-2cpp.
`
      }
    }

    // Add RAG context if available
    if (ragContext) {
      systemPrompt += `
## KNOWLEDGE BASE CONTEXT:
${ragContext}
`
    }

    systemPrompt += `
## RESPONSE GUIDELINES:
- Use **markdown formatting** for all responses — the UI renders markdown
- SELECTIVE BOLDING: Only bold key numbers, dollar amounts, and short important terms — NOT entire sentences. Example: "**2X** miles on all purchases" not "**2X miles on all purchases**"
- Use bullet points (- ) for lists, organized by category when appropriate
- For simple questions: 2-4 sentences with key facts bolded
- For "list all benefits" or comprehensive questions: use organized markdown with headers and bullet points — be COMPREHENSIVE and list EVERY known benefit
- Start each response with a relevant emoji
- Use the PRE-COMPUTED FACTS above - do NOT recalculate
- If asked about Travel Eraser, explain it's about SPENDING miles to offset a purchase
- Distinguish between "miles earned" (from booking) vs "miles spent" (Travel Eraser)
- Do NOT include any source references, citations, numbered markers like [1] [2] [3], or "Sources:" lists in your response. The sources are displayed separately in the UI.
- If asked about a topic and no PRE-COMPUTED FACTS or KNOWLEDGE BASE CONTEXT is provided for it, use the CORRECT Knowledge Base above to answer
- NEVER truncate a list of benefits — if asked to list all benefits, list EVERY one from the Knowledge Base
`

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []).slice(-6),
      { role: 'user', content: message }
    ]

    // Call Groq API
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature: 0.5, // Lower temperature for more consistent math
        max_tokens: 800,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Groq API error:', error)
      throw new Error(`Groq API error: ${response.status}`)
    }

    const data = await response.json()
    const aiResponse = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.'

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse,
        usage: data.usage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
