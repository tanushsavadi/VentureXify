// ============================================
// KNOWLEDGE MODULE - Main Export
// ============================================

// Scrapers
export { 
  fetchSubredditPosts, 
  fetchPostComments, 
  searchReddit, 
  fullRedditScrape 
} from './scrapers/reddit';

export { 
  scrapeCapitalOnePage, 
  fullCapitalOneScrape, 
  getCapitalOneContent,
  CAPITAL_ONE_STATIC_CONTENT 
} from './scrapers/capitalOne';

// Embeddings
export { 
  generateEmbedding, 
  generateEmbeddings, 
  generateQueryEmbedding,
  cosineSimilarity,
  localSimilaritySearch,
  saveHFApiKey,
  getEmbeddingDimension 
} from './embeddings';

// Vector Store
export { 
  savePineconeConfig, 
  upsertVectors, 
  queryVectors, 
  deleteAllVectors,
  getIndexStats,
  prepareDocumentsForPinecone 
} from './vectorStore/pinecone';

// Retrieval
export { 
  updateKnowledgeBase, 
  searchKnowledge, 
  getKnowledgeStatus,
  buildRAGSystemPrompt,
  formatCitationsForDisplay 
} from './retrieval';

// Types
export type { ScrapedDocument, RedditPost, RedditComment } from './scrapers/reddit';
export type { VectorDocument, SearchResult } from './vectorStore/pinecone';
export type { CitedSource, RetrievalResult } from './retrieval';
