#!/usr/bin/env node
// ============================================
// PLAYWRIGHT CAPITAL ONE SCRAPER
// Headless browser-based scraper for Capital One Venture X pages
// Uses full JS rendering to expand dropdowns, accordions, tabs
//
// This is a Node.js script — NOT for use inside the Chrome extension.
// Run via: node scripts/playwright-capitalone-scraper.cjs
//        : node scripts/playwright-capitalone-scraper.cjs --visible
//        : node scripts/playwright-capitalone-scraper.cjs --debug
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
// TIER 0 URLs FROM venturexSources.ts
// ============================================

const TIER0_URLS = [
  {
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    title: 'Venture X – Official Card Page',
  },
  {
    url: 'https://www.capitalone.com/learn-grow/more-than-money/all-about-venture-x/',
    title: 'All About Venture X (Official explainer + lounge rule changes)',
  },
  {
    url: 'https://www.capitalone.com/credit-cards/disclosures/airport-lounge-terms/',
    title: 'Airport Lounge Terms & Conditions',
  },
  {
    url: 'https://www.capitalone.com/learn-grow/more-than-money/how-to-enroll-priority-pass/',
    title: 'How to Enroll in Priority Pass (Official)',
  },
  {
    url: 'https://www.capitalone.com/learn-grow/more-than-money/all-about-priority-pass-and-venture-x/',
    title: 'Priority Pass for Venture X (Official)',
  },
  {
    url: 'https://www.capitalone.com/learn-grow/money-management/venture-miles-transfer-partnerships/',
    title: 'Venture Miles Transfer Partners (Official)',
  },
  {
    url: 'https://www.capitalone.com/credit-cards/benefits-guide/',
    title: 'Network Benefits Guides (Official entry point; Visa Infinite guide)',
  },
];

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Per-page navigation timeout (ms)
  navigationTimeout: 45000,

  // Content wait timeout after navigation (ms)
  contentWaitTimeout: 15000,

  // Extra settle time for JS-rendered content (ms)
  jsSettleDelay: 3000,

  // Max time to spend expanding interactive elements per page (ms)
  expandTimeout: 15000,

  // Delay after expanding elements for content to render (ms)
  postExpandDelay: 2000,

  // Max retries per URL
  maxRetries: 2,

  // Chunk settings
  targetChunkWords: 400,
  minChunkWords: 100,
  maxChunkWords: 600,
  overlapWords: 50,

  // Output path
  outputPath: path.resolve(__dirname, '..', 'data', 'capitalone-scraped.json'),

  // Max output size (bytes)
  maxOutputSize: 500 * 1024, // 500KB
};

// ============================================
// ANALYTICS / TRACKING DOMAINS TO BLOCK
// These cause networkidle to never resolve and
// aren't needed for text extraction.
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
// URL DISCOVERY
// ============================================

/**
 * Discover current Venture X URLs by crawling seed pages.
 * Capital One reorganizes their site periodically, so hardcoded URLs go stale.
 * This finds live links containing venture/lounge/transfer-partner keywords.
 */
async function discoverVentureXUrls(page) {
  console.log('[CapitalOne] Discovering current Venture X URLs...');
  const discoveredUrls = [];

  const seedUrls = [
    'https://www.capitalone.com/credit-cards/',
    'https://www.capitalone.com/credit-cards/venture-x/',
    'https://www.capitalone.com/learn-grow/',
  ];

  for (const seedUrl of seedUrls) {
    try {
      await page.goto(seedUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);

      // Check if this seed page is itself a 404
      const title = await page.title();
      if (title.toLowerCase().includes('not found') || title.toLowerCase().includes('404')) {
        console.log(`[CapitalOne]   Seed page is 404, skipping: ${seedUrl}`);
        continue;
      }

      // Find all links containing venture-related keywords
      const links = await page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a[href]'));
        return allLinks
          .map(a => a.href)
          .filter(href =>
            href.includes('venture') ||
            href.includes('lounge') ||
            href.includes('priority-pass') ||
            href.includes('transfer-partner') ||
            href.includes('travel-credit')
          )
          .filter(href => href.startsWith('https://www.capitalone.com/'))
          .filter((href, i, arr) => arr.indexOf(href) === i); // dedupe
      });

      discoveredUrls.push(...links);
      console.log(`[CapitalOne]   Found ${links.length} Venture X related links from ${seedUrl}`);
    } catch (err) {
      console.log(`[CapitalOne]   Could not discover from ${seedUrl}: ${err.message}`);
    }
  }

  // Deduplicate
  const unique = [...new Set(discoveredUrls)];
  console.log(`[CapitalOne] Discovered ${unique.length} unique Venture X URLs`);
  return unique;
}

