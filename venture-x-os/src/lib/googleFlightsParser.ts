// ============================================
// GOOGLE FLIGHTS URL PARSER
// Extracts flight details from Google Flights booking URLs
// ============================================

import airlinesData from '../data/airlines.json';

/**
 * Flight details extracted from Google Flights URL
 */
export interface GoogleFlightDetails {
  origin?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  airline?: string;
  airlines?: string[]; // All airlines found (for codeshare detection)
  flightNumbers?: string[];
  stops?: string[]; // Layover airports (all - for backward compatibility)
  outboundStops?: string[]; // Outbound leg layovers only
  returnStops?: string[]; // Return leg layovers only
  isRoundTrip?: boolean;
}

/**
 * Airline data structure from airlines.json
 */
interface AirlineEntry {
  code: string;
  name: string;
  aliases: string[];
  alliance: string | null;
}

/**
 * Build alliance membership map dynamically from airlines.json
 * This allows adding new airlines to the JSON file and having alliance detection
 * work automatically without code changes.
 */
function buildAllianceMap(): Map<string, Set<string>> {
  const allianceMap = new Map<string, Set<string>>();
  
  for (const airline of (airlinesData as { airlines: AirlineEntry[] }).airlines) {
    if (airline.alliance) {
      if (!allianceMap.has(airline.alliance)) {
        allianceMap.set(airline.alliance, new Set());
      }
      const members = allianceMap.get(airline.alliance)!;
      // Add the main name and all aliases
      members.add(airline.name.toLowerCase());
      for (const alias of airline.aliases) {
        members.add(alias.toLowerCase());
      }
    }
  }
  
  return allianceMap;
}

/**
 * Build a lookup from airline name/alias to alliance
 */
function buildAirlineToAllianceLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  
  for (const airline of (airlinesData as { airlines: AirlineEntry[] }).airlines) {
    if (airline.alliance) {
      lookup.set(airline.name.toLowerCase(), airline.alliance);
      for (const alias of airline.aliases) {
        lookup.set(alias.toLowerCase(), airline.alliance);
      }
    }
  }
  
  return lookup;
}

// Pre-build the maps at module load time for efficiency
const ALLIANCE_MEMBERS = buildAllianceMap();
const AIRLINE_TO_ALLIANCE = buildAirlineToAllianceLookup();

/**
 * Find the alliance for a given airline name (fuzzy match)
 */
function findAirlineAlliance(airlineName: string): string | null {
  const normalized = airlineName.toLowerCase().trim();
  
  // Direct lookup
  if (AIRLINE_TO_ALLIANCE.has(normalized)) {
    return AIRLINE_TO_ALLIANCE.get(normalized)!;
  }
  
  // Partial match - check if the airline name starts with any known name
  const firstWord = normalized.split(' ')[0];
  for (const [name, alliance] of AIRLINE_TO_ALLIANCE.entries()) {
    if (name.startsWith(firstWord) || firstWord.startsWith(name.split(' ')[0])) {
      return alliance;
    }
  }
  
  return null;
}

/**
 * Check if two airlines are partners (same alliance or known codeshare)
 * Uses the airlines.json data file for dynamic alliance lookup
 */
export function areAirlinesPartners(airline1: string, airline2: string): boolean {
  if (!airline1 || !airline2) return false;
  
  const a1Lower = airline1.toLowerCase().trim();
  const a2Lower = airline2.toLowerCase().trim();
  
  // Direct match (case-insensitive)
  if (a1Lower === a2Lower) return true;
  
  // Partial name match (e.g., "Delta" matches "Delta Air Lines")
  const a1FirstWord = a1Lower.split(' ')[0];
  const a2FirstWord = a2Lower.split(' ')[0];
  if (a1Lower.includes(a2FirstWord) || a2Lower.includes(a1FirstWord)) {
    return true;
  }
  
  // Check if both are in the same alliance using dynamic lookup
  const alliance1 = findAirlineAlliance(airline1);
  const alliance2 = findAirlineAlliance(airline2);
  
  if (alliance1 && alliance2 && alliance1 === alliance2) {
    console.log(`[Airline Match] ${airline1} and ${airline2} are ${alliance1} alliance partners`);
    return true;
  }
  
  return false;
}

