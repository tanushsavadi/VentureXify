#!/usr/bin/env node
// ============================================
// PLAYWRIGHT TIER 1/2 SCRAPER
// Scrapes high-quality third-party guide sites for Venture X content.
// Uses a 3-tier search strategy:
//   1. Site-native search (if available)
//   2. DuckDuckGo HTML search
//   3. Hardcoded known article URLs (fallback)
// Then visits each result URL to extract article text.
//
// Tier 1: TPG, OMAAT, NerdWallet, Doctor of Credit, Frequent Miler
// Tier 2: Reddit (delegated to playwright-reddit-scraper.cjs)
//
// Run via: node scripts/playwright-tier1-scraper.cjs
//        : node scripts/playwright-tier1-scraper.cjs --visible
// ============================================

const {
  TIMING,
  sleepActionDelay,
  getBrowserLaunchOptions,
  getContextOptions,
  getRandomDelay,
} = require('./playwright-config.cjs');
const fs = require('fs');
const path = require('path');

// ============================================
// CLI FLAGS
// ============================================

const isVisible = process.argv.includes('--visible') || process.argv.includes('--debug');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Max articles per source site
  maxArticlesPerSource: 5,

  // Navigation timeout (ms)
  navigationTimeout: 30000,

  // Content wait after navigation (ms)
  contentWaitTimeout: 10000,

  // Delay between requests to the same site (ms) — be respectful
  interRequestDelayMin: 3000,
  interRequestDelayMax: 5000,

  // Delay between searches (ms)
  interSearchDelayMin: 4000,
  interSearchDelayMax: 7000,

  // Chunk settings
  targetChunkWords: 400,
  minChunkWords: 100,
  maxChunkWords: 600,
  overlapWords: 50,

  // Output path
  outputPath: path.resolve(__dirname, '..', 'data', 'tier1-scraped.json'),

  // Max output size (bytes)
  maxOutputSize: 500 * 1024, // 500KB
};

// ============================================
// SEARCH SOURCES
// Each maps to a source site with its trust tier
// ============================================

const SEARCH_SOURCES = [
  {
    query: 'site:thepointsguy.com "venture x"',
    site: 'thepointsguy.com',
    name: 'The Points Guy',
    tier: 1,
  },
  {
    query: 'site:onemileatatime.com "venture x"',
    site: 'onemileatatime.com',
    name: 'One Mile at a Time',
    tier: 1,
  },
  {
    query: 'site:nerdwallet.com "capital one venture x"',
    site: 'nerdwallet.com',
    name: 'NerdWallet',
    tier: 1,
  },
  {
    query: 'site:doctorofcredit.com "venture x"',
    site: 'doctorofcredit.com',
    name: 'Doctor of Credit',
    tier: 1,
  },
  {
    query: 'site:frequentmiler.com "venture x"',
    site: 'frequentmiler.com',
    name: 'Frequent Miler',
    tier: 1,
  },
];

// ============================================
// SITE-NATIVE SEARCH URLS (Approach 1)
// Try these first before DuckDuckGo
// ============================================

const SITE_SEARCH_URLS = {
  'The Points Guy': 'https://thepointsguy.com/?s=venture+x',
  'One Mile at a Time': 'https://onemileatatime.com/?s=venture+x',
  'NerdWallet': null, // No easy search URL
  'Doctor of Credit': 'https://www.doctorofcredit.com/?s=venture+x',
  'Frequent Miler': 'https://frequentmiler.com/?s=venture+x',
};

// ============================================
// HARDCODED KNOWN ARTICLE URLS (Approach 3 — final fallback)
// ============================================

