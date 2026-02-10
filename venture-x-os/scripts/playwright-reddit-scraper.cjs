#!/usr/bin/env node
// ============================================
// PLAYWRIGHT REDDIT SCRAPER
// Headless browser-based Reddit scraper for r/VentureX
// Uses old.reddit.com for simpler, server-rendered HTML
// 
// This is a Node.js script — NOT for use inside the Chrome extension.
// Run via: npm run seed:playwright
// ============================================

const {
  SELECTORS,
  TIMING,
  LIMITS,
  sleepPageDelay,
  sleepActionDelay,
  trySelector,
  getBrowserLaunchOptions,
  getContextOptions,
} = require('./playwright-config.cjs');

// ============================================
// BROWSER LIFECYCLE
// ============================================

let _browser = null;
let _context = null;

/**
 * Launch browser with stealth plugin
 * Uses playwright-extra + puppeteer-extra-plugin-stealth
 */
async function launchBrowser() {
  // Use playwright-extra with stealth for anti-detection
  let chromium;
  try {
    const { chromium: chromiumExtra } = require('playwright-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    chromiumExtra.use(StealthPlugin());
    chromium = chromiumExtra;
    console.log('[Playwright] Using stealth plugin');
  } catch (err) {
    // Fallback to regular playwright if stealth not available
    console.log('[Playwright] Stealth plugin not available, using standard playwright:', err.message);
    const pw = require('playwright');
    chromium = pw.chromium;
  }

  const launchOptions = getBrowserLaunchOptions();
  console.log(`[Playwright] Launching Chromium (headless: ${launchOptions.headless})...`);

  _browser = await chromium.launch(launchOptions);
  
  const contextOptions = getContextOptions();
  _context = await _browser.newContext(contextOptions);

  // Block unnecessary resources to speed up scraping
  await _context.route('**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf}', route => route.abort());
  await _context.route('**/*google*analytics*', route => route.abort());
  await _context.route('**/*facebook*', route => route.abort());
  await _context.route('**/*doubleclick*', route => route.abort());
  await _context.route('**/*ads*', route => route.abort());

  console.log('[Playwright] Browser launched successfully');
  return { browser: _browser, context: _context };
}

/**
 * Close browser and clean up
 */
async function closeBrowser() {
  if (_context) {
    await _context.close().catch(() => {});
    _context = null;
  }
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
  console.log('[Playwright] Browser closed');
}

// ============================================
// PAGE NAVIGATION HELPERS
// ============================================

/**
 * Navigate to a URL with retry logic
 */
async function navigateWithRetry(page, url, maxRetries) {
  const retries = maxRetries || TIMING.maxRetries;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`[Playwright] Navigating to: ${url}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`);
      
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: TIMING.pageLoadTimeout,
      });

      // Check for Reddit rate-limiting / error pages
      const title = await page.title();
      if (title.includes('Too Many Requests') || title.includes('429')) {
        console.log(`[Playwright] Rate limited (429), waiting before retry...`);
        await new Promise(r => setTimeout(r, TIMING.retryBackoffBase * Math.pow(2, attempt)));
        continue;
      }

      // Check for Reddit "you broke Reddit" page
      const body = await page.textContent('body').catch(() => '');
      if (body.includes('all of our servers are busy') || body.includes('you broke reddit')) {
        console.log(`[Playwright] Reddit server busy, waiting before retry...`);
        await new Promise(r => setTimeout(r, TIMING.retryBackoffBase * Math.pow(2, attempt)));
        continue;
      }

      return true;
    } catch (err) {
      console.error(`[Playwright] Navigation error (attempt ${attempt + 1}/${retries}):`, err.message);
      if (attempt < retries - 1) {
        const backoff = TIMING.retryBackoffBase * Math.pow(2, attempt);
        console.log(`[Playwright] Retrying in ${backoff}ms...`);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
  }

  console.error(`[Playwright] Failed to navigate to ${url} after ${retries} attempts`);
  return false;
}

// ============================================
// POST EXTRACTION
// ============================================

/**
 * Extract posts from a listing page (old.reddit.com/r/VentureX/...)
 */
