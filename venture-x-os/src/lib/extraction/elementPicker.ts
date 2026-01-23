// ============================================
// ELEMENT PICKER - User-Assisted Capture
// ============================================
// Allows users to manually select price elements when
// automatic extraction has low confidence

import { parseMoney } from './parseMoney';
import { 
  generateStableSelector, 
  generateSelectorStrategies,
  getDomPath,
  getTextContent,
  isVisible,
  isVentureXWidget,
  getNearbyText
} from './domUtils';
import { 
  Evidence, 
  ExtractionResult, 
  Money, 
  createSuccessResult, 
  createFailedResult 
} from './types';

// ============================================
// TYPES
// ============================================

export interface UserOverride {
  hostname: string;
  pageType: string;
  field: string;
  selectors: string[];
  lastValue: string;
  lastParsed?: Money;
  successCount: number;
  failureCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface PickerOptions {
  field: string;
  pageType: string;
  tooltip?: string;
  validateAsMoney?: boolean;
  highlightColor?: string;
  onSelect?: (result: PickerResult) => void;
  onCancel?: () => void;
}

export interface PickerResult {
  element: Element;
  text: string;
  parsedMoney?: Money;
  selectors: string[];
  domPath: string;
  nearbyLabels: string[];
}

interface PickerState {
  active: boolean;
  field: string;
  pageType: string;
  validateAsMoney: boolean;
  onSelect?: (result: PickerResult) => void;
  onCancel?: () => void;
}

// ============================================
// CONSTANTS
// ============================================

const OVERRIDE_STORAGE_KEY = 'vx_user_overrides';
const MAX_OVERRIDES_PER_SITE = 10;
const HIGHLIGHT_CLASS = 'vx-picker-highlight';
const TOOLTIP_ID = 'vx-picker-tooltip';
const OVERLAY_ID = 'vx-picker-overlay';

// ============================================
// PICKER STATE
// ============================================

let pickerState: PickerState | null = null;
let currentHighlight: Element | null = null;

// ============================================
// STYLES
// ============================================

function injectPickerStyles(): void {
  if (document.getElementById('vx-picker-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'vx-picker-styles';
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      outline: 3px solid #4F46E5 !important;
      outline-offset: 2px !important;
      background-color: rgba(79, 70, 229, 0.1) !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
    }
    
    .${HIGHLIGHT_CLASS}:hover {
      outline-color: #7C3AED !important;
      background-color: rgba(124, 58, 237, 0.15) !important;
    }
    
    #${TOOLTIP_ID} {
      position: fixed;
      padding: 8px 12px;
      background: #1F2937;
      color: white;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      pointer-events: none;
      max-width: 300px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    #${TOOLTIP_ID} .vx-tooltip-instruction {
      color: #9CA3AF;
      font-size: 11px;
      margin-top: 4px;
    }
    
    #${TOOLTIP_ID} .vx-tooltip-price {
      color: #34D399;
      font-weight: 600;
    }
    