const KNOWN_ARTICLE_URLS = {
  'The Points Guy': [
    'https://thepointsguy.com/guide/capital-one-venture-x-review/',
    'https://thepointsguy.com/guide/capital-one-venture-x-benefits/',
    'https://thepointsguy.com/news/capital-one-lounge-access-changes/',
    'https://thepointsguy.com/guide/capital-one-transfer-partners/',
  ],
  'One Mile at a Time': [
    'https://onemileatatime.com/guides/capital-one-venture-x-review/',
    'https://onemileatatime.com/guides/capital-one-transfer-partners/',
    'https://onemileatatime.com/news/capital-one-lounge-access/',
  ],
  'NerdWallet': [
    'https://www.nerdwallet.com/reviews/credit-cards/capital-one-venture-x',
    'https://www.nerdwallet.com/article/credit-cards/capital-one-venture-x-rewards-benefits',
  ],
  'Doctor of Credit': [
    'https://www.doctorofcredit.com/capital-one-venture-x-75000-miles-signup-bonus/',
    'https://www.doctorofcredit.com/best-current-credit-card-sign-up-bonuses/',
  ],
  'Frequent Miler': [
    'https://frequentmiler.com/category/capital-one/',
    'https://frequentmiler.com/best-credit-card-offers/',
  ],
};

// ============================================
// ANALYTICS / TRACKING DOMAINS TO BLOCK
// ============================================

const BLOCK_PATTERNS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'facebook.net',
  'adobe.com/b/ss',
  'demdex.net',
  'omtrdc.net',
  'hotjar.com',
  'optimizely.com',
  'adobedtm.com',
  'tags.tiqcdn.com',
  'cdn.cookielaw.org',
  'onetrust.com',
  'segment.com',
  'segment.io',
  'newrelic.com',
  'nr-data.net',
  'fullstory.com',
  'quantserve.com',
  'scorecardresearch.com',
  'mxpnl.com',
  'amplitude.com',
  'heapanalytics.com',
];

// ============================================
// BROWSER LIFECYCLE
// ============================================

let _browser = null;
let _context = null;

async function launchBrowser() {
  let chromium;
  try {
    const { chromium: chromiumExtra } = require('playwright-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    chromiumExtra.use(StealthPlugin());
    chromium = chromiumExtra;
    console.log('[Tier1] Using stealth plugin');
  } catch (err) {
    console.log('[Tier1] Stealth plugin not available, using standard playwright:', err.message);
    const pw = require('playwright');
    chromium = pw.chromium;
  }

  const launchOptions = getBrowserLaunchOptions();
  if (isVisible) {
    launchOptions.headless = false;
  }
  console.log(`[Tier1] Launching Chromium (headless: ${launchOptions.headless})...`);

  _browser = await chromium.launch(launchOptions);

  const contextOptions = getContextOptions();
  contextOptions.viewport = { width: 1920, height: 1080 };
  _context = await _browser.newContext(contextOptions);

  // Block analytics & tracking
  await _context.route('**/*', (route) => {
    const url = route.request().url();
    const resourceType = route.request().resourceType();

    if (BLOCK_PATTERNS.some(p => url.includes(p))) {
      return route.abort();
    }
    if (resourceType === 'media' || resourceType === 'font') {
      return route.abort();
    }
    return route.continue();
  });

  // Anti-bot evasion
  await _context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });

  console.log('[Tier1] Browser launched successfully');
  return { browser: _browser, context: _context };
}

async function closeBrowser() {
  if (_context) {
    await _context.close().catch(() => {});
    _context = null;
  }
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
  console.log('[Tier1] Browser closed');
}

// ============================================
// HELPERS
// ============================================

async function randomSleep(min, max) {
  const delay = getRandomDelay(min || 500, max || 1500);
  await new Promise(resolve => setTimeout(resolve, delay));
}

function urlToSlug(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/www\./, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
}

// ============================================
// APPROACH 1: SITE-NATIVE SEARCH
// ============================================

/**
 * Try a site's own search page and extract article links.
 * Returns URLs found, or [] if unavailable / fails.
 */
