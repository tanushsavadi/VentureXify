// ============================================
// CONTENT SANITIZER
// Defends against prompt injection attacks from untrusted sources
// ============================================

// ============================================
// TRUST TIERS
// Higher tier = more trusted = less sanitization
// ============================================

export interface TrustTier {
  tier: 1 | 2 | 3 | 4;
  name: string;
  description: string;
  sanitization: 'none' | 'minimal' | 'moderate' | 'aggressive';
}

export const TRUST_TIERS: Record<string, TrustTier> = {
  // Tier 1: Official sources - highest trust
  'capitalone': { tier: 1, name: 'Capital One Official', description: 'Official Capital One documentation', sanitization: 'none' },
  'capitalone-official': { tier: 1, name: 'Capital One Official', description: 'Official Capital One documentation', sanitization: 'none' },
  
  // Tier 2: Curated editorial - high trust
  'tpg': { tier: 2, name: 'The Points Guy', description: 'Editorial content from TPG', sanitization: 'minimal' },
  'nerdwallet': { tier: 2, name: 'NerdWallet', description: 'Editorial content from NerdWallet', sanitization: 'minimal' },
  'doctorofcredit': { tier: 2, name: 'Doctor of Credit', description: 'Editorial content from DoC', sanitization: 'minimal' },
  
  // Tier 3: Structured user content - medium trust
  'flyertalk': { tier: 3, name: 'FlyerTalk', description: 'FlyerTalk forum posts', sanitization: 'moderate' },
  'reddit-churning': { tier: 3, name: 'r/churning', description: 'Reddit churning community', sanitization: 'moderate' },
  
  // Tier 4: Unstructured user content - low trust
  'reddit': { tier: 4, name: 'Reddit', description: 'General Reddit posts', sanitization: 'aggressive' },
  'reddit-post': { tier: 4, name: 'Reddit Post', description: 'Reddit post content', sanitization: 'aggressive' },
  'reddit-comment': { tier: 4, name: 'Reddit Comment', description: 'Reddit comment content', sanitization: 'aggressive' },
  'unknown': { tier: 4, name: 'Unknown Source', description: 'Unknown or unverified source', sanitization: 'aggressive' },
};

// ============================================
// INJECTION PATTERNS TO DETECT
// ============================================