/**
 * Parse Google Flights booking URL tfs parameter
 * The tfs parameter contains base64-encoded flight details
 */
export function parseGoogleFlightsUrl(url: string): GoogleFlightDetails | null {
  try {
    const urlObj = new URL(url);
    const tfsParam = urlObj.searchParams.get('tfs');
    
    if (!tfsParam) {
      console.log('[GF Parser] No tfs parameter found');
      return null;
    }
    
    console.log('[GF Parser] Parsing tfs parameter...');
    
    // The tfs parameter contains flight data - we can extract info from it
    // Format: base64-encoded protobuf-like structure
    // We'll extract using regex patterns instead of full decoding
    
    const details: GoogleFlightDetails = {};
    
    // Try to decode and extract readable parts
    // Google Flights tfs contains readable airport codes, dates, and flight numbers
    // NOTE: Google uses URL-safe base64 which uses - and _ instead of + and /
    let decoded = '';
    try {
      // Convert URL-safe base64 to standard base64
      const standardBase64 = tfsParam
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      decoded = atob(standardBase64);
      console.log('[GF Parser] Base64 decode succeeded');
    } catch (e) {
      // If base64 decode fails, work with the original string
      console.log('[GF Parser] Base64 decode failed, using raw string');
      decoded = tfsParam;
    }
    
    console.log('[GF Parser] Decoded data sample:', decoded.substring(0, 200));
    
    // Extract airport codes (3-letter IATA codes) - preserve order for proper destination detection
    const airportPattern = /\b([A-Z]{3})\b/g;
    const airportMatches = Array.from(decoded.matchAll(airportPattern));
    // Keep airports in order of appearance (not unique yet) to detect the pattern
    const airportsInOrder = airportMatches.map(m => m[1]);
    
    // Filter out non-airport codes - comprehensive list to avoid false positives
    const nonAirportCodes = [
      // Currencies
      'USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'CHF', 'JPY', 'CNY', 'INR', 'SGD', 'HKD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RUB', 'BRL', 'MXN', 'ZAR', 'TRY', 'KRW', 'THB', 'MYR', 'PHP', 'IDR', 'VND',
      // Months
      'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
      // Days
      'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN',
      // Common words that might appear in encoded data
      'THE', 'AND', 'FOR', 'BUT', 'NOT', 'ARE', 'WAS', 'HAS', 'HAD', 'GET', 'SET', 'PUT', 'NEW', 'OLD', 'ALL', 'ANY', 'ONE', 'TWO', 'TEN', 'PER', 'VIA', 'OFF', 'OUT', 'MIN', 'MAX', 'AVG', 'NET', 'SUM', 'ADD', 'SUB', 'MUL', 'DIV', 'END', 'TOP', 'BOT', 'MID', 'LOW', 'BIG', 'FLY', 'AIR', 'JET', 'SKY',
      // Finance/API terms
      'TAX', 'FEE', 'VAT', 'TIP', 'API', 'URL', 'KEY', 'VAL', 'REF', 'SRC', 'DST', 'ERR', 'LOG', 'MSG', 'ACK', 'NAK', 'SYN', 'FIN', 'RST', 'PSH',
      // Misc Google-specific patterns
      'TFS', 'UTM', 'SID', 'UID', 'PID', 'GID', 'CID', 'AID', 'BID', 'MID', 'RID', 'TID', 'XID',
      // Class/fare codes that look like airports
      'ECO', 'BIZ', 'PRM', 'FIR', 'BAS', 'STD', 'FLX', 'PLU',
    ];
    const filteredAirports = airportsInOrder.filter(code => !nonAirportCodes.includes(code));
    
    // Get unique airports while preserving first-occurrence order
    const validAirports = [...new Set(filteredAirports)];
    
    console.log('[GF Parser] Found airports (in order):', filteredAirports);
    console.log('[GF Parser] Unique airports:', validAirports);
    
    if (validAirports.length >= 2) {
      details.origin = validAirports[0];
      
      // For roundtrip flights like DXB → AMS → LAX → AMS → DXB:
      // - Origin is first airport
      // - Destination is the "farthest" point - NOT the second airport (which could be a layover)
      //
      // The pattern for connecting flights with layovers:
      // - Outbound: DXB → AMS → LAX (origin → layover → destination)
      // - Return: LAX → AMS → DXB (destination → layover → origin)
      //
      // So for a 1-stop roundtrip, we'd see: DXB, AMS, LAX, AMS, DXB
      // The destination is the airport that appears AFTER the first layover but BEFORE we see the origin again
      //
      // Heuristic: For roundtrip with layovers, destination is typically the airport
      // that is NOT the origin and NOT repeated as much as layover airports
      
      // Find the last unique airport before we see origin repeated (for roundtrip)
      // or just the last airport (for one-way)
      const originIndex = filteredAirports.indexOf(details.origin);
      const originLastIndex = filteredAirports.lastIndexOf(details.origin);
      const isRoundTrip = originLastIndex > originIndex;
      
      if (isRoundTrip) {
        // Roundtrip: destination is the last new airport we see before returning to origin
        // Find all airports between first origin and last origin
        const outboundPortion = filteredAirports.slice(0, Math.ceil(filteredAirports.length / 2));
        // Destination is usually the last airport in the outbound portion
        const outboundDestination = outboundPortion[outboundPortion.length - 1];
        
        // But if that's same as origin (shouldn't be), fall back to second-to-last
        if (outboundDestination !== details.origin) {
          details.destination = outboundDestination;
        } else {
          // Fallback: use the airport that appears in the middle of unique airports
          const middleIndex = Math.floor(validAirports.length / 2);
          details.destination = validAirports[middleIndex] || validAirports[validAirports.length - 1];
        }
        details.isRoundTrip = true;
      } else {
        // One-way: destination is the last airport
        details.destination = validAirports[validAirports.length - 1];
        details.isRoundTrip = false;
      }
      
      console.log('[GF Parser] Detected origin:', details.origin, 'destination:', details.destination, 'isRoundTrip:', details.isRoundTrip);
      
      // Extract stops - separate outbound and return for roundtrip flights
      if (validAirports.length > 2) {
        // All layover airports (for backward compatibility)
        details.stops = validAirports.filter(a => a !== details.origin && a !== details.destination);
        console.log('[GF Parser] All layover airports:', details.stops);
        
        // For roundtrip, separate outbound and return stops
        if (isRoundTrip && details.origin && details.destination) {
          // Strategy: Split the airport sequence at the destination
          // For DXB → CDG → LAX → AMS → DXB:
          //   - Outbound: DXB → ... → LAX (stops before first LAX)
          //   - Return: LAX → ... → DXB (stops after first LAX, before final DXB)
          
          const firstDestIndex = filteredAirports.indexOf(details.destination);
          const lastOriginIndex = filteredAirports.lastIndexOf(details.origin);
          
          if (firstDestIndex !== -1 && lastOriginIndex !== -1 && firstDestIndex < lastOriginIndex) {
            // Outbound segment: from first origin to first destination
            const outboundSegment = filteredAirports.slice(0, firstDestIndex + 1);
            // Filter to only layover airports and DEDUPLICATE
            // (the same airport can appear multiple times in protobuf encoding)
            details.outboundStops = [...new Set(
              outboundSegment.filter(a => a !== details.origin && a !== details.destination)
            )];
            
            // Return segment: from first destination to last origin
            const returnSegment = filteredAirports.slice(firstDestIndex, lastOriginIndex + 1);
            // Filter to only layover airports and DEDUPLICATE
            details.returnStops = [...new Set(
              returnSegment.filter(a => a !== details.origin && a !== details.destination)
            )];
            
            console.log('[GF Parser] Outbound stops:', details.outboundStops);
            console.log('[GF Parser] Return stops:', details.returnStops);
          } else {
            // Fallback: couldn't determine segments, assume equal split
            console.log('[GF Parser] Could not definitively split segments, using heuristic');
            // details.stops is already deduplicated unique airports
            const midpoint = Math.ceil(details.stops.length / 2);
            details.outboundStops = details.stops.slice(0, midpoint);
            details.returnStops = details.stops.slice(midpoint);
          }
        } else {
          // One-way flight: all stops are outbound
          details.outboundStops = details.stops;
          details.returnStops = [];
        }
      } else {
        // No stops (nonstop flight)
        details.stops = [];
        details.outboundStops = [];
        details.returnStops = [];
      }
    }
    
    // Extract dates (format: 2026-03-09)
    const datePattern = /(\d{4})-(\d{2})-(\d{2})/g;
    const dateMatches = Array.from(decoded.matchAll(datePattern));
    const dates = [...new Set(dateMatches.map(m => m[0]))];
    
    console.log('[GF Parser] Found dates:', dates);
    
    if (dates.length > 0) {
      details.departDate = dates[0];
      if (dates.length > 1) {
        details.returnDate = dates[1];
        details.isRoundTrip = true;
      }
    }
    
    // Extract airline codes (2-letter IATA codes)
    // Google Flights encodes airlines in multiple ways:
    // 1. Flight numbers like "EY3" or "AA319"
    // 2. In the encoded structure as "*{letter}EY" or similar
    // 3. As standalone codes
    
    // Known airline codes - comprehensive list
    const knownAirlines: Record<string, string> = {
      'AA': 'American Airlines',
      'DL': 'Delta Air Lines',
      'UA': 'United Airlines',
      'WN': 'Southwest Airlines',
      'B6': 'JetBlue Airways',
      'AS': 'Alaska Airlines',
      'NK': 'Spirit Airlines',
      'F9': 'Frontier Airlines',
      'QR': 'Qatar Airways',
      'EK': 'Emirates',
      'EY': 'Etihad Airways',
      'BA': 'British Airways',
      'LH': 'Lufthansa',
      'AF': 'Air France',
      'KL': 'KLM',
      'SQ': 'Singapore Airlines',
      'CX': 'Cathay Pacific',
      'NH': 'ANA',
      'JL': 'Japan Airlines',
      'TK': 'Turkish Airlines',
      'SV': 'Saudia',
      'GF': 'Gulf Air',
      'WY': 'Oman Air',
      'KU': 'Kuwait Airways',
      'MS': 'EgyptAir',
      'RJ': 'Royal Jordanian',
      'AI': 'Air India',
      'AC': 'Air Canada',
      'AM': 'Aeromexico',
      'AV': 'Avianca',
      'LA': 'LATAM',
      'CM': 'Copa Airlines',
      'QF': 'Qantas',
      'NZ': 'Air New Zealand',
      'VA': 'Virgin Australia',
      'VS': 'Virgin Atlantic',
      'IB': 'Iberia',
      'LX': 'Swiss',
      'OS': 'Austrian',
      'SK': 'SAS',
      'AY': 'Finnair',
      'EI': 'Aer Lingus',
      'KE': 'Korean Air',
      'OZ': 'Asiana Airlines',
      'BR': 'EVA Air',
      'CI': 'China Airlines',
      'MU': 'China Eastern',
      'CZ': 'China Southern',
      'CA': 'Air China',
      'HU': 'Hainan Airlines',
      'TG': 'Thai Airways',
      'VN': 'Vietnam Airlines',
      'GA': 'Garuda Indonesia',
      'MH': 'Malaysia Airlines',
    };
    
    // Pattern 1: Standard flight numbers like "EY3", "AA319", "DL1234"
    const flightNumberPattern = /\b([A-Z]{2})(\d{1,4})\b/g;
    const flightMatches = Array.from(decoded.matchAll(flightNumberPattern));
    const airlineCodes = [...new Set(flightMatches.map(m => m[1]))];
    
    console.log('[GF Parser] Found airline codes from flight numbers:', airlineCodes);
    
    // Pattern 2: Look for known 2-letter codes in the decoded string (Google's internal format)
    // In Google Flights tfs, airlines appear as "*{char}XX" where XX is the airline code
    const foundAirlines: string[] = [];
    
    for (const [code, name] of Object.entries(knownAirlines)) {
      // Check for code preceded by non-letter (captures *JEY, etc.)
      const codePattern = new RegExp(`[^A-Z]${code}[^A-Z]|^${code}[^A-Z]|[^A-Z]${code}$`, 'g');
      if (codePattern.test(decoded)) {
        if (!foundAirlines.includes(name)) {
          foundAirlines.push(name);
          console.log('[GF Parser] Found airline code in structure:', code, '=', name);
        }
      }
    }
    
    // Set the primary airline
    if (airlineCodes.length > 0 && knownAirlines[airlineCodes[0]]) {
      details.airline = knownAirlines[airlineCodes[0]];
    } else if (foundAirlines.length > 0) {
      details.airline = foundAirlines[0];
    }
    
    // Store all found airlines for better comparison
    if (foundAirlines.length > 0) {
      console.log('[GF Parser] All airlines found:', foundAirlines);
    }
    
    // Extract flight numbers (reuse earlier matches)
    if (flightMatches.length > 0) {
      details.flightNumbers = flightMatches.map(m => `${m[1]}${m[2]}`);
    }
    
    console.log('[GF Parser] Extracted details:', details);
    
    return details;
  } catch (e) {
    console.error('[GF Parser] Error parsing URL:', e);
    return null;
  }
}