// ============================================
// DUCKDUCKGO URL DISCOVERY
// ============================================

/**
 * Discover Capital One Venture X URLs via DuckDuckGo HTML search.
 * DuckDuckGo is more reliable than crawling Capital One directly
 * because Capital One blocks headless browsers.
 */
async function discoverViaDuckDuckGo(page) {
  console.log('[CapitalOne] Discovering Venture X URLs via DuckDuckGo...');

  const queries = [
    'site:capitalone.com "venture x" card',
    'site:capitalone.com "venture x" benefits lounge',
    'site:capitalone.com "venture x" transfer partners',
  ];

  const discoveredUrls = [];

  for (const query of queries) {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Check for blocking
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (bodyText.toLowerCase().includes('captcha') || bodyText.toLowerCase().includes('robot')) {
        console.log('[CapitalOne]   ⚠ DuckDuckGo blocked for this query');
        continue;
      }

      // Extract result URLs - DuckDuckGo wraps URLs in redirects with uddg= parameter
      const results = await page.evaluate(() => {
        const urls = [];
        const seen = new Set();
        document.querySelectorAll('.result').forEach(result => {
          const link = result.querySelector('a.result__a');
          if (link && link.href) {
            let href = link.href;
            const uddgMatch = href.match(/uddg=([^&]+)/);
            if (uddgMatch) href = decodeURIComponent(uddgMatch[1]);
            if (!seen.has(href) && href.startsWith('https://www.capitalone.com/')) {
              seen.add(href);
              urls.push(href);
            }
          }
        });
        return urls;
      });

      discoveredUrls.push(...results);
      console.log(`[CapitalOne]   DuckDuckGo found ${results.length} Capital One URLs for: ${query}`);

      await page.waitForTimeout(3000 + Math.random() * 2000); // Rate limit
    } catch (err) {
      console.log(`[CapitalOne]   DuckDuckGo search failed: ${err.message}`);
    }
  }

  const unique = [...new Set(discoveredUrls)];
  console.log(`[CapitalOne] DuckDuckGo discovered ${unique.length} unique Capital One URLs`);
  return unique;
}

// ============================================
// BROWSER LIFECYCLE
// ============================================

let _browser = null;
let _context = null;

/**
 * Launch Chromium with anti-detection settings
 */
async function launchBrowser() {
  let chromium;
  try {
    const { chromium: chromiumExtra } = require('playwright-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    chromiumExtra.use(StealthPlugin());
    chromium = chromiumExtra;
    console.log('[CapitalOne] Using stealth plugin');
  } catch (err) {
    console.log('[CapitalOne] Stealth plugin not available, using standard playwright:', err.message);
    const pw = require('playwright');
    chromium = pw.chromium;
  }

  const launchOptions = getBrowserLaunchOptions();
  // Override headless based on CLI flags
  if (isVisible) {
    launchOptions.headless = false;
  }
  console.log(`[CapitalOne] Launching Chromium (headless: ${launchOptions.headless})...`);

  _browser = await chromium.launch(launchOptions);

  const contextOptions = getContextOptions();
  // Force 1920x1080 for Capital One
  contextOptions.viewport = { width: 1920, height: 1080 };
  _context = await _browser.newContext(contextOptions);

  // --- Resource blocking: analytics, tracking, and heavy media ---
  await _context.route('**/*', (route) => {
    const url = route.request().url();
    const resourceType = route.request().resourceType();

    // Block known tracking/analytics domains
    if (BLOCK_PATTERNS.some(p => url.includes(p))) {
      return route.abort();
    }

    // Block fonts, media, and third-party images (keep capitalone.com images for layout)
    if (resourceType === 'media') {
      return route.abort();
    }
    if (resourceType === 'font') {
      return route.abort();
    }
    if (resourceType === 'image' && !url.includes('capitalone.com')) {
      return route.abort();
    }

    return route.continue();
  });

  // --- Anti-bot evasion init script ---
  await _context.addInitScript(() => {
    // Override webdriver flag (primary headless detection vector)
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    // Fake chrome runtime object
    window.chrome = { runtime: {} };

    // Override permissions query
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters)
    );

    // Override plugins to look like a real browser
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });

  console.log('[CapitalOne] Browser launched successfully (with anti-bot evasion & resource blocking)');
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
  console.log('[CapitalOne] Browser closed');
}