async function siteNativeSearch(page, sourceName, siteDomain, maxResults) {
  const searchUrl = SITE_SEARCH_URLS[sourceName];
  if (!searchUrl) {
    console.log(`[Tier1]   No site-native search URL for ${sourceName}`);
    return [];
  }

  console.log(`[Tier1]   Trying site-native search: ${searchUrl}`);

  try {
    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.navigationTimeout,
    });
    await page.waitForTimeout(3000);

    const urls = await page.evaluate(({ domain, max }) => {
      const results = [];
      const seen = new Set();
      const anchors = document.querySelectorAll('a[href]');

      for (const a of anchors) {
        let href = a.href;
        if (!href || !href.startsWith('http')) continue;
        // Must be on the same domain
        if (!href.includes(domain)) continue;
        // Filter out generic pages (home, category indexes without articles)
        if (href === `https://${domain}/` || href === `https://www.${domain}/`) continue;
        // Look for article-like paths (contain year, guide, review, news, etc.)
        const path = new URL(href).pathname;
        if (
          path.length > 10 &&
          !path.endsWith('/page/') &&
          !seen.has(href)
        ) {
          seen.add(href);
          results.push(href);
        }
        if (results.length >= max) break;
      }

      return results;
    }, { domain: siteDomain, max: maxResults });

    console.log(`[Tier1]   Site-native search found ${urls.length} URLs`);
    return urls;
  } catch (err) {
    console.log(`[Tier1]   ⚠ Site-native search failed: ${err.message}`);
    return [];
  }
}

// ============================================
// APPROACH 2: DUCKDUCKGO HTML SEARCH
// ============================================

/**
 * Search DuckDuckGo HTML version for a query and return up to `maxResults` URLs.
 * Returns [] if DuckDuckGo blocks or returns no results.
 */
async function searchDuckDuckGo(page, query, maxResults) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  console.log(`[Tier1]   DuckDuckGo search: ${query}`);

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.navigationTimeout,
    });
    await page.waitForTimeout(2000);

    // Check for any blocking
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes('captcha') || bodyText.includes('robot')) {
      console.log('[Tier1]   ⚠ DuckDuckGo blocked, falling back to direct URLs');
      return [];
    }

    // Extract result URLs
    const results = await page.evaluate((max) => {
      const urls = [];
      const seen = new Set();

      document.querySelectorAll('.result').forEach(result => {
        const link = result.querySelector('a.result__a');
        if (link && link.href) {
          // DuckDuckGo wraps URLs in redirects, extract the actual URL
          let href = link.href;
          const uddgMatch = href.match(/uddg=([^&]+)/);
          if (uddgMatch) {
            href = decodeURIComponent(uddgMatch[1]);
          }
          if (!seen.has(href) && href.startsWith('http')) {
            seen.add(href);
            urls.push(href);
          }
        }
      });

      return urls.slice(0, max);
    }, maxResults);

    console.log(`[Tier1]   DuckDuckGo found ${results.length} result URLs`);
    return results;
  } catch (err) {
    console.log(`[Tier1]   ⚠ DuckDuckGo search failed: ${err.message}`);
    return [];
  }
}

// ============================================
// APPROACH 3: KNOWN ARTICLE URLS (hardcoded fallback)
// ============================================

/**
 * Return hardcoded known article URLs for a source.
 */
function getKnownArticleUrls(sourceName) {
  const urls = KNOWN_ARTICLE_URLS[sourceName] || [];
  if (urls.length > 0) {
    console.log(`[Tier1]   Using ${urls.length} hardcoded known URLs for ${sourceName}`);
  } else {
    console.log(`[Tier1]   No hardcoded URLs available for ${sourceName}`);
  }
  return urls;
}

// ============================================
// COMBINED SEARCH: tries all 3 approaches in order
// ============================================

/**
 * Find article URLs for a source using the 3-tier strategy:
 *   1. Site-native search
 *   2. DuckDuckGo HTML search
 *   3. Hardcoded known URLs
 */
