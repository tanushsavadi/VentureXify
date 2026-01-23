// ============================================
// DOM UTILS - DOM Traversal & Manipulation
// ============================================
// Utilities for working with the DOM in content scripts
// including shadow DOM traversal and element finding

import { parseMoney, looksLikePrice } from './parseMoney';

// ============================================
// ELEMENT VISIBILITY
// ============================================

/**
 * Check if an element is visible in the DOM
 */
export function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return element.getBoundingClientRect().width > 0;
  }
  
  const style = window.getComputedStyle(element);
  
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) < 0.1) return false;
  
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  
  return true;
}

/**
 * Check if an element is in the viewport
 */
export function isInViewport(element: Element, margin: number = 0): boolean {
  const rect = element.getBoundingClientRect();
  
  return (
    rect.bottom >= -margin &&
    rect.top <= window.innerHeight + margin &&
    rect.right >= -margin &&
    rect.left <= window.innerWidth + margin
  );
}

/**
 * Check if element is inside our VentureX widget
 */
export function isVentureXWidget(element: Element): boolean {
  return !!(
    element.closest('#vx-direct-helper') ||
    element.closest('#vx-auto-compare-widget') ||
    element.closest('[class*="vx-"]') ||
    element.closest('[id^="vx-"]')
  );
}

// ============================================
// TEXT EXTRACTION
// ============================================

/**
 * Get clean text content from element
 */
export function getTextContent(element: Element | null): string {
  if (!element) return '';
  return element.textContent?.trim() || '';
}

/**
 * Get text content excluding certain children
 */
export function getDirectTextContent(element: Element): string {
  let text = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || '';
    }
  }
  return text.trim();
}

/**
 * Get clean innerText (respects CSS display)
 */
export function getCleanText(element: HTMLElement): string {
  // Create a clone to avoid modifying original
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Remove script and style elements
  clone.querySelectorAll('script, style').forEach(el => el.remove());
  
  // Get inner text
  return clone.innerText?.trim() || '';
}

/**
 * Get text from nearby elements (for context)
 */
export function getNearbyText(element: Element, levels: number = 2): string[] {
  const texts: string[] = [];
  
  // Get text from siblings
  if (element.previousElementSibling) {
    const prev = getTextContent(element.previousElementSibling);
    if (prev.length < 100) texts.push(prev);
  }
  if (element.nextElementSibling) {
    const next = getTextContent(element.nextElementSibling);
    if (next.length < 100) texts.push(next);
  }
  
  // Get text from parent chain
  let current = element.parentElement;
  for (let i = 0; i < levels && current; i++) {
    // Get sibling text
    for (const child of current.children) {
      if (child === element || child.contains(element)) continue;
      const text = getTextContent(child);
      if (text.length < 100) texts.push(text);
    }
    current = current.parentElement;
  }
  
  return texts.filter(Boolean);
}

// ============================================
// ELEMENT FINDING
// ============================================

/**
 * Find element by selector (safe)
 */
export function findElement(selector: string, container: Element | Document = document): Element | null {
  try {
    return container.querySelector(selector);
  } catch {
    return null;
  }
}

/**
 * Find all elements by selector (safe)
 */
export function findElements(selector: string, container: Element | Document = document): Element[] {
  try {
    return Array.from(container.querySelectorAll(selector));
  } catch {
    return [];
  }
}

/**
 * Find element by text content
 */
export function findByText(
  text: string | RegExp,
  tagName: string = '*',
  container: Element | Document = document
): Element | null {
  const pattern = typeof text === 'string' ? new RegExp(text, 'i') : text;
  const elements = container.querySelectorAll(tagName);
  
  for (const el of elements) {
    const elText = getTextContent(el);
    if (pattern.test(elText)) return el;
  }
  
  return null;
}

/**
 * Find all elements by text content
 */
export function findAllByText(
  text: string | RegExp,
  tagName: string = '*',
  container: Element | Document = document
): Element[] {
  const pattern = typeof text === 'string' ? new RegExp(text, 'i') : text;
  const elements = container.querySelectorAll(tagName);
  const results: Element[] = [];
  
  for (const el of elements) {
    const elText = getTextContent(el);
    if (pattern.test(elText)) results.push(el);
  }
  
  return results;
}