// ============================================
// RANDOM DELAY HELPERS
// ============================================

/**
 * Sleep for a random delay between min and max ms
 */
async function randomSleep(min, max) {
  const delay = getRandomDelay(min || 500, max || 1500);
  await new Promise(resolve => setTimeout(resolve, delay));
}

// ============================================
// INTERACTIVE ELEMENT EXPANSION
// ============================================

/**
 * Expand all interactive elements on the page:
 * - aria-expanded="false" elements
 * - <details> / <summary> elements
 * - "Show more", "Learn more", "See details" buttons
 * - Accordion headers
 * - Tab panels
 * - Scroll to bottom for lazy-loaded content
 */
async function expandAllInteractiveElements(page) {
  console.log('[CapitalOne]   Expanding interactive elements...');
  let expandedCount = 0;
  const startTime = Date.now();

  // --- 1. Click all elements with aria-expanded="false" ---
  try {
    const ariaCollapsed = await page.$$('[aria-expanded="false"]');
    for (const el of ariaCollapsed) {
      if (Date.now() - startTime > CONFIG.expandTimeout) break;
      try {
        const isVisible = await el.isVisible();
        if (isVisible) {
          await el.click({ timeout: 2000 }).catch(() => {});
          expandedCount++;
          await randomSleep(200, 500);
        }
      } catch {
        // Skip elements that can't be clicked
      }
    }
    if (ariaCollapsed.length > 0) {
      console.log(`[CapitalOne]     → Expanded ${expandedCount} aria-expanded elements`);
    }
  } catch {
    // No aria-expanded elements found
  }

  // --- 2. Open all <details> elements ---
  try {
    const detailsCount = await page.evaluate(() => {
      let count = 0;
      document.querySelectorAll('details:not([open])').forEach(el => {
        el.setAttribute('open', '');
        count++;
      });
      return count;
    });
    if (detailsCount > 0) {
      console.log(`[CapitalOne]     → Opened ${detailsCount} <details> elements`);
      expandedCount += detailsCount;
    }
  } catch {
    // No details elements
  }

  // --- 3. Click "Show more" / "Learn more" / "See details" / "View all" buttons ---
  const expandButtonTexts = [
    'show more', 'learn more', 'see details', 'view all',
    'read more', 'see all', 'expand', 'view details',
    'show all', 'see more', 'more details', 'full details',
  ];

  try {
    const buttons = await page.$$('button, a, [role="button"], span[tabindex]');
    for (const btn of buttons) {
      if (Date.now() - startTime > CONFIG.expandTimeout) break;
      try {
        const text = (await btn.textContent() || '').trim().toLowerCase();
        const matchesExpand = expandButtonTexts.some(t => text.includes(t));
        if (matchesExpand) {
          const isVisible = await btn.isVisible();
          if (isVisible) {
            await btn.click({ timeout: 2000 }).catch(() => {});
            expandedCount++;
            await randomSleep(200, 500);
          }
        }
      } catch {
        // Skip
      }
    }
  } catch {
    // No expand buttons found
  }

  // --- 4. Click accordion headers ---
  const accordionSelectors = [
    '.accordion-header',
    '.accordion-title',
    '.accordion-toggle',
    '[data-toggle="collapse"]',
    '[data-bs-toggle="collapse"]',
    '.expandable-trigger',
    '.collapsible-header',
    '.faq-question',
    '.expand-header',
    'button.accordion',
    '[class*="accordion"] > button',
    '[class*="accordion"] > [role="button"]',
    '[class*="Accordion"] button',
    '[class*="collapse"] button',
    '[class*="Collapse"] button',
  ];

  for (const selector of accordionSelectors) {
    if (Date.now() - startTime > CONFIG.expandTimeout) break;
    try {
      const headers = await page.$$(selector);
      for (const header of headers) {
        try {
          const isVisible = await header.isVisible();
          if (isVisible) {
            await header.click({ timeout: 2000 }).catch(() => {});
            expandedCount++;
            await randomSleep(200, 400);
          }
        } catch {
          // Skip
        }
      }
    } catch {
      // Selector not found
    }
  }

  // --- 5. Click through all tab panels ---
  try {
    const tabs = await page.$$('[role="tab"]:not([aria-selected="true"]), .tab:not(.active), .tab-link:not(.active)');
    for (const tab of tabs) {
      if (Date.now() - startTime > CONFIG.expandTimeout) break;
      try {
        const isVisible = await tab.isVisible();
        if (isVisible) {
          await tab.click({ timeout: 2000 }).catch(() => {});
          expandedCount++;
          await randomSleep(300, 600);
        }
      } catch {
        // Skip
      }
    }
    if (tabs.length > 0) {
      console.log(`[CapitalOne]     → Clicked ${tabs.length} tab panels`);
    }
  } catch {
    // No tabs
  }

  // --- 6. Scroll to bottom to trigger lazy-loaded content ---
  try {
    await page.evaluate(async () => {
      const totalHeight = document.body.scrollHeight;
      const step = Math.floor(totalHeight / 5);
      for (let pos = 0; pos < totalHeight; pos += step) {
        window.scrollTo(0, pos);
        await new Promise(r => setTimeout(r, 300));
      }
      window.scrollTo(0, totalHeight);
      await new Promise(r => setTimeout(r, 500));
      // Scroll back to top
      window.scrollTo(0, 0);
    });
    console.log('[CapitalOne]     → Scrolled page for lazy-loaded content');
  } catch {
    // Scroll failed
  }

  console.log(`[CapitalOne]   Total elements expanded: ${expandedCount}`);

  // Wait for dynamically loaded content to render
  await new Promise(r => setTimeout(r, CONFIG.postExpandDelay));
}

