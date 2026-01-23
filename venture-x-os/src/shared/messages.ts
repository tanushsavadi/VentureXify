// ============================================
// SHARED MESSAGE TYPES & BUS
// Standardized communication between all parts
// ============================================

import { PortalSnapshot, DirectSnapshot, ComparisonResult } from '../lib/compareTypes';
import { FlowContext, PageContext, FlowState } from '../flow/fsm';

// ============================================
// MESSAGE TYPES
// ============================================

// Content Script -> Background
export type ContentToBgMessage =
  | { type: 'PAGE_CONTEXT'; payload: PageContext }
  | { type: 'PORTAL_CAPTURE'; payload: PortalCapturePayload }
  | { type: 'DIRECT_CAPTURE'; payload: DirectCapturePayload }
  | { type: 'MANUAL_PRICE'; payload: ManualPricePayload };

// UI -> Background
export type UIToBgMessage =
  | { type: 'OPEN_GOOGLE_FLIGHTS_PREFILL'; payload: GoogleFlightsPrefillPayload }
  | { type: 'RESET_FLOW' }
  | { type: 'REQUEST_RECAPTURE'; payload: { target: 'portal' | 'direct' } }
  | { type: 'CONFIRM_PORTAL' }
  | { type: 'CONFIRM_DIRECT' }
  | { type: 'GET_FLOW_STATE' }
  | { type: 'SEND_CHAT_MESSAGE'; payload: ChatMessagePayload }
  | { type: 'REQUEST_AI_EXPLANATION'; payload: AIExplanationRequestPayload };