/**
 * Find element by aria-label
 */
export function findByAriaLabel(
  pattern: string | RegExp,
  container: Element | Document = document
): Element | null {
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
  const elements = container.querySelectorAll('[aria-label]');
  
  for (const el of elements) {
    const label = el.getAttribute('aria-label') || '';
    if (regex.test(label)) return el;
  }
  
  return null;
}

/**
 * Find element by data-testid
 */
export function findByTestId(
  pattern: string | RegExp,
  container: Element | Document = document
): Element | null {
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
  const elements = container.querySelectorAll('[data-testid]');
  
  for (const el of elements) {
    const testId = el.getAttribute('data-testid') || '';
    if (regex.test(testId)) return el;
  }
  
  return null;
}

/**
 * Find closest container matching pattern
 */
export function findContainer(
  element: Element,
  patterns: string[]
): Element | null {
  for (const pattern of patterns) {
    const container = element.closest(pattern);
    if (container) return container;
  }
  return null;
}

// ============================================
// PRICE-SPECIFIC FINDERS
// ============================================

/**
 * Find elements that look like they contain prices
 */
export function findPriceElements(
  container: Element | Document = document
): Element[] {
  const results: Element[] = [];
  
  // Walk text nodes
  const walker = document.createTreeWalker(
    container instanceof Document ? container.body : container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const text = node.textContent?.trim() || '';
        if (text.length < 2 || text.length > 200) return NodeFilter.FILTER_REJECT;
        if (!looksLikePrice(text)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const parent = node.parentElement;
    if (parent && !isVentureXWidget(parent)) {
      results.push(parent);
    }
  }
  
  return results;
}

/**
 * Find the likely "total" price element
 */
export function findTotalPriceElement(
  container: Element | Document = document
): Element | null {
  // Look for explicit total labels
  const totalKeywords = ['total', 'due today', 'amount due', 'grand total', 'trip total'];
  
  for (const keyword of totalKeywords) {
    const labelEl = findByText(keyword, 'span, div, label, dt', container);
    if (labelEl) {
      // Look for price near this label
      const parent = labelEl.parentElement;
      if (parent) {
        const priceEls = findPriceElements(parent);
        for (const priceEl of priceEls) {
          if (priceEl !== labelEl && isVisible(priceEl)) {
            return priceEl;
          }
        }
      }
    }
  }
  
  // Fallback: find largest visible price
  const priceEls = findPriceElements(container);
  const visiblePrices = priceEls.filter(el => isVisible(el) && !isVentureXWidget(el));
  
  let bestEl: Element | null = null;
  let bestAmount = 0;
  
  for (const el of visiblePrices) {
    const text = getTextContent(el);
    const parsed = parseMoney(text);
    if (parsed.money && parsed.money.amount > bestAmount) {
      bestAmount = parsed.money.amount;
      bestEl = el;
    }
  }
  
  return bestEl;
}

// ============================================
// DOM PATH
// ============================================

/**
 * Get a human-readable DOM path
 */
export function getDomPath(element: Element, maxDepth: number = 5): string {
  const parts: string[] = [];
  let current: Element | null = element;
  
  while (current && current !== document.body && parts.length < maxDepth) {
    let selector = current.tagName.toLowerCase();
    
    // Add id if present
    if (current.id) {
      selector += `#${current.id}`;
    }
    // Add relevant class (skip obfuscated ones)
    else if (current.className && typeof current.className === 'string') {
      const classes = current.className.split(' ')
        .filter(c => c && c.length < 30 && !c.match(/^[a-z]{20,}$/))
        .slice(0, 2);
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    parts.unshift(selector);
    current = current.parentElement;
  }
  
  return parts.join(' > ');
}

/**
 * Get XPath for an element
 */
export function getXPath(element: Element): string {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  const parts: string[] = [];
  let current: Element | null = element;
  
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 0;
    let sibling: Element | null = current.previousElementSibling;
    
    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }
    
    const tagName = current.tagName.toLowerCase();
    const part = index > 0 ? `${tagName}[${index + 1}]` : tagName;
    parts.unshift(part);
    
    current = current.parentElement;
  }
  
  return '/' + parts.join('/');
}