// ============================================
// CONTENT EXTRACTION
// ============================================

/**
 * Extract structured text content from the page body,
 * preserving headings, lists, and tables as markdown.
 * Removes nav, footer, cookie banners, and promotional overlays.
 */
async function extractPageContent(page) {
  const content = await page.evaluate(() => {
    // Remove unwanted elements
    const removeSelectors = [
      'nav', 'footer', 'header',
      '[class*="cookie"]', '[class*="Cookie"]',
      '[class*="banner"]', '[class*="Banner"]',
      '[class*="overlay"]', '[class*="Overlay"]',
      '[class*="modal"]', '[class*="Modal"]',
      '[class*="popup"]', '[class*="Popup"]',
      '[class*="promo"]', '[class*="Promo"]',
      '[class*="chat-bot"]', '[class*="chatbot"]',
      '[id*="onetrust"]', '[id*="cookie"]',
      '[class*="sticky-nav"]', '[class*="StickyNav"]',
      '[class*="breadcrumb"]', '[class*="Breadcrumb"]',
      'script', 'style', 'noscript', 'iframe',
      '[aria-hidden="true"]',
    ];

    for (const sel of removeSelectors) {
      try {
        document.querySelectorAll(sel).forEach(el => el.remove());
      } catch {
        // Invalid selector — skip
      }
    }

    /**
     * Recursively extract text with markdown formatting
     */
    function extractNode(node, depth) {
      if (!node) return '';
      if (depth > 20) return ''; // Prevent infinite recursion

      // Text node
      if (node.nodeType === 3) {
        return node.textContent.replace(/\s+/g, ' ');
      }

      // Element node
      if (node.nodeType !== 1) return '';

      const tag = node.tagName.toLowerCase();
      const children = Array.from(node.childNodes)
        .map(c => extractNode(c, depth + 1))
        .join('');

      // Skip hidden elements
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return '';
      }

      switch (tag) {
        case 'h1':
          return `\n# ${children.trim()}\n`;
        case 'h2':
          return `\n## ${children.trim()}\n`;
        case 'h3':
          return `\n### ${children.trim()}\n`;
        case 'h4':
        case 'h5':
        case 'h6':
          return `\n#### ${children.trim()}\n`;
        case 'p':
          return `\n${children.trim()}\n`;
        case 'br':
          return '\n';
        case 'li':
          return `\n• ${children.trim()}`;
        case 'ul':
        case 'ol':
          return `\n${children}\n`;
        case 'table':
          return extractTable(node) + '\n';
        case 'tr':
        case 'thead':
        case 'tbody':
        case 'tfoot':
          return children;
        case 'td':
        case 'th':
          return `${children.trim()} | `;
        case 'strong':
        case 'b':
          return `**${children.trim()}**`;
        case 'em':
        case 'i':
          return `_${children.trim()}_`;
        case 'a': {
          const href = node.getAttribute('href');
          const text = children.trim();
          if (href && text && !href.startsWith('#') && !href.startsWith('javascript:')) {
            return text;
          }
          return text;
        }
        case 'div':
        case 'section':
        case 'article':
        case 'main':
        case 'details':
        case 'summary':
          return `\n${children}\n`;
        case 'span':
          return children;
        default:
          return children;
      }
    }

    /**
     * Extract a table as formatted text
     */
    function extractTable(tableEl) {
      const rows = tableEl.querySelectorAll('tr');
      if (rows.length === 0) return '';

      let result = '\n';
      rows.forEach((row, idx) => {
        const cells = row.querySelectorAll('td, th');
        const cellTexts = Array.from(cells).map(c => c.textContent.trim());
        result += '| ' + cellTexts.join(' | ') + ' |\n';
        if (idx === 0) {
          result += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
        }
      });
      return result;
    }

    // Find the main content area, or fall back to body
    const mainEl = document.querySelector('main')
      || document.querySelector('[role="main"]')
      || document.querySelector('article')
      || document.querySelector('#main-content')
      || document.querySelector('.main-content')
      || document.body;

    return extractNode(mainEl, 0);
  });

  // Clean up the extracted content
  let cleaned = content
    .replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive newlines
    .replace(/[ \t]+/g, ' ')           // Collapse horizontal whitespace
    .replace(/\n /g, '\n')             // Remove leading spaces on lines
    .replace(/ \n/g, '\n')             // Remove trailing spaces on lines
    .trim();

  return cleaned;
}