async function findArticleUrls(page, source) {
  const maxResults = CONFIG.maxArticlesPerSource;

  // Approach 1: Site-native search
  let urls = await siteNativeSearch(page, source.name, source.site, maxResults);
  if (urls.length > 0) {
    console.log(`[Tier1]   ✓ Using ${urls.length} URLs from site-native search`);
    return { urls, method: 'site-native-search' };
  }

  // Delay before trying DuckDuckGo
  await randomSleep(CONFIG.interSearchDelayMin, CONFIG.interSearchDelayMax);

  // Approach 2: DuckDuckGo HTML search
  urls = await searchDuckDuckGo(page, source.query, maxResults);
  if (urls.length > 0) {
    console.log(`[Tier1]   ✓ Using ${urls.length} URLs from DuckDuckGo`);
    return { urls, method: 'duckduckgo-search' };
  }

  // Approach 3: Hardcoded known article URLs
  urls = getKnownArticleUrls(source.name);
  if (urls.length > 0) {
    console.log(`[Tier1]   ✓ Using ${urls.length} hardcoded fallback URLs`);
    return { urls, method: 'hardcoded-fallback' };
  }

  console.log(`[Tier1]   ✗ No URLs found for ${source.name} via any method`);
  return { urls: [], method: 'none' };
}

// ============================================
// ARTICLE CONTENT EXTRACTION
// ============================================

/**
 * Extract article text content from a page.
 * Tries <article>, then <main>, then body.
 * Returns { title, content, publishDate }
 */
async function extractArticleContent(page) {
  const title = await page.evaluate(() => {
    // Try og:title first
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) return ogTitle.getAttribute('content');

    // Try h1
    const h1 = document.querySelector('h1');
    if (h1) return h1.textContent.trim();

    return document.title;
  });

  const publishDate = await page.evaluate(() => {
    // Common meta tags for publish date
    const selectors = [
      'meta[property="article:published_time"]',
      'meta[name="date"]',
      'meta[name="publish-date"]',
      'meta[name="DC.date.issued"]',
      'time[datetime]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        return el.getAttribute('content') || el.getAttribute('datetime') || null;
      }
    }
    return null;
  });

  const content = await page.evaluate(() => {
    // Remove clutter
    const removeSelectors = [
      'nav', 'footer', 'header',
      '[class*="cookie"]', '[class*="Cookie"]',
      '[class*="banner"]', '[class*="Banner"]',
      '[class*="overlay"]', '[class*="Overlay"]',
      '[class*="modal"]', '[class*="Modal"]',
      '[class*="popup"]', '[class*="Popup"]',
      '[class*="sidebar"]', '[class*="Sidebar"]',
      '[class*="related"]', '[class*="Related"]',
      '[class*="promo"]', '[class*="Promo"]',
      '[class*="newsletter"]', '[class*="Newsletter"]',
      '[class*="comment"]', '[class*="Comment"]',
      '[class*="social"]', '[class*="Social"]',
      '[class*="share"]', '[class*="Share"]',
      '[class*="ad-"]', '[class*="Ad-"]',
      '[class*="advertisement"]',
      'script', 'style', 'noscript', 'iframe',
      '[aria-hidden="true"]',
    ];

    for (const sel of removeSelectors) {
      try {
        document.querySelectorAll(sel).forEach(el => el.remove());
      } catch {
        // Skip invalid selectors
      }
    }

    // Find the article content area
    const mainEl = document.querySelector('article')
      || document.querySelector('[role="main"]')
      || document.querySelector('main')
      || document.querySelector('.post-content')
      || document.querySelector('.entry-content')
      || document.querySelector('.article-content')
      || document.querySelector('.article-body')
      || document.querySelector('#content')
      || document.body;

    // Extract text preserving structure
    function extractText(node, depth) {
      if (!node) return '';
      if (depth > 20) return '';

      if (node.nodeType === 3) {
        return node.textContent.replace(/\s+/g, ' ');
      }
      if (node.nodeType !== 1) return '';

      const tag = node.tagName.toLowerCase();
      const children = Array.from(node.childNodes)
        .map(c => extractText(c, depth + 1))
        .join('');

      switch (tag) {
        case 'h1': return `\n# ${children.trim()}\n`;
        case 'h2': return `\n## ${children.trim()}\n`;
        case 'h3': return `\n### ${children.trim()}\n`;
        case 'h4':
        case 'h5':
        case 'h6': return `\n#### ${children.trim()}\n`;
        case 'p': return `\n${children.trim()}\n`;
        case 'br': return '\n';
        case 'li': return `\n• ${children.trim()}`;
        case 'ul':
        case 'ol': return `\n${children}\n`;
        case 'strong':
        case 'b': return `**${children.trim()}**`;
        case 'em':
        case 'i': return `_${children.trim()}_`;
        case 'div':
        case 'section':
        case 'article':
        case 'main':
          return `\n${children}\n`;
        case 'span': return children;
        default: return children;
      }
    }

    return extractText(mainEl, 0);
  });

  // Clean up
  const cleaned = content
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .replace(/ \n/g, '\n')
    .trim();

  return { title: title || '', content: cleaned, publishDate };
}