async function extractPostsFromPage(page) {
  const posts = [];
  const sel = SELECTORS.postListing;

  try {
    // Wait for post containers to load
    const containerSelector = await trySelector(
      page,
      sel.postContainer,
      sel.postContainerFallback,
      TIMING.selectorTimeout
    );

    if (!containerSelector) {
      console.log('[Playwright] No post containers found on page');
      return { posts: [], nextPageUrl: null };
    }

    // Extract all posts from the page
    const postElements = await page.$$(containerSelector);
    console.log(`[Playwright] Found ${postElements.length} post elements`);

    for (const postEl of postElements) {
      try {
        const post = await extractSinglePost(postEl, page);
        if (post && post.title && post.title.length > 0) {
          posts.push(post);
        }
      } catch (err) {
        // Skip individual post extraction failures
        continue;
      }
    }

    // Get next page URL for pagination
    let nextPageUrl = null;
    try {
      const nextBtn = await page.$(sel.nextPage) || await page.$(sel.nextPageFallback);
      if (nextBtn) {
        nextPageUrl = await nextBtn.getAttribute('href');
        // Ensure it's an absolute URL
        if (nextPageUrl && !nextPageUrl.startsWith('http')) {
          nextPageUrl = `https://old.reddit.com${nextPageUrl}`;
        }
      }
    } catch {
      // No next page — we're at the end
    }

    return { posts, nextPageUrl };
  } catch (err) {
    console.error('[Playwright] Error extracting posts:', err.message);
    return { posts: [], nextPageUrl: null };
  }
}

/**
 * Extract data from a single post element
 */
async function extractSinglePost(postEl, page) {
  const sel = SELECTORS.postListing;

  // Get post ID from data-fullname attribute
  const fullname = await postEl.getAttribute(sel.fullnameAttr).catch(() => null);
  const id = fullname ? fullname.replace('t3_', '') : null;
  if (!id) return null;

  // Title
  const titleEl = await postEl.$(sel.title) || await postEl.$(sel.titleFallback);
  const title = titleEl ? (await titleEl.textContent()).trim() : '';
  if (!title) return null;

  // Permalink
  const permalink = await postEl.getAttribute(sel.permalinkAttr).catch(() => null)
    || (titleEl ? await titleEl.getAttribute('href').catch(() => null) : null);

  // Author
  const authorEl = await postEl.$(sel.author) || await postEl.$(sel.authorFallback);
  const author = authorEl ? (await authorEl.textContent()).trim() : '[deleted]';

  // Score
  let score = 0;
  const scoreEl = await postEl.$(sel.score) || await postEl.$(sel.scoreFallback);
  if (scoreEl) {
    const scoreText = (await scoreEl.textContent()).trim();
    score = parseInt(scoreText, 10);
    if (isNaN(score)) score = 0;
  }

  // Timestamp
  let createdUtc = Date.now() / 1000;
  const timeEl = await postEl.$(sel.timestamp) || await postEl.$(sel.timestampFallback);
  if (timeEl) {
    const datetime = await timeEl.getAttribute('datetime');
    if (datetime) {
      const parsed = new Date(datetime);
      if (!isNaN(parsed.getTime())) {
        createdUtc = parsed.getTime() / 1000;
      }
    }
  }

  // Comment count
  let numComments = 0;
  const commentEl = await postEl.$(sel.commentCount) || await postEl.$(sel.commentCountFallback);
  if (commentEl) {
    const commentText = (await commentEl.textContent()).trim();
    const match = commentText.match(/(\d+)\s*comment/i);
    if (match) {
      numComments = parseInt(match[1], 10);
    }
  }

  // Flair
  let flair = null;
  const flairEl = await postEl.$(sel.flair) || await postEl.$(sel.flairFallback);
  if (flairEl) {
    flair = (await flairEl.textContent()).trim();
  }

  // Selftext (from listing page — may be truncated or empty)
  let selftext = '';
  const selftextEl = await postEl.$(sel.selftext) || await postEl.$(sel.selftextFallback);
  if (selftextEl) {
    selftext = (await selftextEl.textContent()).trim();
  }

  const url = permalink
    ? `https://www.reddit.com${permalink}`
    : `https://www.reddit.com/r/VentureX/comments/${id}/`;

  return {
    id,
    title,
    selftext,
    author,
    score,
    numComments,
    createdUtc,
    permalink: permalink || `/r/VentureX/comments/${id}/`,
    url,
    flair,
  };
}