    #${OVERLAY_ID} {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.05);
      z-index: 2147483646;
      cursor: crosshair;
    }
    
    .vx-picker-banner {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: #1F2937;
      color: white;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .vx-picker-banner button {
      padding: 6px 12px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    
    .vx-picker-banner .vx-cancel-btn {
      background: #374151;
      color: white;
    }
    
    .vx-picker-banner .vx-cancel-btn:hover {
      background: #4B5563;
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// PICKER UI
// ============================================

function createOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  document.body.appendChild(overlay);
  return overlay;
}

function createBanner(message: string): HTMLDivElement {
  const banner = document.createElement('div');
  banner.className = 'vx-picker-banner';
  banner.innerHTML = `
    <span>${message}</span>
    <button class="vx-cancel-btn">Cancel (Esc)</button>
  `;
  
  banner.querySelector('.vx-cancel-btn')?.addEventListener('click', () => {
    deactivatePicker();
    pickerState?.onCancel?.();
  });
  
  document.body.appendChild(banner);
  return banner;
}

function createTooltip(): HTMLDivElement {
  let tooltip = document.getElementById(TOOLTIP_ID) as HTMLDivElement;
  if (tooltip) return tooltip;
  
  tooltip = document.createElement('div');
  tooltip.id = TOOLTIP_ID;
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);
  return tooltip;
}

function updateTooltip(element: Element, x: number, y: number): void {
  const tooltip = createTooltip();
  const text = getTextContent(element).slice(0, 50);
  
  let priceHtml = '';
  if (pickerState?.validateAsMoney) {
    const parsed = parseMoney(getTextContent(element));
    if (parsed.money) {
      priceHtml = `<div class="vx-tooltip-price">${parsed.money.currency} ${parsed.money.amount.toFixed(2)}</div>`;
    }
  }
  
  tooltip.innerHTML = `
    <div>${text}${text.length >= 50 ? '...' : ''}</div>
    ${priceHtml}
    <div class="vx-tooltip-instruction">Click to select</div>
  `;
  
  tooltip.style.display = 'block';
  tooltip.style.left = `${Math.min(x + 15, window.innerWidth - 320)}px`;
  tooltip.style.top = `${Math.min(y + 15, window.innerHeight - 80)}px`;
}

function hideTooltip(): void {
  const tooltip = document.getElementById(TOOLTIP_ID);
  if (tooltip) tooltip.style.display = 'none';
}

function removePickerUI(): void {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(TOOLTIP_ID)?.remove();
  document.querySelector('.vx-picker-banner')?.remove();
  
  // Remove all highlights
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => {
    el.classList.remove(HIGHLIGHT_CLASS);
  });
  
  currentHighlight = null;
}

// ============================================
// EVENT HANDLERS
// ============================================

function handleMouseMove(e: MouseEvent): void {
  if (!pickerState?.active) return;
  
  // Get element under cursor
  const elements = document.elementsFromPoint(e.clientX, e.clientY);
  let targetElement: Element | null = null;
  
  for (const el of elements) {
    // Skip our UI elements
    if (el.id === OVERLAY_ID || el.id === TOOLTIP_ID) continue;
    if (el.closest('.vx-picker-banner')) continue;
    if (isVentureXWidget(el)) continue;
    if (!isVisible(el)) continue;
    
    // For money validation, prefer elements with price-like text
    if (pickerState.validateAsMoney) {
      const text = getTextContent(el);
      const parsed = parseMoney(text);
      if (parsed.money) {
        targetElement = el;
        break;
      }
    } else {
      targetElement = el;
      break;
    }
  }
  
  // Update highlight
  if (currentHighlight && currentHighlight !== targetElement) {
    currentHighlight.classList.remove(HIGHLIGHT_CLASS);
  }
  
  if (targetElement) {
    targetElement.classList.add(HIGHLIGHT_CLASS);
    currentHighlight = targetElement;
    updateTooltip(targetElement, e.clientX, e.clientY);
  } else {
    currentHighlight = null;
    hideTooltip();
  }
}

function handleClick(e: MouseEvent): void {
  if (!pickerState?.active) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  if (!currentHighlight) return;
  
  const element = currentHighlight;
  const text = getTextContent(element);
  
  // Parse as money if required
  let parsedMoney: Money | undefined;
  if (pickerState.validateAsMoney) {
    const parsed = parseMoney(text);
    if (!parsed.money) {
      // Show error tooltip briefly
      const tooltip = createTooltip();
      tooltip.innerHTML = '<div style="color: #EF4444">No valid price found in this element</div>';
      setTimeout(() => hideTooltip(), 1500);
      return;
    }
    parsedMoney = parsed.money;
  }
  
  const result: PickerResult = {
    element,
    text,
    parsedMoney,
    selectors: generateSelectorStrategies(element),
    domPath: getDomPath(element),
    nearbyLabels: getNearbyText(element, 2),
  };
  
  // Deactivate picker first
  deactivatePicker();
  
  // Call callback
  pickerState.onSelect?.(result);
}

function handleKeyDown(e: KeyboardEvent): void {
  if (!pickerState?.active) return;
  
  if (e.key === 'Escape') {
    e.preventDefault();
    deactivatePicker();
    pickerState?.onCancel?.();
  }
}