// ============================================
// 404 / ERROR PAGE DETECTION
// ============================================

function isErrorPage(title, content) {
  const lower = (content || '').toLowerCase();
  const titleLower = (title || '').toLowerCase();

  return (
    lower.includes("page not found") ||
    lower.includes("can't find that page") ||
    lower.includes("can\u2019t find that page") ||
    lower.includes("404") ||
    lower.includes("page doesn't exist") ||
    lower.includes("page doesn\u2019t exist") ||
    titleLower.includes("page not found") ||
    titleLower.includes("not found") ||
    titleLower.includes("404") ||
    (content || '').trim().length < 200
  );
}

// ============================================
// CONTENT CHUNKING (same logic as Capital One scraper)
// ============================================

function chunkContent(text) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (paragraphs.length === 0) return [];

  const chunks = [];
  let currentChunk = [];
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).length;

    if (currentWordCount + paraWords > CONFIG.maxChunkWords && currentWordCount >= CONFIG.minChunkWords) {
      chunks.push(currentChunk.join('\n\n'));

      const overlapChunk = [];
      let overlapCount = 0;
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        const words = currentChunk[i].split(/\s+/).length;
        if (overlapCount + words <= CONFIG.overlapWords) {
          overlapChunk.unshift(currentChunk[i]);
          overlapCount += words;
        } else {
          break;
        }
      }
      currentChunk = [...overlapChunk, para];
      currentWordCount = overlapCount + paraWords;
    } else {
      currentChunk.push(para);
      currentWordCount += paraWords;
    }
  }

  if (currentChunk.length > 0) {
    const lastChunkText = currentChunk.join('\n\n');
    const lastWords = lastChunkText.split(/\s+/).length;

    if (lastWords >= CONFIG.minChunkWords || chunks.length === 0) {
      chunks.push(lastChunkText);
    } else if (chunks.length > 0) {
      chunks[chunks.length - 1] += '\n\n' + lastChunkText;
    }
  }

  return chunks;
}

// ============================================
// SCRAPE A SINGLE ARTICLE URL
// ============================================