// ============================================
// COMMENT EXTRACTION
// ============================================

/**
 * Extract comments from an individual post page
 */
async function extractCommentsFromPostPage(page, postId) {
  const comments = [];
  const sel = SELECTORS.postPage;

  try {
    // Wait for comments to load
    const commentSelector = await trySelector(
      page,
      sel.commentContainer,
      sel.commentContainerFallback,
      TIMING.selectorTimeout
    );

    if (!commentSelector) {
      console.log(`[Playwright] No comments found for post ${postId}`);
      return comments;
    }

    // Extract comments recursively up to max depth
    await extractCommentsRecursive(page, commentSelector, postId, comments, 0);

    return comments;
  } catch (err) {
    console.error(`[Playwright] Error extracting comments for ${postId}:`, err.message);
    return comments;
  }
}

/**
 * Recursively extract comments from the DOM tree
 */
async function extractCommentsRecursive(page, containerSelector, postId, results, depth) {
  if (depth > LIMITS.maxCommentDepth) return;
  if (results.length >= LIMITS.maxCommentsPerPost) return;

  const sel = SELECTORS.postPage;
  const commentElements = await page.$$(containerSelector);

  for (const commentEl of commentElements) {
    if (results.length >= LIMITS.maxCommentsPerPost) break;

    try {
      // Comment body
      const bodyEl = await commentEl.$(sel.commentBody) || await commentEl.$(sel.commentBodyFallback);
      if (!bodyEl) continue;
      const body = (await bodyEl.textContent()).trim();
      if (body.length < LIMITS.minContentLength) continue;

      // Comment ID
      const fullname = await commentEl.getAttribute('data-fullname').catch(() => null);
      const id = fullname ? fullname.replace('t1_', '') : `unknown-${Date.now()}-${results.length}`;

      // Author
      const authorEl = await commentEl.$(sel.commentAuthor);
      const author = authorEl ? (await authorEl.textContent()).trim() : '[deleted]';

      // Score
      let score = 0;
      const scoreEl = await commentEl.$(sel.commentScore) || await commentEl.$(sel.commentScoreFallback);
      if (scoreEl) {
        const scoreText = (await scoreEl.textContent()).trim();
        const parsed = parseInt(scoreText, 10);
        if (!isNaN(parsed)) score = parsed;
      }

      // Only include comments with positive/neutral score
      if (score < LIMITS.minCommentScore) continue;

      // Timestamp
      let createdUtc = Date.now() / 1000;
      const timeEl = await commentEl.$(sel.commentTimestamp);
      if (timeEl) {
        const datetime = await timeEl.getAttribute('datetime');
        if (datetime) {
          const parsed = new Date(datetime);
          if (!isNaN(parsed.getTime())) {
            createdUtc = parsed.getTime() / 1000;
          }
        }
      }

      // Permalink
      let permalink = '';
      const permalinkEl = await commentEl.$(sel.commentPermalink);
      if (permalinkEl) {
        permalink = await permalinkEl.getAttribute('href') || '';
        if (permalink && !permalink.startsWith('http')) {
          permalink = `https://www.reddit.com${permalink}`;
        }
      }

      // Parent ID
      const parentFullname = await commentEl.getAttribute('data-parent-fullname').catch(() => null);

      results.push({
        id,
        body,
        author,
        score,
        createdUtc,
        permalink,
        parentId: parentFullname || `t3_${postId}`,
        postId,
        depth,
      });

      // Recursively extract child comments
      if (depth < LIMITS.maxCommentDepth) {
        const childContainer = await commentEl.$('div.child');
        if (childContainer) {
          const childComments = await childContainer.$$('div.comment');
          for (const childEl of childComments) {
            if (results.length >= LIMITS.maxCommentsPerPost) break;

            try {
              const childBodyEl = await childEl.$(sel.commentBody) || await childEl.$(sel.commentBodyFallback);
              if (!childBodyEl) continue;
              const childBody = (await childBodyEl.textContent()).trim();
              if (childBody.length < LIMITS.minContentLength) continue;

              const childFullname = await childEl.getAttribute('data-fullname').catch(() => null);
              const childId = childFullname ? childFullname.replace('t1_', '') : `child-${Date.now()}-${results.length}`;

              const childAuthorEl = await childEl.$(sel.commentAuthor);
              const childAuthor = childAuthorEl ? (await childAuthorEl.textContent()).trim() : '[deleted]';

              let childScore = 0;
              const childScoreEl = await childEl.$(sel.commentScore) || await childEl.$(sel.commentScoreFallback);
              if (childScoreEl) {
                const st = (await childScoreEl.textContent()).trim();
                const p = parseInt(st, 10);
                if (!isNaN(p)) childScore = p;
              }

              if (childScore < LIMITS.minCommentScore) continue;

              let childCreatedUtc = Date.now() / 1000;
              const childTimeEl = await childEl.$(sel.commentTimestamp);
              if (childTimeEl) {
                const dt = await childTimeEl.getAttribute('datetime');
                if (dt) {
                  const parsed = new Date(dt);
                  if (!isNaN(parsed.getTime())) childCreatedUtc = parsed.getTime() / 1000;
                }
              }

              results.push({
                id: childId,
                body: childBody,
                author: childAuthor,
                score: childScore,
                createdUtc: childCreatedUtc,
                permalink: '',
                parentId: fullname || `t3_${postId}`,
                postId,
                depth: depth + 1,
              });
            } catch {
              continue;
            }
          }
        }
      }
    } catch {
      continue;
    }
  }
}

