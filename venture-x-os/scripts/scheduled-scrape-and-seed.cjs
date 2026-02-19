#!/usr/bin/env node
// ============================================
// SCHEDULED SCRAPE & SEED ORCHESTRATOR
// Master script that runs all scrapers and seeds the vector store.
//
// To run weekly via cron:
// crontab -e
// 0 3 * * 0 cd /path/to/venture-x-os && npm run scrape:scheduled >> /var/log/venturexify-scrape.log 2>&1
//
// Or via GitHub Actions (see .github/workflows/scheduled-scrape.yml)
//
// Run manually:  node scripts/scheduled-scrape-and-seed.cjs
// ============================================

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT_DIR, 'data');

const SCRAPERS = [
  {
    name: 'Capital One (Tier 0)',
    script: 'scripts/playwright-capitalone-scraper.cjs',
    outputFile: 'capitalone-scraped.json',
    required: true,
  },
  {
    name: 'Tier 1 Guide Sites',
    script: 'scripts/playwright-tier1-scraper.cjs',
    outputFile: 'tier1-scraped.json',
    required: false,
  },
  {
    name: 'Reddit (Tier 2)',
    script: 'scripts/playwright-reddit-scraper.cjs',
    outputFile: null, // Reddit scraper writes output via the seed script
    required: false,
  },
];

// ============================================
// HELPERS
// ============================================

function timestamp() {
  return new Date().toISOString();
}

function log(msg) {
  console.log(`[${timestamp()}] ${msg}`);
}

function logError(msg) {
  console.error(`[${timestamp()}] ❌ ${msg}`);
}

function logSuccess(msg) {
  console.log(`[${timestamp()}] ✅ ${msg}`);
}

/**
 * Run a Node script and return { success, duration, error }
 */
function runScript(scriptPath) {
  const fullPath = path.resolve(ROOT_DIR, scriptPath);
  const startTime = Date.now();

  try {
    log(`Running: node ${scriptPath}`);
    execSync(`node ${fullPath}`, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      timeout: 10 * 60 * 1000, // 10 minute timeout per scraper
      env: { ...process.env, NODE_ENV: 'production' },
    });
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    return { success: true, duration, error: null };
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    return { success: false, duration, error: err.message };
  }
}

/**
 * Count documents in a scraped JSON file.
 * Returns 0 if file doesn't exist or is invalid.
 */
function countDocuments(filename) {
  const filepath = path.resolve(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filepath)) return 0;
    const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Merge all scraped JSON files into a single combined file.
 */
function mergeScrapedData() {
  const outputFiles = [
    'capitalone-scraped.json',
    'tier1-scraped.json',
  ];

  const allDocs = [];
  const seenIds = new Set();

  for (const filename of outputFiles) {
    const filepath = path.resolve(DATA_DIR, filename);
    try {
      if (!fs.existsSync(filepath)) {
        log(`  ${filename}: not found, skipping`);
        continue;
      }
      const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      if (!Array.isArray(data)) {
        log(`  ${filename}: not an array, skipping`);
        continue;
      }
      let added = 0;
      for (const doc of data) {
        if (doc.id && !seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          allDocs.push(doc);
          added++;
        }
      }
      log(`  ${filename}: ${added} documents (${data.length - added} duplicates skipped)`);
    } catch (err) {
      logError(`  ${filename}: parse error — ${err.message}`);
    }
  }

  // Write merged output
  const mergedPath = path.resolve(DATA_DIR, 'all-scraped-merged.json');
  fs.writeFileSync(mergedPath, JSON.stringify(allDocs, null, 2), 'utf-8');
  log(`Merged ${allDocs.length} total documents → ${mergedPath}`);

  return allDocs.length;
}

// ============================================
// MAIN
// ============================================

async function main() {
  const overallStart = Date.now();

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  VentureXify Scheduled Scrape & Seed                       ║');
  console.log('║  Running all scrapers → merge → seed vector store           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  log(`Working directory: ${ROOT_DIR}`);
  log(`Data directory: ${DATA_DIR}`);
  log(`Scrapers to run: ${SCRAPERS.length}`);
  console.log('');

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    log(`Created data directory: ${DATA_DIR}`);
  }

  // ============================================
  // PHASE 1: Run all scrapers
  // ============================================

  log('═══ PHASE 1: Running scrapers ═══');
  console.log('');

  const results = [];

  for (const scraper of SCRAPERS) {
    log(`── ${scraper.name} ──`);

    const result = runScript(scraper.script);
    results.push({ ...scraper, ...result });

    if (result.success) {
      logSuccess(`${scraper.name} completed in ${result.duration}s`);
      if (scraper.outputFile) {
        const docCount = countDocuments(scraper.outputFile);
        log(`  Output: ${docCount} documents in ${scraper.outputFile}`);
      }
    } else {
      logError(`${scraper.name} failed after ${result.duration}s: ${result.error}`);
      if (scraper.required) {
        logError('This scraper is marked as required. Continuing anyway...');
      }
    }
    console.log('');
  }

  // ============================================
  // PHASE 2: Merge scraped data
  // ============================================

  log('═══ PHASE 2: Merging scraped data ═══');
  const totalDocs = mergeScrapedData();
  console.log('');

  // ============================================
  // PHASE 3: Seed vector store (if seeder exists)
  // ============================================

  log('═══ PHASE 3: Seeding vector store ═══');
  const seederPath = path.resolve(ROOT_DIR, 'scripts/seed-knowledge-base.cjs');

  if (fs.existsSync(seederPath)) {
    const seedResult = runScript('scripts/seed-knowledge-base.cjs');
    if (seedResult.success) {
      logSuccess(`Vector store seeded in ${seedResult.duration}s`);
    } else {
      logError(`Seeding failed after ${seedResult.duration}s: ${seedResult.error}`);
      logError('Scraped data is still saved to disk. Re-run seeding manually with: npm run seed');
    }
  } else {
    log('Seeder script not found, skipping vector store update');
    log('Scraped data is saved in data/ directory');
  }

  // ============================================
  // SUMMARY
  // ============================================

  const overallDuration = ((Date.now() - overallStart) / 1000).toFixed(1);

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  SCRAPE & SEED SUMMARY                                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    console.log(`  ${status} ${r.name.padEnd(30)} ${r.duration}s`);
  }

  console.log('');
  console.log(`  Total documents merged: ${totalDocs}`);
  console.log(`  Total time: ${overallDuration}s`);
  console.log('');

  // Exit with error code if any required scraper failed
  const requiredFailures = results.filter(r => r.required && !r.success);
  if (requiredFailures.length > 0) {
    logError(`${requiredFailures.length} required scraper(s) failed`);
    process.exit(1);
  }
}

// Run
main().catch(err => {
  console.error(`\n❌ Fatal error: ${err.message}`);
  process.exit(1);
});
