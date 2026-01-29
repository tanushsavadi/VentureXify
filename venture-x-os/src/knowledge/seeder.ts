// ============================================
// KNOWLEDGE BASE SEEDER
// Orchestrates: Scrape → Embed → Upsert pipeline
// Populates Supabase pgvector with dynamic content
// 
// DEV USE ONLY: Run with `npm run seed`
// ============================================

import { fullRedditScrape, ScrapedDocument } from './scrapers/reddit';
import { getCapitalOneStaticContent } from './scrapers/capitalOne';
import { generateEmbeddings, upsertDocuments, UpsertDocument } from './vectorStore/supabase';

// ============================================
// DATE & FRESHNESS CONFIGURATION
// ============================================

// Only index content from 2024 onwards for policy-related info
// Older content may have outdated rules (e.g., old Travel Eraser minimums)
const POLICY_CUTOFF_DATE = new Date('2024-01-01');

// For general Q&A, we can go back further since experiences are still valuable
const QA_CUTOFF_DATE = new Date('2023-01-01');

// Topics that require strict freshness (policy changes frequently)
const POLICY_KEYWORDS = [
  'minimum', 'miles required', 'redemption', 'eraser', 
  'annual fee', 'bonus', 'credit', 'transfer', 'partner',
  'lounge', 'priority pass', 'tsa precheck', 'global entry'
];

// ============================================
// TYPES
// ============================================

export interface SeedingProgress {
  phase: 'idle' | 'scraping' | 'embedding' | 'upserting' | 'complete' | 'error';
  totalDocuments: number;
  processedDocuments: number;
  successfulUpserts: number;
  errors: string[];
}

export interface SeedingOptions {
  includeReddit?: boolean;
  includeStaticContent?: boolean;
  redditMaxPosts?: number;
  redditIncludeComments?: boolean;
  onProgress?: (progress: SeedingProgress) => void;
}

const DEFAULT_OPTIONS: Required<Omit<SeedingOptions, 'onProgress'>> = {
  includeReddit: true,
  includeStaticContent: true,
  redditMaxPosts: 50,
  redditIncludeComments: true,
};

// ============================================
// FRESHNESS & DATE FILTERING
// ============================================

/**
 * Calculate a freshness score (0-1) for a document based on its date
 * 1.0 = very recent (last 3 months)
 * 0.7 = moderately recent (3-12 months)
 * 0.4 = older (1-2 years)
 * 0.2 = very old (2+ years)
 */
