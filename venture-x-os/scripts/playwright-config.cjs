// ============================================
// PLAYWRIGHT SCRAPING CONFIGURATION
// Shared config for Reddit & other Playwright scrapers
// ============================================

// ============================================
// USER AGENT ROTATION POOL
// Realistic Chrome UAs on macOS/Windows/Linux
// ============================================

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
];

// ============================================
// VIEWPORT PRESETS
// Randomized to appear more human
// ============================================

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 2560, height: 1440 },
];

// ============================================
// CSS SELECTORS FOR old.reddit.com
// Each selector has a primary and fallback
// ============================================

const SELECTORS = {
  // Post listing page (old.reddit.com/r/VentureX)
  postListing: {
    postContainer: 'div.thing.link',
    postContainerFallback: 'div[data-fullname^="t3_"]',
    title: 'a.title',
    titleFallback: 'p.title > a',
    author: 'a.author',
    authorFallback: '[data-author]',
    score: 'div.score.unvoted',
    scoreFallback: 'span.score.unvoted',
    timestamp: 'time[datetime]',
    timestampFallback: 'time',
    commentCount: 'a.comments',
    commentCountFallback: 'li.first a[data-event-action="comments"]',
    selftext: 'div.expando div.md',
    selftextFallback: 'div.expando .usertext-body .md',
    nextPage: 'span.next-button a',
    nextPageFallback: '.nav-buttons .next-button a',
    flair: 'span.linkflairlabel',
    flairFallback: 'span.flair',
    // Data attributes for extraction
    fullnameAttr: 'data-fullname',
    permalinkAttr: 'data-permalink',
  },

  // Individual post page (old.reddit.com/r/VentureX/comments/xxx)
  postPage: {
    postBody: 'div.expando form div.md',
    postBodyFallback: 'div.expando .usertext-body .md',
    commentContainer: 'div.comment',
    commentContainerFallback: '.sitetable.nestedlisting > div.comment',
    commentBody: 'div.md',
    commentBodyFallback: '.usertext-body .md',
    commentAuthor: 'a.author',
    commentScore: 'span.score.unvoted',
    commentScoreFallback: 'span.score',
    commentTimestamp: 'time[datetime]',
    commentPermalink: 'a.bylink',
    childComments: 'div.child div.comment',
    moreComments: 'span.morecomments a',
  },
};

// ============================================
// TIMING & RATE LIMITING
// ============================================

const TIMING = {
  // Delay between page navigations (ms)
  minPageDelay: 2000,
  maxPageDelay: 5000,

  // Delay between actions within a page (ms)
  minActionDelay: 500,
  maxActionDelay: 1500,

  // Page load timeout (ms)
  pageLoadTimeout: 30000,

  // Selector wait timeout (ms)
  selectorTimeout: 10000,

  // Max retries for a failed page load
  maxRetries: 3,

  // Retry backoff base (ms) - exponential: base * 2^attempt
  retryBackoffBase: 3000,
};

// ============================================
// SCRAPING LIMITS
// ============================================

const LIMITS = {
  // Max pages to paginate per sort type (hot, top/month, top/all)
  maxPagesPerSort: parseInt(process.env.MAX_REDDIT_PAGES || '5', 10),

  // Max posts per page (Reddit default is 25)
  postsPerPage: 25,

  // Max total unique posts to collect
  maxTotalPosts: parseInt(process.env.MAX_POSTS || '50', 10),

  // How many top posts to fetch comments for
  maxPostsForComments: 20,

  // Max comments per post
  maxCommentsPerPost: 30,

  // Max comment depth (nesting level)
  maxCommentDepth: 3,

  // Minimum post score to include
  minPostScore: 1,

  // Minimum comment score to include
  minCommentScore: 1,

  // Minimum content length (chars) for posts/comments
  minContentLength: 20,
};

// ============================================
// HELPERS
// ============================================

/**
 * Get a random item from an array
 */
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get a random user agent
 */
function getRandomUserAgent() {
  return randomFrom(USER_AGENTS);
}

/**
 * Get a random viewport
 */
function getRandomViewport() {
  return randomFrom(VIEWPORTS);
}

/**
 * Get a random delay between min and max (ms)
 */
function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for a random page delay
 */
async function sleepPageDelay() {
  const delay = getRandomDelay(TIMING.minPageDelay, TIMING.maxPageDelay);
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Sleep for a random action delay
 */
async function sleepActionDelay() {
  const delay = getRandomDelay(TIMING.minActionDelay, TIMING.maxActionDelay);
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Try a selector, then a fallback selector
 * Returns null if neither works
 */
async function trySelector(page, primary, fallback, timeout) {
  const waitTimeout = timeout || TIMING.selectorTimeout;
  try {
    await page.waitForSelector(primary, { timeout: waitTimeout });
    return primary;
  } catch {
    if (fallback) {
      try {
        await page.waitForSelector(fallback, { timeout: waitTimeout / 2 });
        return fallback;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Get Playwright browser launch options
 */
function getBrowserLaunchOptions() {
  const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
  const slowMo = parseInt(process.env.PLAYWRIGHT_SLOW_MO || '0', 10);

  return {
    headless,
    slowMo,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
    ],
  };
}

/**
 * Get browser context options
 */
function getContextOptions() {
  const viewport = getRandomViewport();
  const userAgent = getRandomUserAgent();

  return {
    viewport,
    userAgent,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: [],
    geolocation: undefined,
    colorScheme: 'light',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'DNT': '1',
      'Upgrade-Insecure-Requests': '1',
    },
  };
}

module.exports = {
  USER_AGENTS,
  VIEWPORTS,
  SELECTORS,
  TIMING,
  LIMITS,
  randomFrom,
  getRandomUserAgent,
  getRandomViewport,
  getRandomDelay,
  sleepPageDelay,
  sleepActionDelay,
  trySelector,
  getBrowserLaunchOptions,
  getContextOptions,
};
