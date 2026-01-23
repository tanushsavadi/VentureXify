// ============================================
// FLOW STATE MACHINE - Chat Wizard FSM
// ============================================

import { PortalSnapshot, DirectSnapshot, ComparisonResult } from '../lib/compareTypes';

// ============================================
// FSM STATES
// ============================================

export type FlowState =
  | 'IDLE'
  | 'WAITING_FOR_PORTAL_REVIEW'
  | 'PORTAL_CAPTURED'
  | 'WAITING_FOR_DIRECT_CAPTURE'
  | 'DIRECT_CAPTURED'
  | 'COMPUTING_VERDICT'
  | 'VERDICT_READY'
  | 'ERROR';

// ============================================
// FSM EVENTS
// ============================================

export type FlowEvent =
  | { type: 'PAGE_CONTEXT_UPDATED'; payload: PageContext }
  | { type: 'PORTAL_CAPTURE_RECEIVED'; payload: PortalSnapshot }
  | { type: 'PORTAL_CONFIRMED' }
  | { type: 'DIRECT_CAPTURE_RECEIVED'; payload: DirectSnapshot }
  | { type: 'DIRECT_CONFIRMED' }
  | { type: 'RECAPTURE_PORTAL' }
  | { type: 'RECAPTURE_DIRECT' }
  | { type: 'VERDICT_COMPUTED'; payload: ComparisonResult }
  | { type: 'RESET_FLOW' }
  | { type: 'ERROR_OCCURRED'; payload: { message: string; recoverable: boolean } };

// ============================================
// PAGE CONTEXT
// ============================================

export type DetectedSite = 'capital-one-portal' | 'google-flights' | 'other' | 'unknown';

export interface PageContext {
  site: DetectedSite;
  url: string;
  isReviewPage: boolean;
  hasItinerary: boolean;
}

// ============================================
// FLOW CONTEXT (State Data)
// ============================================

export interface FlowContext {
  state: FlowState;
  pageContext: PageContext | null;
  portalCapture: PortalSnapshot | null;
  portalConfirmed: boolean;
  directCapture: DirectSnapshot | null;
  directConfirmed: boolean;
  verdict: ComparisonResult | null;
  error: { message: string; recoverable: boolean } | null;
  sessionId: string | null;
  lastUpdated: number;
}

// ============================================
// INITIAL CONTEXT
// ============================================

export const INITIAL_FLOW_CONTEXT: FlowContext = {
  state: 'IDLE',
  pageContext: null,
  portalCapture: null,
  portalConfirmed: false,
  directCapture: null,
  directConfirmed: false,
  verdict: null,
  error: null,
  sessionId: null,
  lastUpdated: Date.now(),
};

// ============================================
// STATE TRANSITIONS
// ============================================

type TransitionResult = {
  newState: FlowState;
  context: Partial<FlowContext>;
};