async function scrapeArticle(page, url, sourceName, tier, searchMethod) {
  console.log(`[Tier1]     Scraping article: ${url}`);

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.navigationTimeout,
    });

    const status = response ? response.status() : null;
    if (status === 404 || status === 403 || status === 410) {
      console.log(`[Tier1]     ⚠ HTTP ${status}, skipping`);
      return [];
    }

    // Wait for content to render
    await page.waitForFunction(() => {
      const body = document.body;
      return body && body.innerText.length > 300;
    }, { timeout: CONFIG.contentWaitTimeout }).catch(() => {
      // Content may not be fully loaded, proceed anyway
    });

    await page.waitForTimeout(2000);

    const { title, content, publishDate } = await extractArticleContent(page);

    if (isErrorPage(title, content)) {
      console.log(`[Tier1]     ⚠ Appears to be error/404 page, skipping`);
      return [];
    }

    if (!content || content.length < 300) {
      console.log(`[Tier1]     ⚠ Insufficient content (${content ? content.length : 0} chars), skipping`);
      return [];
    }

    console.log(`[Tier1]     ✓ Extracted ${content.length} chars: "${(title || '').slice(0, 60)}"`);

    // Chunk the content
    const chunks = chunkContent(content);
    console.log(`[Tier1]     Split into ${chunks.length} chunks`);

    const slug = urlToSlug(url);
    const now = new Date().toISOString();

    return chunks.map((chunkText, idx) => ({
      id: `tier1-${slug}-${idx}`,
      title: `${sourceName} - ${title || 'Article'} - Chunk ${idx + 1}`,
      content: chunkText,
      source: sourceName.toLowerCase().replace(/\s+/g, '-'),
      url: url,
      createdAt: publishDate || new Date().toISOString().split('T')[0],
      metadata: {
        trustTier: tier,
        scrapedAt: now,
        method: `playwright-tier1-${searchMethod}`,
        chunkIndex: idx,
        totalChunks: chunks.length,
        sourceSite: sourceName,
        publishDate: publishDate || null,
      },
    }));
  } catch (err) {
    console.log(`[Tier1]     ✗ Error scraping ${url}: ${err.message}`);
    return [];
  }
}

// ============================================
// MAIN ORCHESTRATOR
// ============================================