// ============================================
// PICKER CONTROL
// ============================================

/**
 * Activate element picker mode
 */
export function activatePicker(options: PickerOptions): void {
  if (pickerState?.active) {
    deactivatePicker();
  }
  
  injectPickerStyles();
  
  pickerState = {
    active: true,
    field: options.field,
    pageType: options.pageType,
    validateAsMoney: options.validateAsMoney ?? true,
    onSelect: options.onSelect,
    onCancel: options.onCancel,
  };
  
  // Create UI
  createOverlay();
  createBanner(options.tooltip || 'Click on the price element you want to capture');
  createTooltip();
  
  // Add event listeners
  document.addEventListener('mousemove', handleMouseMove, { capture: true });
  document.addEventListener('click', handleClick, { capture: true });
  document.addEventListener('keydown', handleKeyDown, { capture: true });
}

/**
 * Deactivate element picker mode
 */
export function deactivatePicker(): void {
  if (!pickerState?.active) return;
  
  // Remove event listeners
  document.removeEventListener('mousemove', handleMouseMove, { capture: true });
  document.removeEventListener('click', handleClick, { capture: true });
  document.removeEventListener('keydown', handleKeyDown, { capture: true });
  
  // Remove UI
  removePickerUI();
  
  pickerState = null;
}

/**
 * Check if picker is active
 */
export function isPickerActive(): boolean {
  return pickerState?.active ?? false;
}

// ============================================
// USER OVERRIDE STORAGE
// ============================================

/**
 * Get all user overrides
 */
export async function getUserOverrides(): Promise<UserOverride[]> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return [];
  }
  
  try {
    const result = await chrome.storage.local.get(OVERRIDE_STORAGE_KEY);
    return result[OVERRIDE_STORAGE_KEY] || [];
  } catch {
    return [];
  }
}

/**
 * Get override for specific site and field
 */
export async function getOverride(
  hostname: string,
  pageType: string,
  field: string
): Promise<UserOverride | null> {
  const overrides = await getUserOverrides();
  return overrides.find(o => 
    o.hostname === hostname && 
    o.pageType === pageType && 
    o.field === field
  ) || null;
}

/**
 * Save user override
 */
export async function saveOverride(override: UserOverride): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  
  const overrides = await getUserOverrides();
  
  // Find existing
  const idx = overrides.findIndex(o =>
    o.hostname === override.hostname &&
    o.pageType === override.pageType &&
    o.field === override.field
  );
  
  if (idx >= 0) {
    overrides[idx] = override;
  } else {
    overrides.push(override);
  }
  
  // Limit per site
  const siteOverrides = overrides.filter(o => o.hostname === override.hostname);
  if (siteOverrides.length > MAX_OVERRIDES_PER_SITE) {
    // Remove oldest
    siteOverrides.sort((a, b) => a.updatedAt - b.updatedAt);
    const toRemove = siteOverrides.slice(0, siteOverrides.length - MAX_OVERRIDES_PER_SITE);
    for (const r of toRemove) {
      const i = overrides.indexOf(r);
      if (i >= 0) overrides.splice(i, 1);
    }
  }
  
  await chrome.storage.local.set({ [OVERRIDE_STORAGE_KEY]: overrides });
}

/**
 * Record override success
 */
export async function recordOverrideSuccess(
  hostname: string,
  pageType: string,
  field: string
): Promise<void> {
  const override = await getOverride(hostname, pageType, field);
  if (override) {
    override.successCount++;
    override.updatedAt = Date.now();
    await saveOverride(override);
  }
}

/**
 * Record override failure
 */
export async function recordOverrideFailure(
  hostname: string,
  pageType: string,
  field: string
): Promise<void> {
  const override = await getOverride(hostname, pageType, field);
  if (override) {
    override.failureCount++;
    override.updatedAt = Date.now();
    await saveOverride(override);
  }
}

/**
 * Clear all overrides for a site
 */
export async function clearSiteOverrides(hostname: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  
  const overrides = await getUserOverrides();
  const filtered = overrides.filter(o => o.hostname !== hostname);
  await chrome.storage.local.set({ [OVERRIDE_STORAGE_KEY]: filtered });
}