// Background -> UI
export type BgToUIMessage =
  | { type: 'FLOW_STATE_UPDATE'; payload: FlowContext }
  | { type: 'NEW_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'CAPTURE_RESULT'; payload: CaptureResultPayload }
  | { type: 'AI_EXPLANATION_RESULT'; payload: AIExplanationResult }
  | { type: 'ERROR'; payload: ErrorPayload };

// Combined message type
export type VXMessage = ContentToBgMessage | UIToBgMessage | BgToUIMessage;

// ============================================
// PAYLOAD TYPES
// ============================================

export interface PortalCapturePayload {
  snapshot: PortalSnapshot;
  tabId: number;
  url: string;
  confidence: 'HIGH' | 'MED' | 'LOW';
}

export interface DirectCapturePayload {
  snapshot: DirectSnapshot;
  tabId: number;
  url: string;
  confidence: 'HIGH' | 'MED' | 'LOW';
  matchScore?: number; // How well it matches the portal itinerary
}

export interface ManualPricePayload {
  price: number;
  currency: string;
  target: 'portal' | 'direct';
}

export interface GoogleFlightsPrefillPayload {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  cabin?: 'economy' | 'premium' | 'business' | 'first';
  passengers?: number;
}

export interface CaptureResultPayload {
  success: boolean;
  target: 'portal' | 'direct';
  snapshot?: PortalSnapshot | DirectSnapshot;
  error?: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
  recoverable: boolean;
}

// ============================================
// CHAT MESSAGE TYPES
// ============================================

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatMessageStatus = 'pending' | 'thinking' | 'capturing' | 'analyzing' | 'done' | 'error';

export type CardType = 'portal-capture' | 'direct-capture' | 'verdict' | 'loading' | 'error';

export interface ChatCardAttachment {
  type: CardType;
  data: unknown;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  status: ChatMessageStatus;
  timestamp: number;
  card?: ChatCardAttachment;
  quickReplies?: QuickReply[];
}

export interface QuickReply {
  id: string;
  label: string;
  action: string;
  variant?: 'primary' | 'secondary';
}

export interface ChatMessagePayload {
  content: string;
  isQuickReply?: boolean;
  actionId?: string;
}

// ============================================
// AI EXPLANATION TYPES
// ============================================

export interface AIExplanationRequestPayload {
  verdict: ComparisonResult;
  portalSnapshot: PortalSnapshot;
  directSnapshot: DirectSnapshot;
}

export interface AIExplanationResult {
  success: boolean;
  explanation?: {
    headline: string;
    body: string[];
    proTip: string;
    caveats: string[];
  };
  error?: string;
  fromCache?: boolean;
}

// ============================================
// MESSAGE HELPERS
// ============================================

/**
 * Generate unique message ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a chat message
 */
export function createChatMessage(
  role: ChatRole,
  content: string,
  options?: {
    status?: ChatMessageStatus;
    card?: ChatCardAttachment;
    quickReplies?: QuickReply[];
  }
): ChatMessage {
  return {
    id: generateMessageId(),
    role,
    content,
    status: options?.status ?? 'done',
    timestamp: Date.now(),
    card: options?.card,
    quickReplies: options?.quickReplies,
  };
}

/**
 * Create system messages for each flow state
 */
export function getSystemMessageForState(
  state: FlowState,
  context?: FlowContext
): ChatMessage | null {
  switch (state) {
    case 'IDLE':
      return createChatMessage(
        'assistant',
        "👋 Welcome! I'll help you compare portal vs direct prices. Navigate to a Capital One Travel review page to get started.",
        { quickReplies: [{ id: 'open-portal', label: 'Open Portal', action: 'open_portal' }] }
      );

    case 'WAITING_FOR_PORTAL_REVIEW':
      return createChatMessage(
        'assistant',
        "I see you're on Capital One Travel. Navigate to your booking's review page and I'll capture the itinerary.",
        { status: 'capturing' }
      );

    case 'PORTAL_CAPTURED':
      return createChatMessage(
        'assistant',
        "Got it — I captured your portal itinerary.",
        {
          status: 'done',
          card: context?.portalCapture
            ? { type: 'portal-capture', data: context.portalCapture }
            : undefined,
          quickReplies: [
            { id: 'confirm-portal', label: 'Confirm', action: 'confirm_portal', variant: 'primary' },
            { id: 'edit-portal', label: 'Edit', action: 'edit_portal', variant: 'secondary' },
            { id: 'recapture-portal', label: 'Recapture', action: 'recapture_portal', variant: 'secondary' },
          ],
        }
      );

    case 'WAITING_FOR_DIRECT_CAPTURE':
      return createChatMessage(
        'assistant',
        "Next, let's check direct pricing.",
        {
          status: 'done',
          quickReplies: [
            { id: 'open-gf', label: 'Open Google Flights (prefilled)', action: 'open_google_flights', variant: 'primary' },
          ],
        }
      );

    case 'DIRECT_CAPTURED':
      return createChatMessage(
        'assistant',
        "Captured direct price.",
        {
          status: 'done',
          card: context?.directCapture
            ? { type: 'direct-capture', data: context.directCapture }
            : undefined,
          quickReplies: [
            { id: 'confirm-direct', label: 'Looks right ✅', action: 'confirm_direct', variant: 'primary' },
            { id: 'not-right', label: 'Not right', action: 'recapture_direct', variant: 'secondary' },
          ],
        }
      );

    case 'COMPUTING_VERDICT':
      return createChatMessage('assistant', 'Analyzing...', {
        status: 'analyzing',
        card: { type: 'loading', data: { text: 'Computing recommendation...' } },
      });

    case 'VERDICT_READY':
      return createChatMessage(
        'assistant',
        "Here's my recommendation.",
        {
          status: 'done',
          card: context?.verdict
            ? { type: 'verdict', data: context.verdict }
            : undefined,
          quickReplies: [
            { id: 'new-comparison', label: 'New Comparison', action: 'reset_flow', variant: 'secondary' },
          ],
        }
      );

    case 'ERROR':
      return createChatMessage(
        'assistant',
        context?.error?.message || 'Something went wrong.',
        {
          status: 'error',
          card: { type: 'error', data: context?.error },
          quickReplies: context?.error?.recoverable
            ? [{ id: 'retry', label: 'Retry', action: 'retry', variant: 'primary' }]
            : [{ id: 'reset', label: 'Start Over', action: 'reset_flow', variant: 'primary' }],
        }
      );

    default:
      return null;
  }
}

// ============================================
// SUGGESTED QUESTIONS
// ============================================

export const SUGGESTED_QUESTIONS = [
  { id: 'portal-vs-direct', label: 'Portal vs direct for this booking?', action: 'ask_portal_direct' },
  { id: 'use-eraser', label: 'Should I use Travel Eraser?', action: 'ask_eraser' },
  { id: 'transfer-partner', label: 'Any transfer partner suggestion?', action: 'ask_transfer' },
] as const;

// ============================================
// MESSAGE BUS
// ============================================

type MessageHandler<T extends VXMessage = VXMessage> = (
  message: T,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
) => boolean | void | Promise<unknown>;

class MessageBus {
  private handlers: Map<string, MessageHandler[]> = new Map();

  /**
   * Register a handler for a specific message type
   */
  on<T extends VXMessage>(type: T['type'], handler: MessageHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler as MessageHandler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler as MessageHandler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Send a message (wrapper around chrome.runtime.sendMessage)
   */
  async send<T extends VXMessage>(message: T): Promise<unknown> {
    return chrome.runtime.sendMessage(message);
  }

  /**
   * Send a message to a specific tab
   */
  async sendToTab<T extends VXMessage>(tabId: number, message: T): Promise<unknown> {
    return chrome.tabs.sendMessage(tabId, message);
  }

  /**
   * Initialize the message bus in background context
   */
  setupListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const handlers = this.handlers.get(message.type);
      if (handlers && handlers.length > 0) {
        // Call all handlers
        let asyncHandled = false;
        for (const handler of handlers) {
          const result = handler(message, sender, sendResponse);
          if (result === true || result instanceof Promise) {
            asyncHandled = true;
          }
        }
        return asyncHandled;
      }
      return false;
    });
  }
}

// Singleton instance
export const messageBus = new MessageBus();

// ============================================
// QUICK REPLY ACTIONS
// ============================================

export const QUICK_REPLY_ACTIONS = {
  confirm_portal: 'CONFIRM_PORTAL',
  edit_portal: 'EDIT_PORTAL',
  recapture_portal: 'RECAPTURE_PORTAL',
  open_google_flights: 'OPEN_GOOGLE_FLIGHTS',
  confirm_direct: 'CONFIRM_DIRECT',
  recapture_direct: 'RECAPTURE_DIRECT',
  reset_flow: 'RESET_FLOW',
  retry: 'RETRY',
  open_portal: 'OPEN_PORTAL',
  ask_portal_direct: 'ASK_PORTAL_DIRECT',
  ask_eraser: 'ASK_ERASER',
  ask_transfer: 'ASK_TRANSFER',
} as const;