export function calculateFreshnessScore(createdAt: string): number {
  const docDate = new Date(createdAt);
  const now = new Date();
  const ageInDays = (now.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (ageInDays <= 90) return 1.0;      // Last 3 months - very fresh
  if (ageInDays <= 365) return 0.7;     // 3-12 months - moderately fresh
  if (ageInDays <= 730) return 0.4;     // 1-2 years - getting stale
  return 0.2;                            // 2+ years - quite old
}

/**
 * Determine if content is policy-related (requires strict freshness)
 */
function isPolicyContent(content: string, title: string): boolean {
  const text = `${title} ${content}`.toLowerCase();
  return POLICY_KEYWORDS.some(keyword => text.includes(keyword));
}

/**
 * Filter documents based on date and content type
 * - Policy content: only from 2024+
 * - General Q&A: from 2023+
 * Returns the document with an added freshness score
 */
export function filterByFreshness(docs: ScrapedDocument[]): (ScrapedDocument & { freshnessScore: number })[] {
  const now = new Date();
  
  return docs
    .map(doc => ({
      ...doc,
      freshnessScore: calculateFreshnessScore(doc.createdAt),
    }))
    .filter(doc => {
      const docDate = new Date(doc.createdAt);
      
      // Policy content requires stricter freshness
      if (isPolicyContent(doc.content, doc.title)) {
        if (docDate < POLICY_CUTOFF_DATE) {
          console.log(`[Seeder] Skipping outdated policy content: "${doc.title.slice(0, 50)}..." (${doc.createdAt})`);
          return false;
        }
      }
      
      // General content can be a bit older
      if (docDate < QA_CUTOFF_DATE) {
        console.log(`[Seeder] Skipping very old content: "${doc.title.slice(0, 50)}..." (${doc.createdAt})`);
        return false;
      }
      
      return true;
    });
}

/**
 * Add freshness context to document content
 * This helps the AI understand the recency of information
 */
function addFreshnessContext(doc: ScrapedDocument & { freshnessScore: number }): ScrapedDocument {
  const date = new Date(doc.createdAt);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  
  // Add date stamp to content for AI context
  let enhancedContent = doc.content;
  
  // Prepend date context for Reddit content
  if (doc.source === 'reddit-post' || doc.source === 'reddit-comment') {
    enhancedContent = `[From ${dateStr}] ${doc.content}`;
  }
  
  return {
    ...doc,
    content: enhancedContent,
    metadata: {
      ...doc.metadata,
      freshnessScore: doc.freshnessScore,
      indexedAt: new Date().toISOString(),
    },
  };
}

// ============================================
// MAIN SEEDING FUNCTION
// ============================================

/**
 * Main seeding function - orchestrates the full pipeline
 * 1. Scrapes Reddit r/VentureX posts and comments
 * 2. Includes static Capital One content
 * 3. Filters by date (rejects pre-2024 policy content)
 * 4. Generates embeddings for all documents
 * 5. Upserts to Supabase pgvector with freshness scores
 */
export async function seedKnowledgeBase(
  options: SeedingOptions = {}
): Promise<SeedingProgress> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const progress: SeedingProgress = {
    phase: 'idle',
    totalDocuments: 0,
    processedDocuments: 0,
    successfulUpserts: 0,
    errors: [],
  };
  
  const updateProgress = (updates: Partial<SeedingProgress>) => {
    Object.assign(progress, updates);
    opts.onProgress?.(progress);
  };
  
  try {
    // ============================================
    // PHASE 1: SCRAPING
    // ============================================
    updateProgress({ phase: 'scraping' });
    console.log('[Seeder] Starting knowledge base seeding...');
    
    const allDocuments: ScrapedDocument[] = [];
    
    // Scrape Reddit
    if (opts.includeReddit) {
      console.log('[Seeder] Scraping Reddit r/VentureX...');
      try {
        const redditDocs = await fullRedditScrape(
          opts.redditMaxPosts,
          opts.redditIncludeComments,
          15 // comments per post
        );
        allDocuments.push(...redditDocs);
        console.log(`[Seeder] Got ${redditDocs.length} documents from Reddit`);
      } catch (err) {
        const errMsg = `Reddit scrape failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.error('[Seeder]', errMsg);
        progress.errors.push(errMsg);
      }
    }
    
    // Add static Capital One content
    if (opts.includeStaticContent) {
      console.log('[Seeder] Adding static Capital One content...');
      const staticDocs = getCapitalOneStaticContent();
      allDocuments.push(...staticDocs);
      console.log(`[Seeder] Added ${staticDocs.length} static documents`);
    }
    
    if (allDocuments.length === 0) {
      updateProgress({ 
        phase: 'error',
        errors: [...progress.errors, 'No documents to process']
      });
      return progress;
    }
    
    // ============================================
    // PHASE 1.5: DATE FILTERING
    // ============================================
    console.log('[Seeder] Filtering by freshness...');
    const filteredDocs = filterByFreshness(allDocuments);
    const enhancedDocs = filteredDocs.map(addFreshnessContext);
    
    console.log(`[Seeder] After freshness filtering: ${enhancedDocs.length}/${allDocuments.length} documents`);
    
    if (enhancedDocs.length === 0) {
      updateProgress({ 
        phase: 'error',
        errors: [...progress.errors, 'No documents passed freshness filter']
      });
      return progress;
    }
    
    updateProgress({ totalDocuments: enhancedDocs.length });
    
    // ============================================
    // PHASE 2: EMBEDDING
    // ============================================
    updateProgress({ phase: 'embedding' });
    console.log('[Seeder] Generating embeddings...');
    
    // Process in batches to avoid overwhelming the API
    const BATCH_SIZE = 10;
    const documentsWithEmbeddings: UpsertDocument[] = [];
    
    for (let i = 0; i < enhancedDocs.length; i += BATCH_SIZE) {
      const batch = enhancedDocs.slice(i, i + BATCH_SIZE);
      
      // Prepare texts for embedding (combine title + content)
      const texts = batch.map(doc => {
        const combined = `${doc.title}. ${doc.content}`;
        return combined.slice(0, 500); // Limit to 500 chars for embedding
      });
      
      try {
        const embedResponse = await generateEmbeddings(texts);
        
        if (embedResponse.success && embedResponse.embeddings) {
          for (let j = 0; j < batch.length; j++) {
            const embedding = embedResponse.embeddings[j];
            if (embedding && embedding.length === 384) {
              documentsWithEmbeddings.push({
                id: batch[j].id,
                embedding,
                content: batch[j].content,
                title: batch[j].title,
                source: batch[j].source,
                url: batch[j].url,
                author: batch[j].author,
                score: batch[j].score,
              });
            } else {
              progress.errors.push(`Embedding failed for: ${batch[j].id}`);
            }
          }
        } else {
          progress.errors.push(`Batch embedding failed: ${embedResponse.error}`);
        }
      } catch (err) {
        progress.errors.push(`Embedding error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
      
      updateProgress({ processedDocuments: Math.min(i + BATCH_SIZE, enhancedDocs.length) });
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`[Seeder] Generated embeddings for ${documentsWithEmbeddings.length} documents`);
    
    if (documentsWithEmbeddings.length === 0) {
      updateProgress({ 
        phase: 'error',
        errors: [...progress.errors, 'No embeddings generated']
      });
      return progress;
    }
    
    // ============================================
    // PHASE 3: UPSERTING
    // ============================================
    updateProgress({ phase: 'upserting' });
    console.log('[Seeder] Upserting to Supabase...');
    
    // Upsert in batches
    const UPSERT_BATCH_SIZE = 20;
    let totalUpserted = 0;
    
    for (let i = 0; i < documentsWithEmbeddings.length; i += UPSERT_BATCH_SIZE) {
      const batch = documentsWithEmbeddings.slice(i, i + UPSERT_BATCH_SIZE);
      
      try {
        const upsertResponse = await upsertDocuments(batch);
        
        if (upsertResponse.success) {
          totalUpserted += upsertResponse.upserted || 0;
          if (upsertResponse.errors && upsertResponse.errors > 0) {
            progress.errors.push(`Upsert batch had ${upsertResponse.errors} errors`);
          }
        } else {
          progress.errors.push(`Upsert failed: ${upsertResponse.error}`);
        }
      } catch (err) {
        progress.errors.push(`Upsert error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
      
      updateProgress({ successfulUpserts: totalUpserted });
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`[Seeder] Successfully upserted ${totalUpserted} documents`);
    
    // ============================================
    // COMPLETE
    // ============================================
    updateProgress({ 
      phase: 'complete',
      successfulUpserts: totalUpserted
    });
    
    console.log('[Seeder] Knowledge base seeding complete!');
    console.log(`[Seeder] Summary: ${totalUpserted}/${allDocuments.length} documents indexed`);
    console.log(`[Seeder] Filtered out: ${allDocuments.length - enhancedDocs.length} outdated documents`);
    if (progress.errors.length > 0) {
      console.warn('[Seeder] Errors encountered:', progress.errors);
    }
    
    return progress;
    
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Seeder] Fatal error:', errMsg);
    updateProgress({ 
      phase: 'error',
      errors: [...progress.errors, `Fatal: ${errMsg}`]
    });
    return progress;
  }
}

/**
 * Quick seed with just static content (no Reddit scraping)
 * Useful for testing or when Reddit is blocked
 */
export async function seedStaticContentOnly(
  onProgress?: (progress: SeedingProgress) => void
): Promise<SeedingProgress> {
  return seedKnowledgeBase({
    includeReddit: false,
    includeStaticContent: true,
    onProgress,
  });
}

/**
 * Check how many documents are in the knowledge base
 */
export async function getKnowledgeBaseStats(): Promise<{
  configured: boolean;
  documentCount: number;
  lastSynced?: string;
}> {
  // This would require a Supabase query - for now return basic status
  try {
    const { checkSupabaseStatus } = await import('./vectorStore/supabase');
    const status = await checkSupabaseStatus();
    return {
      configured: status.configured,
      documentCount: 0, // Would need a count query
      lastSynced: undefined,
    };
  } catch {
    return {
      configured: false,
      documentCount: 0,
    };
  }
}