/**
 * Compare two flights to see if they match
 * Returns mismatch details if flights don't match
 */
export interface FlightMismatch {
  type: 'route' | 'dates' | 'airline' | 'stops';
  message: string;
  portalValue: string;
  googleValue: string;
}

export function detectFlightMismatch(
  portalFlight: {
    origin?: string;
    destination?: string;
    departDate?: string;
    returnDate?: string;
    airline?: string;
    airlines?: string[];
    stops?: number;
    outbound?: { stops?: number; stopAirports?: string[]; airlines?: string[] };
    returnFlight?: { stops?: number; airlines?: string[]; stopAirports?: string[] };
  },
  googleUrl: string
): FlightMismatch[] | null {
  const googleFlight = parseGoogleFlightsUrl(googleUrl);
  
  if (!googleFlight) {
    console.log('[Flight Matcher] Could not parse Google Flights URL');
    return null;
  }
  
  const mismatches: FlightMismatch[] = [];
  
  // Check route
  if (portalFlight.origin && googleFlight.origin && portalFlight.origin !== googleFlight.origin) {
    mismatches.push({
      type: 'route',
      message: 'Different origin airport',
      portalValue: portalFlight.origin,
      googleValue: googleFlight.origin,
    });
  }
  
  if (portalFlight.destination && googleFlight.destination && portalFlight.destination !== googleFlight.destination) {
    mismatches.push({
      type: 'route',
      message: 'Different destination airport',
      portalValue: portalFlight.destination,
      googleValue: googleFlight.destination,
    });
  }
  
  // Check dates (allow small formatting differences)
  if (portalFlight.departDate && googleFlight.departDate) {
    const portalDate = portalFlight.departDate.substring(0, 10); // YYYY-MM-DD
    const googleDate = googleFlight.departDate.substring(0, 10);
    if (portalDate !== googleDate) {
      mismatches.push({
        type: 'dates',
        message: 'Different departure date',
        portalValue: portalDate,
        googleValue: googleDate,
      });
    }
  }
  
  if (portalFlight.returnDate && googleFlight.returnDate) {
    const portalDate = portalFlight.returnDate.substring(0, 10);
    const googleDate = googleFlight.returnDate.substring(0, 10);
    if (portalDate !== googleDate) {
      mismatches.push({
        type: 'dates',
        message: 'Different return date',
        portalValue: portalDate,
        googleValue: googleDate,
      });
    }
  }
  
  // Check airline using partner/alliance matching (handles KLM · Delta codeshares)
  if (googleFlight.airline) {
    const portalAirlines = portalFlight.airlines || (portalFlight.airline ? [portalFlight.airline] : []);
    
    // Check for direct match OR partner airline match (same alliance/codeshare)
    const airlineMatch = portalAirlines.some(portalAirline => {
      if (!googleFlight.airline) return false;
      
      // Direct match check (partial name match)
      const directMatch = portalAirline.toLowerCase().includes(googleFlight.airline.toLowerCase().split(' ')[0]) ||
                         googleFlight.airline.toLowerCase().includes(portalAirline.toLowerCase().split(' ')[0]);
      
      // Alliance/codeshare partner check (e.g., Delta and KLM are SkyTeam partners)
      const partnerMatch = areAirlinesPartners(portalAirline, googleFlight.airline);
      
      if (partnerMatch && !directMatch) {
        console.log(`[Flight Matcher] Airline partner match: ${portalAirline} ↔ ${googleFlight.airline} (same alliance/codeshare)`);
      }
      
      return directMatch || partnerMatch;
    });
    
    if (portalAirlines.length > 0 && !airlineMatch) {
      mismatches.push({
        type: 'airline',
        message: 'Different airline',
        portalValue: portalAirlines.join(' + '),
        googleValue: googleFlight.airline,
      });
    }
  }
  
  // Check outbound stops (compare number of stops)
  const portalOutboundStops = portalFlight.outbound?.stops ?? portalFlight.stops;
  if (typeof portalOutboundStops === 'number') {
    // Use separated outbound stops if available, otherwise fall back to total stops
    const googleOutboundStops = googleFlight.outboundStops || googleFlight.stops || [];
    const googleStopsCount = googleOutboundStops.length;
    
    if (portalOutboundStops !== googleStopsCount) {
      mismatches.push({
        type: 'stops',
        message: 'Different number of outbound stops',
        portalValue: portalOutboundStops === 0 ? 'Nonstop' : `${portalOutboundStops} stop${portalOutboundStops > 1 ? 's' : ''}`,
        googleValue: googleStopsCount === 0 ? 'Nonstop' : `${googleStopsCount} stop${googleStopsCount > 1 ? 's' : ''}`,
      });
    }
  }
  
  // Check return stops if round trip
  const portalReturnStops = portalFlight.returnFlight?.stops;
  if (typeof portalReturnStops === 'number' && googleFlight.isRoundTrip) {
    // Use separated return stops for roundtrip flights
    const googleReturnStops = googleFlight.returnStops || [];
    const googleReturnStopsCount = googleReturnStops.length;
    
    if (portalReturnStops !== googleReturnStopsCount) {
      mismatches.push({
        type: 'stops',
        message: 'Different number of return stops',
        portalValue: portalReturnStops === 0 ? 'Nonstop' : `${portalReturnStops} stop${portalReturnStops > 1 ? 's' : ''}`,
        googleValue: googleReturnStopsCount === 0 ? 'Nonstop' : `${googleReturnStopsCount} stop${googleReturnStopsCount > 1 ? 's' : ''}`,
      });
    }
    
    console.log('[Flight Matcher] Portal return stops:', portalReturnStops, 'Google return stops:', googleReturnStopsCount);
  }
  
  // Check return flight airlines if available (with alliance/codeshare support)
  // Compare portal return airlines with all Google airlines to detect mixed-carrier mismatches
  const portalReturnAirlines = portalFlight.returnFlight?.airlines;
  if (portalReturnAirlines && portalReturnAirlines.length > 0 && googleFlight.airline) {
    const returnAirlineMatch = portalReturnAirlines.some((a: string) => {
      if (!googleFlight.airline) return false;
      // Check direct match or partner match
      return a.toLowerCase().includes(googleFlight.airline.toLowerCase().split(' ')[0]) ||
             areAirlinesPartners(a, googleFlight.airline);
    });
    
    if (!returnAirlineMatch) {
      // Check if the Google flight airline matches any portal airline (including partners)
      const allPortalAirlines = [
        ...(portalFlight.airlines || []),
        ...(portalReturnAirlines || [])
      ];
      const anyMatch = allPortalAirlines.some((a: string) => {
        if (!googleFlight.airline) return false;
        return a.toLowerCase().includes(googleFlight.airline.toLowerCase().split(' ')[0]) ||
               areAirlinesPartners(a, googleFlight.airline);
      });
      
      if (!anyMatch) {
        mismatches.push({
          type: 'airline',
          message: 'Return flight airline mismatch',
          portalValue: portalReturnAirlines.join(' + '),
          googleValue: googleFlight.airline,
        });
      }
    }
  }
  
  console.log('[Flight Matcher] Mismatches found:', mismatches.length);
  
  return mismatches.length > 0 ? mismatches : null;
}
