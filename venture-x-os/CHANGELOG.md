# Changelog

All notable changes to VentureXify will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.0] - 2026-02-17

### 🐛 Bug Fixes

#### Airline Program URL Filtering
- Fixed PointsYeah redirect URL missing 8 of 18 Capital One airline transfer partners (BA, CX, AF, QR, TP, BR, JL, AM)
- Root cause: `AppRedesigned.tsx` had a local `buildPointsYeahUrl()` with hardcoded 12-airline string, bypassing the centralized `transferPartnerRegistry.ts`
- Replaced local function with import from `engine/pointsyeah.ts` which dynamically derives all 18 IATA codes from registry
- Fixed `TransferPartnersCard.tsx` hardcoded 8-partner array — now uses `getAirlinePartners()` from registry

### ✨ UX Improvements

#### 3 Booking Methods Guidance
- Added collapsible "📋 What to look for on PointsYeah" guide in ASK phase with ✅/⚠️/❌ indicators per method
- Added step-by-step "📋 What to copy from PointsYeah" instructions in SEARCHING phase
- Added "⚠️ Don't enter 'Buy Points' prices" warning banner + helper text in INPUT phase

#### Dual Entry Mode
- Added ✈️ Airline Miles / 💳 Capital One Miles toggle to award entry sections
- Airline Miles mode: existing flow with added helper text
- Capital One Miles mode: simplified 2-field form (C1 miles + taxes) — bypasses transfer ratio conversion
- Updated `POINTSYEAH_TIPS` with method-specific guidance

### 🔬 New Comparison Features
- **Portal-Cheaper Callout**: Amber warning when booking through Capital One Travel portal is cheaper than award transfer, showing side-by-side cost comparison with savings amount
- **Buy-Miles Comparison Baseline**: Collapsible section showing the cash cost of buying airline miles directly vs transferring Capital One miles, including best-bonus pricing
- **Buy-Miles Registry Data**: Added base pricing, bonus ranges, and promotion frequency data for all 18 airline transfer partners
- **Two new engine functions**: `computeBuyMilesComparison()` and `computePortalCheaperCallout()` with TPG 1.85¢/mile valuation

### 📝 Files Changed
- `src/ui/sidepanel/AppRedesigned.tsx`
- `src/ui/components/glass/TransferPartnersCard.tsx`
- `src/engine/pointsyeah.ts`
- `src/engine/transferPartnerRegistry.ts` (BuyMilesData interface + 18 partner pricing)
- `src/engine/pointsyeah.ts` (comparison functions + updated tips)

### 📄 New Documentation
- `docs/POINTSYEAH_BOOKING_METHODS_DESIGN.md`

---

## [2.0.0] - 2026-01-20

### 🏨 Major: Full Stays (Hotels/Vacation Rentals) Support

VentureXify now fully supports hotel and vacation rental bookings through Capital One Travel, giving you the same powerful comparison tools for stays that you've had for flights.

#### Stays Capture (Capital One Travel)
- **Multi-step booking flow support**: Captures data from availability/results, property "Choose Room", customize, and checkout pages
- **Rich property details**: Property name, star rating, city/area, room type, cancellation policy, meal plans
- **Price breakdown capture**: Per-night rate, total stay cost, taxes & fees, and miles equivalent when shown
- **URL pattern detection**: Automatically detects stays pages via `travel.capitalone.com/stays/*` patterns
- **Resilient parsing**: Uses layered selectors and DOM traversal for robust data extraction

#### Direct Comparison (Google Hotels)
- **One-click compare**: "Compare on Google Hotels" button constructs a search URL with your stay details
- **Google Hotels capture**: Extracts prices from Google's hotel search results
- **Match confidence scoring**: Warns users when property name/dates/occupancy may not match (HIGH/MED/LOW)
- **Provider visibility**: Shows which OTA or direct booking site the price comes from

#### Strategy Engine Updates
- **Booking-type aware**: Engine now branches logic by `BookingType` ("flight" | "stay")
- **Stays-specific multipliers**:
  - Portal Hotels: **10x miles per $** (as shown on portal)
  - Portal Vacation Rentals: **5x miles per $**
  - Direct: **2x miles per $** (baseline)
- **Travel credit integration**: Applies $300 credit to portal bookings with animated UI transitions
- **Double-dip strategy**: "Book portal in cash → earn miles → erase later" logic preserved

### ✨ UX Improvements

#### Home Screen / Empty State
- **Chat-first access**: Users can now open extension and immediately "Ask VentureBot" without a booking flow
- **Smart CTAs**: "Capture from current page" auto-detects flights vs stays
- **Contextual prompts**: Dynamic prompt chips change based on detected booking type

#### Benefits Tab Enhancements
- **Expanded action items**: Now includes Hertz President's Circle activation reminder
- **"How to use" tips**: Expandable sections explaining each benefit's optimal usage
- **"Common mistakes" warnings**: Help users avoid pitfalls like booking direct for credit

#### History Tab
- **Copy summary**: One-click copy of comparison results in a shareable format
- **Share to Reddit**: Pre-fills r/VentureX post with your comparison data
- **Stay comparisons tracked**: History now includes both flight and stay comparisons

#### Onboarding
- **Skip with safe defaults**: Users can skip onboarding; sets:
  - `creditRemaining = 300`
  - `defaultMode = "max_value"`
  - `mileValuationCpp = 0.018` (1.8¢)
  - `showConfidenceLabels = true`
- **Settings always editable**: Skipped values can be changed anytime

### 🔧 Technical Changes

#### New Files
- `src/lib/staysTypes.ts` - Comprehensive type definitions for stays
- `src/content/staysCapture.ts` - Capital One Travel stays capture module
- `src/content/staysDirectCapture.ts` - Google Hotels direct capture
- `src/ui/components/compare/StayDetailsCard.tsx` - Premium stay details display
- `src/ui/components/compare/PriceBreakdown.tsx` - Reusable price breakdown table

#### Updated Files
- `src/content/index.ts` - Added stays detection and initialization
- `src/engine/strategyEngine.ts` - Added `simpleStayCompare()` and stays constants
- `src/background/router.ts` - Added stays message handlers
- `src/ui/components/home/HomeScreen.tsx` - Context-aware booking detection
- `src/ui/components/PerksTab.tsx` - Expanded ActionItem with howToUse/commonMistake
- `src/ui/components/HistoryTab.tsx` - Added copy/share functionality
- `src/storage/userPrefs.ts` - Changed default mode to `max_value`

#### Constants
```typescript
PORTAL_HOTELS_RATE = 10      // 10x miles per $ for hotels
PORTAL_VACATION_RENTALS_RATE = 5  // 5x miles per $ for VR
BASE_RATE = 2                // 2x miles per $ direct
```

### 🐛 Bug Fixes
- Fixed TypeScript type mismatches in confidence level conversions
- Added proper null checks for optional capture fields

### 📝 Notes
- Bottom nav bar **unchanged** (structure and presence preserved per requirements)
- No tracking, no analytics - remains local-first
- No forced account login

---

## [1.x.x] - Previous Releases

See git history for previous release notes.
