// ============================================
// REDDIT SCRAPER FOR r/VentureX
// Uses Reddit's public JSON API (no auth required for public subreddits)
// ============================================
//
// ARCHITECTURE NOTE:
// This file provides a lightweight JSON API-based Reddit scraper that runs
// INSIDE the Chrome extension (browser context). It's used for runtime
// knowledge refreshes and as a fallback when Supabase is unavailable.
//
// For heavy-duty knowledge base seeding, use the Playwright-based scraper:
//   scripts/playwright-reddit-scraper.cjs
//
// The Playwright scraper runs in Node.js (NOT in the extension) and uses a
// headless browser with stealth plugins to scrape old.reddit.com without
// needing any Reddit API credentials. It populates Supabase pgvector,
// which this extension then queries at runtime.
//
// Scraping strategy:
//   1. SEEDING (Node.js): Playwright → old.reddit.com → Supabase pgvector
//   2. RUNTIME (Extension): This file → reddit.com/.json → Local cache fallback
//
// Run seeding with: npm run seed:playwright
// ============================================

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  score: number;
  numComments: number;
  createdUtc: number;
  permalink: string;
  url: string;
  flair?: string;
}

export interface RedditComment {
  id: string;
  body: string;
  author: string;
  score: number;
  createdUtc: number;
  permalink: string;
  parentId: string;
  postId: string;
}

export interface ScrapedDocument {
  id: string;
  source: 'reddit-post' | 'reddit-comment' | 'capitalone' | 'custom';
  title: string;
  content: string;
  url: string;
  author?: string;
  score?: number;
  createdAt: string;
  scrapedAt: string;
  metadata: Record<string, unknown>;
}

// Reddit JSON API base URL
const REDDIT_BASE = 'https://www.reddit.com';

/**
 * Fetch posts from r/VentureX
 * Uses Reddit's public JSON API - no authentication needed
 */
export async function fetchSubredditPosts(
  subreddit: string = 'VentureX',
  sort: 'hot' | 'new' | 'top' | 'rising' = 'hot',
  limit: number = 25,
  timeFilter: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' = 'all'
): Promise<RedditPost[]> {
  const url = `${REDDIT_BASE}/r/${subreddit}/${sort}.json?limit=${limit}${sort === 'top' ? `&t=${timeFilter}` : ''}`;
  
  console.log(`[RedditScraper] Fetching ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VentureXOS/1.0 (Chrome Extension)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }
    
    const data = await response.json();
    const posts: RedditPost[] = [];
    
    for (const child of data.data?.children || []) {
      const post = child.data;
      posts.push({
        id: post.id,
        title: post.title,
        selftext: post.selftext || '',
        author: post.author,
        score: post.score,
        numComments: post.num_comments,
        createdUtc: post.created_utc,
        permalink: post.permalink,
        url: `${REDDIT_BASE}${post.permalink}`,
        flair: post.link_flair_text,
      });
    }
    
    console.log(`[RedditScraper] Fetched ${posts.length} posts from r/${subreddit}`);
    return posts;
  } catch (error) {
    console.error('[RedditScraper] Error fetching posts:', error);
    return [];
  }
}

/**
 * Fetch comments for a specific post
 */
export async function fetchPostComments(
  postId: string,
  subreddit: string = 'VentureX',
  limit: number = 50
): Promise<RedditComment[]> {
  const url = `${REDDIT_BASE}/r/${subreddit}/comments/${postId}.json?limit=${limit}&depth=3`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VentureXOS/1.0 (Chrome Extension)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }
    
    const data = await response.json();
    const comments: RedditComment[] = [];
    
    // Comments are in the second element of the array
    const commentsData = data[1]?.data?.children || [];
    
    function extractComments(children: unknown[], postId: string) {
      for (const child of children) {
        const c = child as { kind: string; data: Record<string, unknown> };
        if (c.kind !== 't1') continue; // t1 = comment
        
        const comment = c.data;
        
        // Only include comments with some substance (>20 chars) and positive score
        if (
          typeof comment.body === 'string' &&
          comment.body.length > 20 &&
          (comment.score as number) >= 1
        ) {
          comments.push({
            id: comment.id as string,
            body: comment.body as string,
            author: comment.author as string,
            score: comment.score as number,
            createdUtc: comment.created_utc as number,
            permalink: `${REDDIT_BASE}${comment.permalink}`,
            parentId: comment.parent_id as string,
            postId: postId,
          });
        }
        
        // Recursively get replies
        const replies = comment.replies as { data?: { children?: unknown[] } } | undefined;
        if (replies?.data?.children) {
          extractComments(replies.data.children, postId);
        }
      }
    }
    
    extractComments(commentsData, postId);
    return comments;
  } catch (error) {
    console.error(`[RedditScraper] Error fetching comments for ${postId}:`, error);
    return [];
  }
}

/**
 * Search Reddit for specific terms
 */
export async function searchReddit(
  query: string,
  subreddit: string = 'VentureX',
  limit: number = 25
): Promise<RedditPost[]> {
  const url = `${REDDIT_BASE}/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=${limit}&sort=relevance`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VentureXOS/1.0 (Chrome Extension)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Reddit search error: ${response.status}`);
    }
    
    const data = await response.json();
    const posts: RedditPost[] = [];
    
    for (const child of data.data?.children || []) {
      const post = child.data;
      posts.push({
        id: post.id,
        title: post.title,
        selftext: post.selftext || '',
        author: post.author,
        score: post.score,
        numComments: post.num_comments,
        createdUtc: post.created_utc,
        permalink: post.permalink,
        url: `${REDDIT_BASE}${post.permalink}`,
        flair: post.link_flair_text,
      });
    }
    
    return posts;
  } catch (error) {
    console.error('[RedditScraper] Search error:', error);
    return [];
  }
}