/**
 * Get the page title
 */
async function getPageTitle(page) {
  try {
    // Try meta og:title first
    const ogTitle = await page.$eval('meta[property="og:title"]', el => el.getAttribute('content')).catch(() => null);
    if (ogTitle) return ogTitle;

    // Try h1
    const h1 = await page.$eval('h1', el => el.textContent.trim()).catch(() => null);
    if (h1) return h1;

    // Fall back to document title
    return await page.title();
  } catch {
    return '';
  }
}

// ============================================
// CONTENT CHUNKING
// ============================================

/**
 * Generate a URL slug from a URL string
 */
function urlToSlug(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/www\./, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
}

/**
 * Chunk content into ~300-500 word segments with overlap.
 * Tries to break on paragraph boundaries.
 */
function chunkContent(text, targetWords, overlapWords) {
  const target = targetWords || CONFIG.targetChunkWords;
  const overlap = overlapWords || CONFIG.overlapWords;

  // Split into paragraphs
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

    // If adding this paragraph would exceed max, and we have content, finalize chunk
    if (currentWordCount + paraWords > CONFIG.maxChunkWords && currentWordCount >= CONFIG.minChunkWords) {
      chunks.push(currentChunk.join('\n\n'));

      // Create overlap: take the last paragraph(s) that fit within overlap words
      const overlapChunk = [];
      let overlapCount = 0;
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        const words = currentChunk[i].split(/\s+/).length;
        if (overlapCount + words <= overlap) {
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

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    const lastChunkText = currentChunk.join('\n\n');
    const lastWords = lastChunkText.split(/\s+/).length;

    if (lastWords >= CONFIG.minChunkWords || chunks.length === 0) {
      chunks.push(lastChunkText);
    } else if (chunks.length > 0) {
      // Merge small trailing chunk into the previous one
      chunks[chunks.length - 1] += '\n\n' + lastChunkText;
    }
  }

  return chunks;
}

// ============================================
// PAGE SCRAPING (with retry + fallback)
// ============================================

/**
 * Navigate to a URL with robust wait strategy.
 * Uses domcontentloaded instead of networkidle (which never resolves
 * on Capital One due to persistent analytics/WebSocket connections).
 * Returns the HTTP response object or null.
 */
async function robustNavigate(page, url) {
  // Navigate with domcontentloaded — doesn't wait for analytics to finish
  const response = await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: CONFIG.navigationTimeout,
  });

  // Wait for the page to actually render meaningful content
  await page.waitForFunction(() => {
    const body = document.body;
    return body && body.innerText.length > 500;
  }, { timeout: CONFIG.contentWaitTimeout }).catch(() => {
    console.log('[CapitalOne]   ⚠ Content may not be fully loaded, proceeding anyway');
  });

  // Additional settle time for JS-rendered content (React/Angular hydration)
  await page.waitForTimeout(CONFIG.jsSettleDelay);

  return response;
}

/**
 * Scrape a single Capital One page with retry logic.
 * On 404/403, attempts Google cache as fallback.
 */