// ============================================
// FULL SELFTEXT EXTRACTION
// ============================================

/**
 * Navigate to a post page and extract the full selftext + comments
 */
async function fetchFullPost(page, post) {
  // Use old.reddit.com URL for the post
  const oldRedditUrl = `https://old.reddit.com${post.permalink}`;
  
  const success = await navigateWithRetry(page, oldRedditUrl);
  if (!success) {
    return { selftext: post.selftext, comments: [] };
  }

  await sleepActionDelay();

  // Extract full selftext
  let fullSelftext = post.selftext;
  const sel = SELECTORS.postPage;
  
  try {
    const bodyEl = await page.$(sel.postBody) || await page.$(sel.postBodyFallback);
    if (bodyEl) {
      const text = (await bodyEl.textContent()).trim();
      if (text.length > fullSelftext.length) {
        fullSelftext = text;
      }
    }
  } catch {
    // Keep the listing page selftext as fallback
  }

  // Extract comments
  const comments = await extractCommentsFromPostPage(page, post.id);

  return { selftext: fullSelftext, comments };
}

// ============================================
// DOCUMENT CONVERSION
// ============================================

/**
 * Convert scraped posts and comments to the ScrapedDocument format
 * compatible with the existing seed pipeline
 */
function convertToDocuments(posts, allComments) {
  const docs = [];
  const now = new Date().toISOString();

  // Convert posts
  for (const post of posts) {
    if (post.selftext.length < LIMITS.minContentLength && post.title.length < LIMITS.minContentLength) {
      continue;
    }

    docs.push({
      id: `reddit-post-${post.id}`,
      title: post.title,
      content: post.selftext || post.title,
      source: 'reddit-post',
      url: post.url,
      author: post.author,
      score: post.score,
      createdAt: post.createdUtc,
      freshnessScore: calculateFreshnessScore(post.createdUtc),
      metadata: {
        numComments: post.numComments,
        flair: post.flair,
        subreddit: 'VentureX',
        scrapedWith: 'playwright',
        scrapedAt: now,
      },
    });
  }

  // Convert comments
  for (const comment of allComments) {
    if (comment.body.length < LIMITS.minContentLength) continue;

    docs.push({
      id: `reddit-comment-${comment.id}`,
      title: `Comment on r/VentureX`,
      content: comment.body,
      source: 'reddit-comment',
      url: comment.permalink || `https://www.reddit.com/r/VentureX/comments/${comment.postId}/`,
      author: comment.author,
      score: comment.score,
      createdAt: comment.createdUtc,
      freshnessScore: calculateFreshnessScore(comment.createdUtc),
      metadata: {
        postId: comment.postId,
        parentId: comment.parentId,
        depth: comment.depth,
        subreddit: 'VentureX',
        scrapedWith: 'playwright',
        scrapedAt: now,
      },
    });
  }

  return docs;
}

