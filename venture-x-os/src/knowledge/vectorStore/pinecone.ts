// ============================================
// PINECONE VECTOR STORE INTEGRATION
// For semantic search over knowledge base
// ============================================

import { ScrapedDocument } from '../scrapers/reddit';
import { PINECONE_HOST, PINECONE_API_KEY } from '../../config/apiKeys';

// Pinecone configuration
const PINECONE_INDEX_HOST_KEY = 'pinecone_index_host'; // e.g., "venturex-xxx.svc.xxx.pinecone.io"
const PINECONE_API_KEY_KEY = 'pinecone_api_key';
const PINECONE_NAMESPACE = 'venturex-knowledge';

export interface VectorDocument {
  id: string;
  values: number[];
  metadata: {
    source: string;
    title: string;
    content: string; // Truncated for metadata
    url: string;
    author?: string;
    score?: number;
    createdAt?: string;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  source: string;
  title: string;
  content: string;
  url: string;
  author?: string;
}

/**
 * Get Pinecone configuration from storage or use bundled keys
 */
async function getPineconeConfig(): Promise<{ host: string; apiKey: string } | null> {
  const storage = await chrome.storage.local.get([PINECONE_INDEX_HOST_KEY, PINECONE_API_KEY_KEY]);
  
  // Check user-provided config first
  if (storage[PINECONE_INDEX_HOST_KEY] && storage[PINECONE_API_KEY_KEY]) {
    return {
      host: storage[PINECONE_INDEX_HOST_KEY],
      apiKey: storage[PINECONE_API_KEY_KEY],
    };
  }
  
  // Fall back to bundled keys
  const isBundledHostValid = PINECONE_HOST &&
    PINECONE_HOST !== 'YOUR_PINECONE_INDEX_HOST_HERE' &&
    PINECONE_HOST.includes('pinecone');
  const isBundledKeyValid = PINECONE_API_KEY &&
    PINECONE_API_KEY !== 'YOUR_PINECONE_API_KEY_HERE';
  
  if (isBundledHostValid && isBundledKeyValid) {
    return {
      host: PINECONE_HOST.replace('https://', ''), // Remove https:// if present
      apiKey: PINECONE_API_KEY,
    };
  }
  
  return null;
}

/**
 * Save Pinecone configuration to storage
 */
export async function savePineconeConfig(host: string, apiKey: string): Promise<void> {
  await chrome.storage.local.set({
    [PINECONE_INDEX_HOST_KEY]: host,
    [PINECONE_API_KEY_KEY]: apiKey,
  });
  console.log('[Pinecone] Config saved');
}

/**
 * Upsert vectors to Pinecone
 */
export async function upsertVectors(vectors: VectorDocument[]): Promise<boolean> {
  const config = await getPineconeConfig();
  if (!config) {
    console.error('[Pinecone] No configuration found. Please set up Pinecone first.');
    return false;
  }
  
  const url = `https://${config.host}/vectors/upsert`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Api-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vectors: vectors.map(v => ({
          id: v.id,
          values: v.values,
          metadata: v.metadata,
        })),
        namespace: PINECONE_NAMESPACE,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[Pinecone] Upsert error:', error);
      return false;
    }
    
    console.log(`[Pinecone] Upserted ${vectors.length} vectors`);
    return true;
  } catch (error) {
    console.error('[Pinecone] Upsert failed:', error);
    return false;
  }
}

/**
 * Query Pinecone for similar vectors
 */
export async function queryVectors(
  queryVector: number[],
  topK: number = 5,
  filter?: Record<string, unknown>
): Promise<SearchResult[]> {
  const config = await getPineconeConfig();
  if (!config) {
    console.error('[Pinecone] No configuration found');
    return [];
  }
  
  const url = `https://${config.host}/query`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Api-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector: queryVector,
        topK,
        namespace: PINECONE_NAMESPACE,
        includeMetadata: true,
        filter,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[Pinecone] Query error:', error);
      return [];
    }
    
    const data = await response.json();
    
    return (data.matches || []).map((match: {
      id: string;
      score: number;
      metadata?: {
        source?: string;
        title?: string;
        content?: string;
        url?: string;
        author?: string;
      };
    }) => ({
      id: match.id,
      score: match.score,
      source: match.metadata?.source || 'unknown',
      title: match.metadata?.title || '',
      content: match.metadata?.content || '',
      url: match.metadata?.url || '',
      author: match.metadata?.author,
    }));
  } catch (error) {
    console.error('[Pinecone] Query failed:', error);
    return [];
  }
}

/**
 * Delete all vectors in the namespace
 */
export async function deleteAllVectors(): Promise<boolean> {
  const config = await getPineconeConfig();
  if (!config) {
    return false;
  }
  
  const url = `https://${config.host}/vectors/delete`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Api-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deleteAll: true,
        namespace: PINECONE_NAMESPACE,
      }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('[Pinecone] Delete failed:', error);
    return false;
  }
}

/**
 * Get index stats
 */
export async function getIndexStats(): Promise<{ vectorCount: number; dimension: number } | null> {
  const config = await getPineconeConfig();
  if (!config) {
    return null;
  }
  
  const url = `https://${config.host}/describe_index_stats`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Api-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    const namespace = data.namespaces?.[PINECONE_NAMESPACE];
    
    return {
      vectorCount: namespace?.vectorCount || 0,
      dimension: data.dimension || 0,
    };
  } catch (error) {
    console.error('[Pinecone] Stats failed:', error);
    return null;
  }
}

/**
 * Convert scraped documents to vector format (needs embeddings added later)
 */
export function prepareDocumentsForPinecone(
  documents: ScrapedDocument[],
  embeddings: number[][]
): VectorDocument[] {
  return documents.map((doc, idx) => ({
    id: doc.id,
    values: embeddings[idx],
    metadata: {
      source: doc.source,
      title: doc.title,
      content: doc.content.slice(0, 1000), // Pinecone metadata limit
      url: doc.url,
      author: doc.author,
      score: doc.score,
      createdAt: doc.createdAt,
    },
  }));
}