// ============================================
// SELECTOR GENERATION
// ============================================

/**
 * Generate a stable selector for an element
 * Prefers: id > data-testid > aria-label > classes > structural
 */
export function generateStableSelector(element: Element): string {
  // Try id first
  if (element.id && !element.id.match(/^[a-z0-9]{20,}$/i)) {
    return `#${CSS.escape(element.id)}`;
  }
  
  // Try data-testid
  const testId = element.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }
  
  // Try aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.length < 50) {
    return `[aria-label="${CSS.escape(ariaLabel)}"]`;
  }
  
  // Try unique data attributes
  for (const attr of element.attributes) {
    if (attr.name.startsWith('data-') && attr.name !== 'data-testid') {
      const count = document.querySelectorAll(`[${attr.name}="${CSS.escape(attr.value)}"]`).length;
      if (count === 1) {
        return `[${attr.name}="${CSS.escape(attr.value)}"]`;
      }
    }
  }
  
  // Try class combination (avoid obfuscated)
  if (element.className && typeof element.className === 'string') {
    const goodClasses = element.className.split(' ')
      .filter(c => c && c.length < 30 && !c.match(/^[a-z0-9]{15,}$/i));
    
    if (goodClasses.length > 0) {
      const selector = goodClasses.map(c => `.${CSS.escape(c)}`).join('');
      const count = document.querySelectorAll(selector).length;
      if (count === 1) {
        return selector;
      }
    }
  }
  
  // Fall back to structural selector
  return generateStructuralSelector(element);
}

/**
 * Generate a structural selector (nth-child based)
 */
export function generateStructuralSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  
  while (current && current !== document.body) {
    const parent: Element | null = current.parentElement;
    if (!parent) break;
    
    let index = 1;
    for (const sibling of parent.children) {
      if (sibling === current) break;
      if (sibling.tagName === current.tagName) index++;
    }
    
    const tagName = current.tagName.toLowerCase();
    const sameTagCount = parent.querySelectorAll(`:scope > ${tagName}`).length;
    
    if (sameTagCount > 1) {
      parts.unshift(`${tagName}:nth-of-type(${index})`);
    } else {
      parts.unshift(tagName);
    }
    
    current = parent;
    
    // Stop at unique ancestor
    if (current && current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }
    
    // Stop after reasonable depth
    if (parts.length >= 5) break;
  }
  
  return parts.join(' > ');
}

/**
 * Generate multiple selector strategies for an element
 */
export function generateSelectorStrategies(element: Element): string[] {
  const strategies: string[] = [];
  
  // Primary stable selector
  strategies.push(generateStableSelector(element));
  
  // Alternative with tag
  const tag = element.tagName.toLowerCase();
  if (element.id) {
    strategies.push(`${tag}#${CSS.escape(element.id)}`);
  }
  
  // With data-testid and tag
  const testId = element.getAttribute('data-testid');
  if (testId) {
    strategies.push(`${tag}[data-testid="${CSS.escape(testId)}"]`);
  }
  
  // Structural backup
  const structural = generateStructuralSelector(element);
  if (!strategies.includes(structural)) {
    strategies.push(structural);
  }
  
  // XPath as last resort
  strategies.push(`xpath:${getXPath(element)}`);
  
  // Dedupe and filter
  return [...new Set(strategies)].filter(Boolean);
}

// ============================================
// COMPUTED STYLES
// ============================================

/**
 * Get relevant computed styles for an element
 */
export function getRelevantStyles(element: Element): Record<string, string> {
  const style = window.getComputedStyle(element);
  
  return {
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    color: style.color,
    backgroundColor: style.backgroundColor,
    textDecoration: style.textDecoration,
  };
}

/**
 * Check if element has strikethrough
 */
export function hasStrikethrough(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return style.textDecoration.includes('line-through');
}

/**
 * Get font size in pixels
 */
export function getFontSize(element: Element): number {
  const style = window.getComputedStyle(element);
  return parseFloat(style.fontSize);
}

/**
 * Check if font is bold
 */
export function isBold(element: Element): boolean {
  const style = window.getComputedStyle(element);
  const weight = parseInt(style.fontWeight, 10);
  return weight >= 600 || style.fontWeight === 'bold';
}