async function scrapeWithRetry(page, urlEntry) {
  const { url, title: registeredTitle } = urlEntry;
  console.log(`\n[CapitalOne] Scraping: ${url}`);
  console.log(`[CapitalOne]   Registered title: ${registeredTitle}`);

  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      console.log(`[CapitalOne]   Attempt ${attempt}/${CONFIG.maxRetries}...`);

      // --- Navigate ---
      const response = await robustNavigate(page, url);
      const status = response ? response.status() : null;
      console.log(`[CapitalOne]   HTTP status: ${status || 'unknown'}`);

      // --- Handle 404 / 403: try Google cache fallback ---
      if (status === 404 || status === 403) {
        console.log(`[CapitalOne]   ⚠ Got ${status}, trying Google cache...`);
        const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
        const cacheResponse = await page.goto(cacheUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        }).catch(() => null);

        if (!cacheResponse || cacheResponse.status() !== 200) {
          console.log('[CapitalOne]   ⚠ Cache also unavailable, skipping');
          return [];
        }
        console.log('[CapitalOne]   ✓ Loaded from Google cache');
        // Give cache page time to render
        await page.waitForTimeout(2000);
      }

      // --- Check for soft 404 (page title indicates error/not-found) ---
      const pageTitle = await page.title();
      const pageTitleLower = pageTitle.toLowerCase();
      if (pageTitleLower.includes('not found') ||
          pageTitleLower.includes('page not found') ||
          pageTitleLower.includes('404') ||
          pageTitleLower.includes('error')) {
        console.log(`[CapitalOne]   ⚠ Page title indicates 404: "${pageTitle}", trying Google cache...`);
        const softCacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
        const softCacheResp = await page.goto(softCacheUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        }).catch(() => null);

        if (!softCacheResp || softCacheResp.status() !== 200) {
          console.log('[CapitalOne]   ⚠ Cache also unavailable, skipping');
          return [];
        }
        console.log('[CapitalOne]   ✓ Loaded from Google cache (soft 404 fallback)');
        await page.waitForTimeout(2000);
      }

      // Small human-like delay
      await randomSleep(1000, 2000);

      // --- Expand interactive elements ---
      await expandAllInteractiveElements(page);

      // --- Extract title ---
      const extractedTitle = await getPageTitle(page);
      const finalTitle = extractedTitle || registeredTitle;
      console.log(`[CapitalOne]   Page title: ${finalTitle}`);

      // --- Extract content ---
      let content = await extractPageContent(page);

      if (!content || content.length < 100) {
        console.log(`[CapitalOne]   ⚠ Insufficient content (${content ? content.length : 0} chars), skipping`);
        return [];
      }

      console.log(`[CapitalOne]   ✓ Extracted ${content.length} chars of content`);

      // --- Additional content-level soft 404 check ---
      // Must handle both straight apostrophe (') and curly apostrophe (\u2019)
      const contentLower = content.toLowerCase();
      const contentIs404 =
        contentLower.includes("can't find that page") ||
        contentLower.includes("cant find that page") ||
        contentLower.includes("can\u2019t find that page") ||
        contentLower.includes("page not found") ||
        contentLower.includes("page you requested") ||
        contentLower.includes("page doesn't exist") ||
        contentLower.includes("page doesn\u2019t exist") ||
        contentLower.includes("let's get you to where you want to go") ||
        contentLower.includes("let\u2019s get you to where you want to go") ||
        content.trim().length < 200;
      if (contentIs404) {
        console.log(`[CapitalOne]   ⚠ Content appears to be a 404 page, trying Google cache...`);
        const contentCacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
        const contentCacheResp = await page.goto(contentCacheUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        }).catch(() => null);

        if (!contentCacheResp || contentCacheResp.status() !== 200) {
          console.log('[CapitalOne]   ⚠ Cache also unavailable, skipping');
          return [];
        }
        console.log('[CapitalOne]   ✓ Loaded from Google cache (content 404 fallback)');
        await page.waitForTimeout(2000);

        // Re-extract content from cache page
        content = await extractPageContent(page);
        if (!content || content.length < 200) {
          console.log('[CapitalOne]   ⚠ Cached content also insufficient, skipping');
          return [];
        }
        console.log(`[CapitalOne]   ✓ Re-extracted ${content.length} chars from cache`);
      }

      // --- Chunk the content ---
      const chunks = chunkContent(content);
      console.log(`[CapitalOne]   Split into ${chunks.length} chunks`);

      const slug = urlToSlug(url);
      const now = new Date().toISOString();

      return chunks.map((chunkText, idx) => ({
        id: `capitalone-scraped-${slug}-${idx}`,
        title: `Capital One Venture X - ${finalTitle} - Chunk ${idx + 1}`,
        content: chunkText,
        source: 'capitalone',
        url: url,
        createdAt: new Date().toISOString().split('T')[0],
        metadata: {
          trustTier: 0,
          scrapedAt: now,
          method: 'playwright-full-render',
          chunkIndex: idx,
          totalChunks: chunks.length,
          registeredTitle: registeredTitle,
        },
      }));
    } catch (err) {
      console.error(`[CapitalOne]   ✗ Attempt ${attempt} error: ${err.message}`);
      if (attempt === CONFIG.maxRetries) {
        console.error(`[CapitalOne]   ✗ All ${CONFIG.maxRetries} attempts failed for ${url}`);
        return [];
      }
      // Wait before retrying with jitter
      const retryDelay = 3000 + Math.random() * 2000;
      console.log(`[CapitalOne]   Retrying in ${Math.round(retryDelay)}ms...`);
      await page.waitForTimeout(retryDelay);
    }
  }

  return [];
}