function transition(
  currentState: FlowState,
  event: FlowEvent,
  context: FlowContext
): TransitionResult {
  switch (currentState) {
    case 'IDLE':
      switch (event.type) {
        case 'PAGE_CONTEXT_UPDATED':
          if (event.payload.site === 'capital-one-portal' && event.payload.isReviewPage) {
            return {
              newState: 'WAITING_FOR_PORTAL_REVIEW',
              context: { pageContext: event.payload },
            };
          }
          return {
            newState: 'IDLE',
            context: { pageContext: event.payload },
          };
        case 'PORTAL_CAPTURE_RECEIVED':
          return {
            newState: 'PORTAL_CAPTURED',
            context: { portalCapture: event.payload, portalConfirmed: false },
          };
        case 'ERROR_OCCURRED':
          return {
            newState: 'ERROR',
            context: { error: event.payload },
          };
        default:
          return { newState: currentState, context: {} };
      }

    case 'WAITING_FOR_PORTAL_REVIEW':
      switch (event.type) {
        case 'PORTAL_CAPTURE_RECEIVED':
          return {
            newState: 'PORTAL_CAPTURED',
            context: { portalCapture: event.payload, portalConfirmed: false },
          };
        case 'PAGE_CONTEXT_UPDATED':
          if (event.payload.site !== 'capital-one-portal') {
            return {
              newState: 'IDLE',
              context: { pageContext: event.payload },
            };
          }
          return {
            newState: currentState,
            context: { pageContext: event.payload },
          };
        case 'ERROR_OCCURRED':
          return {
            newState: 'ERROR',
            context: { error: event.payload },
          };
        case 'RESET_FLOW':
          return { newState: 'IDLE', context: { ...INITIAL_FLOW_CONTEXT } };
        default:
          return { newState: currentState, context: {} };
      }

    case 'PORTAL_CAPTURED':
      switch (event.type) {
        case 'PORTAL_CONFIRMED':
          return {
            newState: 'WAITING_FOR_DIRECT_CAPTURE',
            context: { portalConfirmed: true },
          };
        case 'RECAPTURE_PORTAL':
          return {
            newState: 'WAITING_FOR_PORTAL_REVIEW',
            context: { portalCapture: null, portalConfirmed: false },
          };
        case 'PORTAL_CAPTURE_RECEIVED':
          return {
            newState: 'PORTAL_CAPTURED',
            context: { portalCapture: event.payload, portalConfirmed: false },
          };
        case 'ERROR_OCCURRED':
          return {
            newState: 'ERROR',
            context: { error: event.payload },
          };
        case 'RESET_FLOW':
          return { newState: 'IDLE', context: { ...INITIAL_FLOW_CONTEXT } };
        default:
          return { newState: currentState, context: {} };
      }

    case 'WAITING_FOR_DIRECT_CAPTURE':
      switch (event.type) {
        case 'DIRECT_CAPTURE_RECEIVED':
          return {
            newState: 'DIRECT_CAPTURED',
            context: { directCapture: event.payload, directConfirmed: false },
          };
        case 'PAGE_CONTEXT_UPDATED':
          return {
            newState: currentState,
            context: { pageContext: event.payload },
          };
        case 'RECAPTURE_PORTAL':
          return {
            newState: 'WAITING_FOR_PORTAL_REVIEW',
            context: { portalCapture: null, portalConfirmed: false },
          };
        case 'ERROR_OCCURRED':
          return {
            newState: 'ERROR',
            context: { error: event.payload },
          };
        case 'RESET_FLOW':
          return { newState: 'IDLE', context: { ...INITIAL_FLOW_CONTEXT } };
        default:
          return { newState: currentState, context: {} };
      }

    case 'DIRECT_CAPTURED':
      switch (event.type) {
        case 'DIRECT_CONFIRMED':
          return {
            newState: 'COMPUTING_VERDICT',
            context: { directConfirmed: true },
          };
        case 'RECAPTURE_DIRECT':
          return {
            newState: 'WAITING_FOR_DIRECT_CAPTURE',
            context: { directCapture: null, directConfirmed: false },
          };
        case 'DIRECT_CAPTURE_RECEIVED':
          return {
            newState: 'DIRECT_CAPTURED',
            context: { directCapture: event.payload, directConfirmed: false },
          };
        case 'ERROR_OCCURRED':
          return {
            newState: 'ERROR',
            context: { error: event.payload },
          };
        case 'RESET_FLOW':
          return { newState: 'IDLE', context: { ...INITIAL_FLOW_CONTEXT } };
        default:
          return { newState: currentState, context: {} };
      }

    case 'COMPUTING_VERDICT':
      switch (event.type) {
        case 'VERDICT_COMPUTED':
          return {
            newState: 'VERDICT_READY',
            context: { verdict: event.payload },
          };
        case 'ERROR_OCCURRED':
          return {
            newState: 'ERROR',
            context: { error: event.payload },
          };
        case 'RESET_FLOW':
          return { newState: 'IDLE', context: { ...INITIAL_FLOW_CONTEXT } };
        default:
          return { newState: currentState, context: {} };
      }

    case 'VERDICT_READY':
      switch (event.type) {
        case 'RESET_FLOW':
          return { newState: 'IDLE', context: { ...INITIAL_FLOW_CONTEXT } };
        case 'RECAPTURE_PORTAL':
          return {
            newState: 'WAITING_FOR_PORTAL_REVIEW',
            context: {
              portalCapture: null,
              portalConfirmed: false,
              directCapture: null,
              directConfirmed: false,
              verdict: null,
            },
          };
        case 'RECAPTURE_DIRECT':
          return {
            newState: 'WAITING_FOR_DIRECT_CAPTURE',
            context: {
              directCapture: null,
              directConfirmed: false,
              verdict: null,
            },
          };
        default:
          return { newState: currentState, context: {} };
      }

    case 'ERROR':
      switch (event.type) {
        case 'RESET_FLOW':
          return { newState: 'IDLE', context: { ...INITIAL_FLOW_CONTEXT } };
        case 'PAGE_CONTEXT_UPDATED':
          if (context.error?.recoverable) {
            return {
              newState: 'IDLE',
              context: { pageContext: event.payload, error: null },
            };
          }
          return { newState: currentState, context: {} };
        default:
          return { newState: currentState, context: {} };
      }

    default:
      return { newState: currentState, context: {} };
  }
}