/**
 * Calculate freshness score (0-1) based on age
 */
function calculateFreshnessScore(createdUtc) {
  const now = Date.now() / 1000;
  const ageInDays = (now - createdUtc) / (60 * 60 * 24);

  if (ageInDays <= 90) return 1.0;       // Last 3 months
  if (ageInDays <= 365) return 0.7;      // 3-12 months
  if (ageInDays <= 730) return 0.4;      // 1-2 years
  return 0.2;                             // 2+ years
}

// ============================================
// MAIN SCRAPING ORCHESTRATOR
// ============================================

/**
 * Full Reddit scrape using Playwright
 * Returns an array of documents in the same format as the existing JSON API scraper
 * 
 * @param {Object} options
 * @param {number} options.maxPosts - Maximum number of posts to collect
 * @param {boolean} options.includeComments - Whether to fetch comments for top posts
 * @param {number} options.maxCommentsPerPost - Maximum comments per post
 * @param {Function} options.onProgress - Progress callback (message, percent)
 * @returns {Promise<Array>} Array of ScrapedDocument-compatible objects
 */
async function scrapeRedditWithPlaywright(options = {}) {
  const {
    maxPosts = LIMITS.maxTotalPosts,
    includeComments = true,
    maxCommentsPerPost = LIMITS.maxCommentsPerPost,
    onProgress = () => {},
  } = options;

  console.log('');
  console.log('┌────────────────────────────────────────────────────────┐');
  console.log('│  Playwright Reddit Scraper for r/VentureX              │');
  console.log('│  Target: old.reddit.com (server-rendered HTML)         │');
  console.log('└────────────────────────────────────────────────────────┘');
  console.log('');

  const allPosts = new Map(); // id -> post (for deduplication)
  let allComments = [];

  try {
    // Launch browser
    onProgress('Launching browser...', 0);
    await launchBrowser();
    const page = await _context.newPage();

    // ============================================
    // PHASE 1: Scrape post listings
    // ============================================

    const sortTypes = [
      { sort: 'hot', label: 'Hot', params: '' },
      { sort: 'top', label: 'Top (Month)', params: '?sort=top&t=month' },
      { sort: 'top', label: 'Top (All Time)', params: '?sort=top&t=all' },
    ];

    for (let si = 0; si < sortTypes.length; si++) {
      const sortType = sortTypes[si];
      
      if (allPosts.size >= maxPosts) {
        console.log(`[Playwright] Reached max posts (${maxPosts}), stopping listing scrape`);
        break;
      }

      const baseUrl = `https://old.reddit.com/r/VentureX/${sortType.sort}/${sortType.params}`;
      console.log(`\n[Playwright] === Scraping ${sortType.label} ===`);
      
      let currentUrl = baseUrl;
      let pageNum = 0;

      while (currentUrl && pageNum < LIMITS.maxPagesPerSort && allPosts.size < maxPosts) {
        pageNum++;
        const progressPercent = Math.round(((si * LIMITS.maxPagesPerSort + pageNum) / (sortTypes.length * LIMITS.maxPagesPerSort)) * 40);
        onProgress(`Scraping ${sortType.label} (page ${pageNum})...`, progressPercent);

        const success = await navigateWithRetry(page, currentUrl);
        if (!success) {
          console.log(`[Playwright] Failed to load page, moving to next sort type`);
          break;
        }

        await sleepActionDelay();

        const { posts, nextPageUrl } = await extractPostsFromPage(page);
        
        let newCount = 0;
        for (const post of posts) {
          if (!allPosts.has(post.id)) {
            allPosts.set(post.id, post);
            newCount++;
          }
        }

        console.log(`[Playwright] Page ${pageNum}: ${posts.length} posts found, ${newCount} new (total: ${allPosts.size})`);

        currentUrl = nextPageUrl;
        
        if (currentUrl) {
          // Ensure old.reddit.com URL
          currentUrl = currentUrl.replace('www.reddit.com', 'old.reddit.com');
          await sleepPageDelay();
        }
      }
    }

    const uniquePosts = Array.from(allPosts.values());
    console.log(`\n[Playwright] Total unique posts: ${uniquePosts.length}`);

    // ============================================
    // PHASE 2: Fetch full posts + comments
    // ============================================

    if (includeComments && uniquePosts.length > 0) {
      // Sort by score and take top N for comment extraction
      const topPosts = [...uniquePosts]
        .sort((a, b) => b.score - a.score)
        .slice(0, LIMITS.maxPostsForComments);

      console.log(`\n[Playwright] === Fetching comments for top ${topPosts.length} posts ===`);

      for (let i = 0; i < topPosts.length; i++) {
        const post = topPosts[i];
        const progressPercent = 40 + Math.round((i / topPosts.length) * 50);
        onProgress(`Fetching comments (${i + 1}/${topPosts.length})...`, progressPercent);

        console.log(`[Playwright] [${i + 1}/${topPosts.length}] "${post.title.slice(0, 60)}..." (score: ${post.score})`);

        const { selftext, comments } = await fetchFullPost(page, post);

        // Update post selftext if we got more content
        if (selftext.length > post.selftext.length) {
          post.selftext = selftext;
          allPosts.set(post.id, post);
        }

        allComments = [...allComments, ...comments];
        console.log(`[Playwright]   → ${comments.length} comments extracted`);

        await sleepPageDelay();
      }

      console.log(`\n[Playwright] Total comments: ${allComments.length}`);
    }

    // ============================================
    // PHASE 3: Convert to documents
    // ============================================

    onProgress('Converting to documents...', 95);
    const finalPosts = Array.from(allPosts.values());
    const documents = convertToDocuments(finalPosts, allComments);

    console.log(`\n[Playwright] Created ${documents.length} documents`);
    console.log(`[Playwright]   → ${finalPosts.length} from posts`);
    console.log(`[Playwright]   → ${allComments.length} from comments`);

    onProgress('Complete!', 100);
    return documents;

  } catch (err) {
    console.error('[Playwright] Fatal scraping error:', err.message);
    throw err;
  } finally {
    await closeBrowser();
  }
}