// ============================================
// MAIN ORCHESTRATOR
// ============================================

async function main() {
  console.log('');
  console.log('┌────────────────────────────────────────────────────────┐');
  console.log('│  Playwright Capital One Scraper                        │');
  console.log('│  Target: Tier 0 Official Venture X Pages               │');
  console.log('│  Method: Full JS rendering + interactive expansion     │');
  console.log('└────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(`[CapitalOne] URLs to scrape: ${TIER0_URLS.length}`);
  console.log(`[CapitalOne] Headless: ${!isVisible && process.env.PLAYWRIGHT_HEADLESS !== 'false'}`);
  console.log(`[CapitalOne] Retries per URL: ${CONFIG.maxRetries}`);
  console.log(`[CapitalOne] Navigation timeout: ${CONFIG.navigationTimeout}ms`);
  console.log(`[CapitalOne] Wait strategy: domcontentloaded + content check + ${CONFIG.jsSettleDelay}ms settle`);
  console.log(`[CapitalOne] Output: ${CONFIG.outputPath}`);
  console.log('');

  let allDocuments = [];

  try {
    await launchBrowser();
    const page = await _context.newPage();

    // Set a generous default timeout (individual waits have their own)
    page.setDefaultTimeout(60000);

    // --- URL Discovery: DuckDuckGo first (more reliable), then site crawl as fallback ---
    let ddgUrls = [];
    try {
      ddgUrls = await discoverViaDuckDuckGo(page);
    } catch (err) {
      console.log(`[CapitalOne] DuckDuckGo discovery failed: ${err.message}`);
    }

    let siteCrawlUrls = [];
    try {
      siteCrawlUrls = await discoverVentureXUrls(page);
    } catch (err) {
      console.log(`[CapitalOne] Site-crawl discovery failed: ${err.message}`);
    }

    // Merge: DuckDuckGo + site crawl, deduplicated
    const allDiscoveredUrls = [...new Set([...ddgUrls, ...siteCrawlUrls])];
    console.log(`[CapitalOne] Total discovered URLs: ${allDiscoveredUrls.length} (${ddgUrls.length} from DuckDuckGo, ${siteCrawlUrls.length} from site crawl)`);

    // Merge discovered URLs with hardcoded (discovered first, hardcoded as fallback)
    const hardcodedUrlSet = new Set(TIER0_URLS.map(u => u.url));
    const discoveredEntries = allDiscoveredUrls
      .filter(u => !hardcodedUrlSet.has(u))
      .map(u => ({
        url: u,
        title: 'Discovered: ' + u.split('/').filter(Boolean).pop(),
      }));

    const allUrls = [...discoveredEntries, ...TIER0_URLS];
    const scrapedUrls = new Set();

    console.log(`\n[CapitalOne] Total URLs to scrape: ${allUrls.length} (${discoveredEntries.length} discovered + ${TIER0_URLS.length} hardcoded)`);
    if (discoveredEntries.length > 0) {
      console.log('[CapitalOne] Discovered URLs (update venturexSources.ts if these persist):');
      discoveredEntries.forEach(e => console.log(`[CapitalOne]   → ${e.url}`));
    }

    for (let i = 0; i < allUrls.length; i++) {
      const urlEntry = allUrls[i];

      // Skip if already scraped (dedup by URL)
      if (scrapedUrls.has(urlEntry.url)) {
        console.log(`[CapitalOne] === [${i + 1}/${allUrls.length}] === SKIP (already scraped): ${urlEntry.url}`);
        continue;
      }

      console.log(`[CapitalOne] === [${i + 1}/${allUrls.length}] ===`);

      const docs = await scrapeWithRetry(page, urlEntry);
      if (docs.length > 0) {
        scrapedUrls.add(urlEntry.url);
      }
      allDocuments.push(...docs);

      // Random delay between pages to avoid detection
      if (i < allUrls.length - 1) {
        const delay = getRandomDelay(2000, 4000);
        console.log(`[CapitalOne] Waiting ${delay}ms before next page...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    await page.close();
  } catch (err) {
    console.error('[CapitalOne] Fatal error:', err.message);
  } finally {
    await closeBrowser();
  }

  // ============================================
  // OUTPUT
  // ============================================

  // --- Filter out any documents that are clearly 404 content ---
  const preFilterCount = allDocuments.length;
  const validDocuments = allDocuments.filter(doc => {
    const lower = doc.content.toLowerCase();
    const titleLower = (doc.title || '').toLowerCase();

    // Reject 404 pages — case-insensitive, handles both straight and curly apostrophes
    const is404 =
      lower.includes("can't find that page") ||
      lower.includes("cant find that page") ||
      lower.includes("can\u2019t find that page") ||  // curly apostrophe '
      lower.includes("page not found") ||
      lower.includes("page you requested") ||
      lower.includes("page doesn't exist") ||
      lower.includes("page doesn\u2019t exist") ||     // curly apostrophe '
      lower.includes("let's get you to where you want to go") ||
      lower.includes("let\u2019s get you to where you want to go") || // curly apostrophe '
      lower.includes("we\u2019re sorry") ||
      lower.includes("we're sorry, we can") ||
      titleLower.includes("page not found") ||
      titleLower.includes("not found") ||
      titleLower.includes("404") ||
      doc.content.trim().length < 200;

    if (is404) {
      console.log(`[CapitalOne] Filtered out 404 content: ${doc.id}`);
    }
    return !is404;
  });
  allDocuments = validDocuments;
  if (allDocuments.length < preFilterCount) {
    console.log(`[CapitalOne] Filtered out ${preFilterCount - allDocuments.length} of ${preFilterCount} documents that appeared to be 404 pages`);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`[CapitalOne] Scraping complete!`);
  console.log(`[CapitalOne] Total valid documents: ${allDocuments.length}`);

  if (allDocuments.length === 0) {
    console.log('[CapitalOne] ⚠ No documents were scraped. Capital One may be blocking automated access.');
    console.log('[CapitalOne] The static content in capitalOne.ts remains the authoritative fallback.');
    console.log('════════════════════════════════════════════════════════════');
    return;
  }

  // Ensure data directory exists
  const dataDir = path.dirname(CONFIG.outputPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`[CapitalOne] Created directory: ${dataDir}`);
  }

  // Write output JSON
  const jsonOutput = JSON.stringify(allDocuments, null, 2);
  const outputSize = Buffer.byteLength(jsonOutput, 'utf-8');

  if (outputSize > CONFIG.maxOutputSize) {
    console.log(`[CapitalOne] ⚠ Output size (${(outputSize / 1024).toFixed(1)}KB) exceeds ${(CONFIG.maxOutputSize / 1024)}KB limit`);
    console.log(`[CapitalOne] Trimming to fit...`);

    // Remove chunks from the end until we fit
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
  console.log(`[CapitalOne] Output written to: ${CONFIG.outputPath}`);
  console.log(`[CapitalOne] Output size: ${(finalSize / 1024).toFixed(1)}KB`);
  console.log('════════════════════════════════════════════════════════════');

  // Print summary per URL
  console.log('\n  Summary by URL:');
  const urlCounts = {};
  for (const doc of allDocuments) {
    urlCounts[doc.url] = (urlCounts[doc.url] || 0) + 1;
  }
  for (const [url, count] of Object.entries(urlCounts)) {
    console.log(`    ${count} chunks ← ${url}`);
  }

  // Print sample
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
  scrapeWithRetry,
  discoverVentureXUrls,
  discoverViaDuckDuckGo,
  expandAllInteractiveElements,
  extractPageContent,
  chunkContent,
  TIER0_URLS,
  CONFIG,
};