// ============================================
// EXTRACTION WITH OVERRIDE
// ============================================

/**
 * Try extraction using user override
 */
export async function extractWithOverride(
  hostname: string,
  pageType: string,
  field: string,
  doc: Document = document
): Promise<ExtractionResult<Money> | null> {
  const startTime = performance.now();
  const override = await getOverride(hostname, pageType, field);
  
  if (!override) return null;
  
  // Try each selector
  for (const selector of override.selectors) {
    try {
      let element: Element | null = null;
      
      // Handle XPath
      if (selector.startsWith('xpath:')) {
        const xpath = selector.slice(6);
        const result = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        element = result.singleNodeValue as Element | null;
      } else {
        element = doc.querySelector(selector);
      }
      
      if (!element || !isVisible(element)) continue;
      
      const text = getTextContent(element);
      const parsed = parseMoney(text);
      
      if (parsed.money) {
        await recordOverrideSuccess(hostname, pageType, field);
        
        const evidence: Evidence = {
          matchedText: text,
          normalizedValue: parsed.money.amount,
          selector,
          url: doc.location?.href || '',
          hostname,
          domPath: getDomPath(element),
          labelsNearby: getNearbyText(element, 2),
          currency: parsed.money.currency,
          warnings: parsed.warnings,
        };
        
        return createSuccessResult(
          parsed.money,
          'HIGH',
          'USER_CONFIRMED',
          evidence,
          performance.now() - startTime
        );
      }
    } catch {
      // Selector failed, try next
      continue;
    }
  }
  
  // Override failed
  await recordOverrideFailure(hostname, pageType, field);
  return null;
}

/**
 * Create override from picker result
 */
export function createOverrideFromPicker(
  pickerResult: PickerResult,
  hostname: string,
  pageType: string,
  field: string
): UserOverride {
  return {
    hostname,
    pageType,
    field,
    selectors: pickerResult.selectors,
    lastValue: pickerResult.text,
    lastParsed: pickerResult.parsedMoney,
    successCount: 1,
    failureCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ============================================
// HIGH-LEVEL API
// ============================================

/**
 * Prompt user to pick price element and save override
 */
export function promptUserPick(options: {
  hostname: string;
  pageType: string;
  field: string;
  tooltip?: string;
}): Promise<ExtractionResult<Money>> {
  return new Promise((resolve) => {
    activatePicker({
      field: options.field,
      pageType: options.pageType,
      tooltip: options.tooltip || 'Click on the total price to help us capture it correctly',
      validateAsMoney: true,
      onSelect: async (result) => {
        if (!result.parsedMoney) {
          const noValueEvidence: Partial<Evidence> = {
            matchedText: result.text,
            url: document.location?.href || '',
            hostname: options.hostname,
            domPath: result.domPath,
            warnings: ['No valid price in selected element'],
          };
          resolve(createFailedResult(
            ['Selected element does not contain a valid price'],
            noValueEvidence,
            performance.now()
          ));
          return;
        }
        
        // Create and save override
        const override = createOverrideFromPicker(
          result,
          options.hostname,
          options.pageType,
          options.field
        );
        await saveOverride(override);
        
        const evidence: Evidence = {
          matchedText: result.text,
          normalizedValue: result.parsedMoney.amount,
          selector: result.selectors[0],
          url: document.location?.href || '',
          hostname: options.hostname,
          domPath: result.domPath,
          labelsNearby: result.nearbyLabels,
          currency: result.parsedMoney.currency,
        };
        
        resolve(createSuccessResult(
          result.parsedMoney,
          'HIGH',
          'USER_CONFIRMED',
          evidence,
          0
        ));
      },
      onCancel: () => {
        const cancelEvidence: Partial<Evidence> = {
          matchedText: '',
          url: document.location?.href || '',
          hostname: options.hostname,
          warnings: ['Cancelled by user'],
        };
        resolve(createFailedResult(
          ['User cancelled element picker'],
          cancelEvidence,
          0
        ));
      }
    });
  });
}