/**
 * Convert Reddit posts/comments to ScrapedDocuments
 */
export function redditToDocuments(
  posts: RedditPost[],
  comments: RedditComment[] = []
): ScrapedDocument[] {
  const docs: ScrapedDocument[] = [];
  const now = new Date().toISOString();
  
  // Convert posts
  for (const post of posts) {
    // Only include posts with meaningful content
    if (post.selftext.length > 30 || post.title.length > 20) {
      docs.push({
        id: `reddit-post-${post.id}`,
        source: 'reddit-post',
        title: post.title,
        content: post.selftext || post.title,
        url: post.url,
        author: post.author,
        score: post.score,
        createdAt: new Date(post.createdUtc * 1000).toISOString(),
        scrapedAt: now,
        metadata: {
          numComments: post.numComments,
          flair: post.flair,
          subreddit: 'VentureX',
        },
      });
    }
  }
  
  // Convert comments
  for (const comment of comments) {
    docs.push({
      id: `reddit-comment-${comment.id}`,
      source: 'reddit-comment',
      title: `Comment on r/VentureX`,
      content: comment.body,
      url: comment.permalink,
      author: comment.author,
      score: comment.score,
      createdAt: new Date(comment.createdUtc * 1000).toISOString(),
      scrapedAt: now,
      metadata: {
        postId: comment.postId,
        parentId: comment.parentId,
        subreddit: 'VentureX',
      },
    });
  }
  
  return docs;
}

/**
 * Full scrape of r/VentureX - gets top posts and their comments
 */
export async function fullRedditScrape(
  maxPosts: number = 50,
  includeComments: boolean = true,
  commentsPerPost: number = 20
): Promise<ScrapedDocument[]> {
  console.log('[RedditScraper] Starting full scrape...');
  
  // Get hot, top (month), and top (all time) posts
  const [hotPosts, topMonth, topAll] = await Promise.all([
    fetchSubredditPosts('VentureX', 'hot', Math.floor(maxPosts / 3)),
    fetchSubredditPosts('VentureX', 'top', Math.floor(maxPosts / 3), 'month'),
    fetchSubredditPosts('VentureX', 'top', Math.floor(maxPosts / 3), 'all'),
  ]);
  
  // Deduplicate posts
  const postMap = new Map<string, RedditPost>();
  for (const post of [...hotPosts, ...topMonth, ...topAll]) {
    if (!postMap.has(post.id)) {
      postMap.set(post.id, post);
    }
  }
  
  const allPosts = Array.from(postMap.values());
  console.log(`[RedditScraper] Got ${allPosts.length} unique posts`);
  
  let allComments: RedditComment[] = [];
  
  if (includeComments) {
    // Fetch comments for top posts (by score)
    const sortedPosts = allPosts.sort((a, b) => b.score - a.score).slice(0, 20);
    
    for (const post of sortedPosts) {
      const comments = await fetchPostComments(post.id, 'VentureX', commentsPerPost);
      allComments = [...allComments, ...comments];
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`[RedditScraper] Got ${allComments.length} comments`);
  }
  
  // Convert to documents
  const docs = redditToDocuments(allPosts, allComments);
  console.log(`[RedditScraper] Created ${docs.length} documents`);
  
  return docs;
}