// ============================================
// FSM CLASS
// ============================================

export class FlowStateMachine {
  private context: FlowContext;
  private listeners: Set<(context: FlowContext) => void>;
  private storageKey = 'vx_flow_context';

  constructor() {
    this.context = { ...INITIAL_FLOW_CONTEXT };
    this.listeners = new Set();
  }

  /**
   * Initialize FSM and restore state from storage
   */
  async init(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(this.storageKey);
      if (stored[this.storageKey]) {
        const parsed = stored[this.storageKey] as FlowContext;
        // Don't restore if too old (> 1 hour)
        if (Date.now() - parsed.lastUpdated < 3600000) {
          this.context = parsed;
        }
      }
    } catch (e) {
      console.error('[FSM] Failed to restore state:', e);
    }
  }

  /**
   * Get current context
   */
  getContext(): FlowContext {
    return { ...this.context };
  }

  /**
   * Get current state
   */
  getState(): FlowState {
    return this.context.state;
  }

  /**
   * Get active step (1-3)
   */
  getActiveStep(): number {
    switch (this.context.state) {
      case 'IDLE':
      case 'WAITING_FOR_PORTAL_REVIEW':
      case 'PORTAL_CAPTURED':
        return 1;
      case 'WAITING_FOR_DIRECT_CAPTURE':
      case 'DIRECT_CAPTURED':
        return 2;
      case 'COMPUTING_VERDICT':
      case 'VERDICT_READY':
        return 3;
      case 'ERROR':
        return this.context.portalConfirmed ? (this.context.directConfirmed ? 3 : 2) : 1;
      default:
        return 1;
    }
  }

  /**
   * Send event to FSM
   */
  async send(event: FlowEvent): Promise<FlowContext> {
    const { newState, context: contextUpdates } = transition(
      this.context.state,
      event,
      this.context
    );

    this.context = {
      ...this.context,
      ...contextUpdates,
      state: newState,
      lastUpdated: Date.now(),
    };

    // Persist to storage
    await this.persist();

    // Notify listeners
    this.notifyListeners();

    console.log('[FSM] Transition:', {
      event: event.type,
      newState,
      context: this.context,
    });

    return this.getContext();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (context: FlowContext) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Reset FSM to initial state
   */
  async reset(): Promise<void> {
    await this.send({ type: 'RESET_FLOW' });
  }

  /**
   * Persist state to storage
   */
  private async persist(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.storageKey]: this.context,
      });
    } catch (e) {
      console.error('[FSM] Failed to persist state:', e);
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const ctx = this.getContext();
    this.listeners.forEach((listener) => {
      try {
        listener(ctx);
      } catch (e) {
        console.error('[FSM] Listener error:', e);
      }
    });
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let fsmInstance: FlowStateMachine | null = null;

export function getFlowFSM(): FlowStateMachine {
  if (!fsmInstance) {
    fsmInstance = new FlowStateMachine();
  }
  return fsmInstance;
}

export async function initFlowFSM(): Promise<FlowStateMachine> {
  const fsm = getFlowFSM();
  await fsm.init();
  return fsm;
}