// ============================================
// STANDALONE EXECUTION (for testing)
// ============================================

async function main() {
  console.log('[Playwright] Starting standalone Reddit scrape...');
  console.log('[Playwright] Configuration:');
  console.log(`  Max posts: ${LIMITS.maxTotalPosts}`);
  console.log(`  Max pages per sort: ${LIMITS.maxPagesPerSort}`);
  console.log(`  Include comments: true`);
  console.log(`  Headless: ${process.env.PLAYWRIGHT_HEADLESS !== 'false'}`);
  console.log('');

  try {
    const docs = await scrapeRedditWithPlaywright({
      maxPosts: LIMITS.maxTotalPosts,
      includeComments: true,
      onProgress: (msg, pct) => {
        process.stdout.write(`\r  [${pct}%] ${msg}                    `);
      },
    });

    console.log('\n');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`✅ Scraping complete! ${docs.length} documents created`);
    console.log('════════════════════════════════════════════════════════════');

    // Print summary
    const postDocs = docs.filter(d => d.source === 'reddit-post');
    const commentDocs = docs.filter(d => d.source === 'reddit-comment');
    console.log(`  Posts: ${postDocs.length}`);
    console.log(`  Comments: ${commentDocs.length}`);

    if (postDocs.length > 0) {
      console.log('\n  Sample posts:');
      postDocs.slice(0, 5).forEach(d => {
        console.log(`    - [${d.score}↑] ${d.title.slice(0, 70)}...`);
      });
    }

    // Output as JSON for piping to other tools
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(docs, null, 2));
    }

    return docs;
  } catch (err) {
    console.error('\n❌ Scraping failed:', err.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

// Export for use in seed-knowledge-base.cjs
module.exports = {
  scrapeRedditWithPlaywright,
  launchBrowser,
  closeBrowser,
};