async function main() {
  console.log('');
  console.log('┌────────────────────────────────────────────────────────┐');
  console.log('│  Playwright Tier 1 Scraper                             │');
  console.log('│  Target: TPG, OMAAT, NerdWallet, DoC, Frequent Miler   │');
  console.log('│  Method: Site search → DuckDuckGo → Known URLs          │');
  console.log('└────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(`[Tier1] Sources: ${SEARCH_SOURCES.length}`);
  console.log(`[Tier1] Max articles per source: ${CONFIG.maxArticlesPerSource}`);
  console.log(`[Tier1] Output: ${CONFIG.outputPath}`);
  console.log('');

  let allDocuments = [];

  try {
    await launchBrowser();
    const page = await _context.newPage();
    page.setDefaultTimeout(60000);

    for (let si = 0; si < SEARCH_SOURCES.length; si++) {
      const source = SEARCH_SOURCES[si];
      console.log(`\n[Tier1] === [${si + 1}/${SEARCH_SOURCES.length}] ${source.name} ===`);

      // Find article URLs using the 3-tier search strategy
      const { urls, method } = await findArticleUrls(page, source);

      if (urls.length === 0) {
        console.log(`[Tier1]   No results found via any method, skipping ${source.name}`);
        // Delay before next search even on failure
        await randomSleep(CONFIG.interSearchDelayMin, CONFIG.interSearchDelayMax);
        continue;
      }

      // Visit each result URL
      const scrapedUrls = new Set();
      for (let ui = 0; ui < Math.min(urls.length, CONFIG.maxArticlesPerSource); ui++) {
        const articleUrl = urls[ui];

        // Skip duplicate URLs
        if (scrapedUrls.has(articleUrl)) continue;
        scrapedUrls.add(articleUrl);

        // Verify the URL belongs to the expected source site
        if (!articleUrl.includes(source.site)) {
          console.log(`[Tier1]     Skipping off-site URL: ${articleUrl}`);
          continue;
        }

        // 3-5 second delay between ALL article requests
        if (ui > 0) {
          await randomSleep(CONFIG.interRequestDelayMin, CONFIG.interRequestDelayMax);
        }

        const docs = await scrapeArticle(page, articleUrl, source.name, source.tier, method);
        allDocuments.push(...docs);
      }

      // Delay between source searches
      if (si < SEARCH_SOURCES.length - 1) {
        const delay = getRandomDelay(CONFIG.interSearchDelayMin, CONFIG.interSearchDelayMax);
        console.log(`[Tier1] Waiting ${delay}ms before next source...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    await page.close();
  } catch (err) {
    console.error('[Tier1] Fatal error:', err.message);
  } finally {
    await closeBrowser();
  }

  // ============================================
  // OUTPUT — filter and write
  // ============================================

  // Filter out any error pages that slipped through
  const preFilterCount = allDocuments.length;
  allDocuments = allDocuments.filter(doc => !isErrorPage(doc.title, doc.content));
  if (allDocuments.length < preFilterCount) {
    console.log(`[Tier1] Filtered out ${preFilterCount - allDocuments.length} error pages`);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`[Tier1] Scraping complete!`);
  console.log(`[Tier1] Total valid documents: ${allDocuments.length}`);

  if (allDocuments.length === 0) {
    console.log('[Tier1] ⚠ No documents were scraped. All search methods may have failed.');
    console.log('[Tier1]   Tried: site-native search → DuckDuckGo → hardcoded URLs');
    console.log('════════════════════════════════════════════════════════════');
    // Write empty array so downstream scripts don't fail on missing file
    const dataDir = path.dirname(CONFIG.outputPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG.outputPath, '[]', 'utf-8');
    return;
  }

  // Ensure data directory exists
  const dataDir = path.dirname(CONFIG.outputPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`[Tier1] Created directory: ${dataDir}`);
  }

  // Write JSON
  const jsonOutput = JSON.stringify(allDocuments, null, 2);
  const outputSize = Buffer.byteLength(jsonOutput, 'utf-8');

  if (outputSize > CONFIG.maxOutputSize) {
    console.log(`[Tier1] ⚠ Output size (${(outputSize / 1024).toFixed(1)}KB) exceeds ${(CONFIG.maxOutputSize / 1024)}KB limit, trimming...`);
    while (allDocuments.length > 0) {
      const trimmedJson = JSON.stringify(allDocuments, null, 2);
      if (Buffer.byteLength(trimmedJson, 'utf-8') <= CONFIG.maxOutputSize) {
        fs.writeFileSync(CONFIG.outputPath, trimmedJson, 'utf-8');
        break;
      }
      allDocuments.pop();
    }
  } else {
    fs.writeFileSync(CONFIG.outputPath, jsonOutput, 'utf-8');
  }

  const finalSize = fs.statSync(CONFIG.outputPath).size;
  console.log(`[Tier1] Output written to: ${CONFIG.outputPath}`);
  console.log(`[Tier1] Output size: ${(finalSize / 1024).toFixed(1)}KB`);
  console.log('════════════════════════════════════════════════════════════');

  // Summary by source
  console.log('\n  Summary by source:');
  const sourceCounts = {};
  for (const doc of allDocuments) {
    const src = doc.metadata.sourceSite || doc.source;
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }
  for (const [src, count] of Object.entries(sourceCounts)) {
    console.log(`    ${count} chunks ← ${src}`);
  }

  if (allDocuments.length > 0) {
    console.log('\n  Sample document:');
    const sample = allDocuments[0];
    console.log(`    ID: ${sample.id}`);
    console.log(`    Title: ${sample.title}`);
    console.log(`    Content preview: ${sample.content.slice(0, 120)}...`);
  }

  console.log('');
}

// Run if executed directly
if (require.main === module) {
  main().catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
}

module.exports = {
  searchDuckDuckGo,
  siteNativeSearch,
  findArticleUrls,
  scrapeArticle,
  extractArticleContent,
  isErrorPage,
  chunkContent,
  SEARCH_SOURCES,
  KNOWN_ARTICLE_URLS,
  SITE_SEARCH_URLS,
  CONFIG,
};
