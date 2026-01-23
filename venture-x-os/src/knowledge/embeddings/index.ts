// ============================================
// EMBEDDING GENERATION
// Uses HuggingFace's free inference API for embeddings
// Model: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)
// ============================================

import { HUGGINGFACE_API_KEY } from '../../config/apiKeys';

const HF_EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const HF_INFERENCE_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_EMBEDDING_MODEL}`;
const EMBEDDING_DIMENSION = 384;

/**
 * Get HuggingFace API key from storage or use bundled key
 * Note: HuggingFace inference API has a free tier that works for basic usage
 */
async function getHFApiKey(): Promise<string | null> {
  const storage = await chrome.storage.local.get(['hf_api_key']);
  const userKey = storage.hf_api_key;
  
  // Use user-provided key if available, otherwise fall back to bundled key
  if (userKey && userKey.startsWith('hf_')) {
    return userKey;
  }
  
  // Use bundled key if valid
  if (HUGGINGFACE_API_KEY && HUGGINGFACE_API_KEY !== 'YOUR_HF_API_KEY_HERE' && HUGGINGFACE_API_KEY.startsWith('hf_')) {
    return HUGGINGFACE_API_KEY;
  }
  
  // HuggingFace works without a key (rate limited)
  return null;
}

/**
 * Save HuggingFace API key
 */
export async function saveHFApiKey(apiKey: string): Promise<void> {
  await chrome.storage.local.set({ hf_api_key: apiKey });
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = await getHFApiKey();
  
  // Clean and truncate text
  const cleanText = text.replace(/\s+/g, ' ').trim().slice(0, 512);
  
  if (!cleanText) {
    return null;
  }
  
  try {
    const response = await fetch(HF_INFERENCE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        inputs: cleanText,
        options: { wait_for_model: true },
      }),
    });
    
    if (!response.ok) {
      // Check if model is loading
      if (response.status === 503) {
        console.log('[Embeddings] Model loading, waiting...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return generateEmbedding(text); // Retry
      }
      throw new Error(`HF API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Response is an array of embeddings (one per input)
    // Each embedding is an array of 384 numbers
    if (Array.isArray(data) && data.length > 0) {
      // If nested array, get first element
      const embedding = Array.isArray(data[0]) ? data[0] : data;
      
      if (embedding.length === EMBEDDING_DIMENSION) {
        return embedding;
      }
    }
    
    console.error('[Embeddings] Unexpected response format:', data);
    return null;
  } catch (error) {
    console.error('[Embeddings] Error generating embedding:', error);
    return null;
  }
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function generateEmbeddings(
  texts: string[],
  batchSize: number = 10,
  onProgress?: (completed: number, total: number) => void
): Promise<(number[] | null)[]> {
  const embeddings: (number[] | null)[] = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    // Generate embeddings for batch sequentially (to avoid rate limits)
    for (const text of batch) {
      const embedding = await generateEmbedding(text);
      embeddings.push(embedding);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (onProgress) {
      onProgress(Math.min(i + batchSize, texts.length), texts.length);
    }
  }
  
  return embeddings;
}

/**
 * Generate embedding for a query (same as document embedding)
 */
export async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  return generateEmbedding(query);
}

/**
 * Get the embedding dimension
 */
export function getEmbeddingDimension(): number {
  return EMBEDDING_DIMENSION;
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimension');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Local similarity search (when Pinecone is not available)
 */
export function localSimilaritySearch(
  queryEmbedding: number[],
  documentEmbeddings: { id: string; embedding: number[]; metadata: Record<string, unknown> }[],
  topK: number = 5
): { id: string; score: number; metadata: Record<string, unknown> }[] {
  const scored = documentEmbeddings.map(doc => ({
    id: doc.id,
    score: cosineSimilarity(queryEmbedding, doc.embedding),
    metadata: doc.metadata,
  }));
  
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