const INJECTION_PATTERNS: RegExp[] = [
  // Direct instruction override attempts
  /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /override\s+(system|previous|all)\s+(prompt|instructions?)/i,
  
  // Role confusion attempts
  /you\s+are\s+now\s+(?:a\s+)?(different|new|evil|malicious)/i,
  /pretend\s+(?:to\s+be|you'?re)\s+(?:a\s+)?/i,
  /act\s+as\s+(?:if\s+)?(?:you'?re|a)\s+/i,
  /roleplay\s+as/i,
  
  // System prompt extraction attempts
  /what\s+(?:are|is)\s+your\s+(system\s+)?prompt/i,
  /reveal\s+your\s+(system\s+)?prompt/i,
  /show\s+(?:me\s+)?your\s+(system\s+)?instructions/i,
  /print\s+(?:your\s+)?(?:system\s+)?prompt/i,
  
  // Jailbreak patterns
  /do\s+anything\s+now/i,
  /developer\s+mode/i,
  /DAN\s+mode/i,
  /jailbreak/i,
  
  // Code injection patterns
  /<\/?script/i,
  /javascript:/i,
  /on(?:load|error|click)=/i,
  /eval\s*\(/i,
  
  // Markdown/formatting abuse
  /```(?:system|assistant|user)/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<<SYS>>/i,
  /<\|(?:im_start|im_end|system|user|assistant)\|>/i,
  
  // Command injection
  /\$\{.*\}/,  // Template literals
  /`.*`/,     // Backtick commands (but careful - this could be legitimate code discussion)
];

// Patterns to soften (convert from imperative to claim)
const IMPERATIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /you\s+should\s+(always|never)/gi, replacement: 'some suggest to $1' },
  { pattern: /you\s+must\s+(always|never)/gi, replacement: 'it is claimed you should $1' },
  { pattern: /always\s+book/gi, replacement: 'consider booking' },
  { pattern: /never\s+book/gi, replacement: 'some advise against booking' },
  { pattern: /the\s+best\s+way\s+is/gi, replacement: 'one approach is' },
  { pattern: /you\s+have\s+to/gi, replacement: 'you might want to' },
];

// ============================================
// SANITIZE RESULT
// ============================================

export interface SanitizeResult {
  sanitized: string;
  original: string;
  wasModified: boolean;
  injectionDetected: boolean;
  detectedPatterns: string[];
  trustTier: TrustTier;
}

// ============================================
// CONTENT SANITIZER CLASS
// ============================================

export class ContentSanitizer {
  private injectionLog: Array<{ timestamp: string; source: string; pattern: string }> = [];
  
  /**
   * Sanitize content based on trust tier
   */
  sanitize(content: string, source: string): SanitizeResult {
    const trustTier = this.getTrustTier(source);
    const detectedPatterns: string[] = [];
    let sanitized = content;
    let injectionDetected = false;
    
    // Check for injection patterns
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        injectionDetected = true;
        detectedPatterns.push(pattern.source);
      }
    }
    
    // Apply sanitization based on trust tier
    switch (trustTier.sanitization) {
      case 'none':
        // Tier 1: No sanitization needed
        break;
        
      case 'minimal':
        // Tier 2: Only remove blatant injection attempts
        if (injectionDetected) {
          sanitized = this.removeInjectionPatterns(content);
        }
        break;
        
      case 'moderate':
        // Tier 3: Remove injections and soften imperatives
        sanitized = this.removeInjectionPatterns(content);
        sanitized = this.softenImperatives(sanitized);
        break;
        
      case 'aggressive':
        // Tier 4: Full sanitization - wrap in claim format
        sanitized = this.removeInjectionPatterns(content);
        sanitized = this.softenImperatives(sanitized);
        sanitized = this.wrapInClaimFormat(sanitized, source);
        break;
    }
    
    return {
      sanitized,
      original: content,
      wasModified: sanitized !== content,
      injectionDetected,
      detectedPatterns,
      trustTier,
    };
  }
  
  /**
   * Quick check if content is safe (no injection patterns)
   */
  isSafe(content: string): boolean {
    return !INJECTION_PATTERNS.some(pattern => pattern.test(content));
  }
  
  /**
   * Log an injection attempt for monitoring
   */
  logInjectionAttempt(content: string, source: string): void {
    const detectedPatterns = INJECTION_PATTERNS
      .filter(pattern => pattern.test(content))
      .map(pattern => pattern.source);
    
    for (const pattern of detectedPatterns) {
      this.injectionLog.push({
        timestamp: new Date().toISOString(),
        source,
        pattern,
      });
    }
    
    console.warn(`[ContentSanitizer] Injection attempt detected from ${source}:`, detectedPatterns);
  }
  
  /**
   * Get injection log for telemetry
   */
  getInjectionLog(): Array<{ timestamp: string; source: string; pattern: string }> {
    return [...this.injectionLog];
  }
  
  /**
   * Clear injection log
   */
  clearInjectionLog(): void {
    this.injectionLog = [];
  }
  
  // ============================================
  // PRIVATE METHODS
  // ============================================
  
  private getTrustTier(source: string): TrustTier {
    const normalizedSource = source.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // Check for exact match
    if (TRUST_TIERS[normalizedSource]) {
      return TRUST_TIERS[normalizedSource];
    }
    
    // Check for partial matches
    for (const [key, tier] of Object.entries(TRUST_TIERS)) {
      if (normalizedSource.includes(key) || key.includes(normalizedSource)) {
        return tier;
      }
    }
    
    // Default to unknown (tier 4)
    return TRUST_TIERS.unknown;
  }
  
  private removeInjectionPatterns(content: string): string {
    let sanitized = content;
    
    for (const pattern of INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    
    return sanitized;
  }
  
  private softenImperatives(content: string): string {
    let softened = content;
    
    for (const { pattern, replacement } of IMPERATIVE_PATTERNS) {
      softened = softened.replace(pattern, replacement);
    }
    
    return softened;
  }
  
  private wrapInClaimFormat(content: string, source: string): string {
    const sourceLabel = this.getSourceLabel(source);
    
    // Truncate if too long (max 500 chars for user content)
    const truncated = content.length > 500 
      ? content.substring(0, 497) + '...' 
      : content;
    
    return `[${sourceLabel} claims:] "${truncated}" [End of user-submitted content]`;
  }
  
  private getSourceLabel(source: string): string {
    const tier = this.getTrustTier(source);
    
    switch (tier.tier) {
      case 1:
        return 'Official source';
      case 2:
        return `${tier.name}`;
      case 3:
        return `${tier.name} user`;
      case 4:
      default:
        return 'Unverified user';
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const contentSanitizer = new ContentSanitizer();
