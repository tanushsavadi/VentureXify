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

// VentureX knowledge base with CORRECT information
const VENTURE_X_KNOWLEDGE = `
## Capital One Venture X Card - CORRECT Knowledge Base

### Card Overview
- $395 annual fee
- Earn 2X miles on all purchases (base rate)
- Earn 5X miles on flights booked through Capital One Travel portal
- Earn 10X miles on hotels and rental cars booked through Capital One Travel portal
- $300 annual travel credit (Capital One Travel purchases only)
- 10,000 anniversary bonus miles each year (worth ~$180 at 1.8cpp)
- Priority Pass lounge access + Capital One Lounges

### CRITICAL: Travel Eraser - CORRECT Understanding
Travel Eraser is NOT a booking method. It is a POST-PURCHASE statement credit redemption:
- You FIRST book travel (either via portal OR direct)
- You THEN can redeem miles to erase that purchase from your statement
- Redemption rate: 1 cent per mile (1 cpp = 0.01 USD per mile)
- Example: To erase $100, you need 10,000 miles
- Minimum redemption: 5,000 miles ($50)
- Works on purchases made in last 90 days
- Works on ANY travel purchase (flights, hotels, Uber, etc.)

### CRITICAL: Travel Eraser Math
- 1,000 miles = $10 erased
- 10,000 miles = $100 erased
- To fully erase a $767 purchase, you need 76,700 miles
- Travel Eraser is SPENDING miles, not earning them
- If you use Eraser, you lose those miles (opportunity cost)

### Portal vs Direct Decision Framework
Step 1: Compare where to BOOK
- Portal: Higher multiplier (5X), may have higher price
- Direct: Lower multiplier (2X), may have lower price, keep elite status credits

Step 2: After booking, decide HOW TO PAY
- Cash: Keep miles, earn new miles
- Travel Eraser: Spend existing miles at 1cpp to offset cash cost
- Transfer Partners: Spend miles at 1.5-3+ cpp (better value but different use case)

### Miles Valuation
- Conservative: 1.5 cpp (1.5 cents per mile)
- Standard: 1.8 cpp (used in our calculations)
- Aspirational: 2.0+ cpp (transfer partner redemptions)

### Transfer Partners (ALTERNATIVE to Eraser)
- Turkish Miles&Smiles: Great for Star Alliance business/first class
- Emirates Skywards: Emirates flights
- Avianca LifeMiles: Often cheap Star Alliance awards
- Transfer ratio: 1:1 (1,000 Capital One = 1,000 partner miles)
- Transfer time: Usually instant to 2 days
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
4. Be concise (2-4 sentences). Don't repeat all the numbers back - just the key insight.
5. Start answers directly, no "Sure!" or "Certainly!" or "Great question!"
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
## COMMUNITY KNOWLEDGE (cite using [1], [2], etc.):
${ragContext}
`
    }

    systemPrompt += `
## RESPONSE GUIDELINES:
- Use the PRE-COMPUTED FACTS above - do NOT recalculate
- If asked about Travel Eraser, explain it's about SPENDING miles to offset a purchase
- Distinguish between "miles earned" (from booking) vs "miles spent" (Travel Eraser)
- Keep it brief and actionable
- Use emoji sparingly (one per response max)
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
        max_tokens: 400,
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
